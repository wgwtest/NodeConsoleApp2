import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dataRoot = path.join(projectRoot, 'assets', 'data');

async function importAsDataModule(filePath, rewrite = source => source) {
  const source = rewrite(await fs.readFile(filePath, 'utf8'));
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

async function importBuffRuntime() {
  const buffModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'buff', 'Buff.js'));
  const buffUrl = `data:text/javascript;base64,${Buffer.from(
    await fs.readFile(path.join(projectRoot, 'script', 'engine', 'buff', 'Buff.js'), 'utf8'),
    'utf8'
  ).toString('base64')}`;
  const registryModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'buff', 'BuffRegistry.js'));
  const managerModule = await importAsDataModule(
    path.join(projectRoot, 'script', 'engine', 'buff', 'BuffManager.js'),
    source => source.replace("import Buff from './Buff.js';", `import Buff from '${buffUrl}';`)
  );
  const systemModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'buff', 'BuffSystem.js'));
  return {
    Buff: buffModule.default,
    BuffRegistry: registryModule.default,
    BuffManager: managerModule.default,
    BuffSystem: systemModule.default
  };
}

async function importCoreEngineClass() {
  return importAsDataModule(
    path.join(projectRoot, 'script', 'engine', 'CoreEngine.js'),
    source => source
      .replace(/^\uFEFF?import[^\n]*\n/gmu, '')
      .replace(/\/\/ 创建单例实例[\s\S]*?export \{ CoreEngine \};\s*$/u, 'export { CoreEngine };\n')
  );
}

async function loadJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(dataRoot, relativePath), 'utf8'));
}

class TestEventBus {
  constructor() {
    this.handlers = new Map();
    this.events = [];
  }

  on(name, fn) {
    const next = this.handlers.get(name) || [];
    next.push(fn);
    this.handlers.set(name, next);
    return () => {
      this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item !== fn));
    };
  }

  emit(name, payload) {
    this.events.push({ name, payload });
    for (const fn of this.handlers.get(name) || []) {
      fn(payload);
    }
  }
}

function createActor(id, overrides = {}) {
  return {
    id,
    name: overrides.name || id,
    stats: {
      hp: overrides.hp ?? 100,
      maxHp: overrides.maxHp ?? 100,
      ap: overrides.ap ?? 3,
      speed: overrides.speed ?? 10,
      atk: overrides.atk ?? 10
    },
    bodyParts: JSON.parse(JSON.stringify(overrides.bodyParts || {
      head: { current: 0, max: 10, weakness: 1 },
      chest: { current: 0, max: 10, weakness: 1 },
      abdomen: { current: 0, max: 10, weakness: 1 },
      arm: { current: 0, max: 10, weakness: 1 },
      leg: { current: 0, max: 10, weakness: 1 }
    }))
  };
}

async function buildRuntime() {
  const rawBuffs = await loadJson('buffs_v2_7.json');
  const { BuffRegistry, BuffManager, BuffSystem } = await importBuffRuntime();
  const eventBus = new TestEventBus();
  const registry = new BuffRegistry(rawBuffs.buffs);
  const system = new BuffSystem(eventBus, registry);
  system.start();
  return { rawBuffs, BuffRegistry, BuffManager, BuffSystem, eventBus, registry, system };
}

function attachBuffs(actor, runtime) {
  actor.buffs = new runtime.BuffManager(actor, runtime.registry, runtime.eventBus);
  runtime.system.registerManager(actor.buffs);
  return actor;
}

function isHiddenSkill(skill) {
  return skill?.hiddenInSkillTree === true || skill?.editorMeta?.hiddenInSkillTree === true;
}

test('BuffRegistry 会解析 paramsSchema 默认值和覆盖值，不需要技能侧解释模板', async () => {
  const { registry } = await buildRuntime();

  const bleed = registry.getDefinition('buff_bleed', {
    params: { buff_duration: 4, maxVal: 7 }
  });
  assert.equal(bleed.lifecycle.duration, 4);
  assert.equal(bleed.lifecycle.maxStacks, 7);

  const haste = registry.getDefinition('new_buff_1771487521271', {
    params: { speedUpVal: 3 }
  });
  assert.equal(haste.statModifiers[0].stat, 'speed');
  assert.equal(haste.statModifiers[0].value, 3);
});

test('BuffManager 能刷新持续时间、按回合过期，并提供通用属性修正', async () => {
  const runtime = await buildRuntime();
  const actor = attachBuffs(createActor('player_1', { speed: 10 }), runtime);

  actor.buffs.add('buff_bleed', { params: { buff_duration: 2, maxVal: 5 } });
  actor.buffs.tickTurn();
  assert.equal(actor.buffs.getAll()[0].remaining, 1);

  actor.buffs.add('buff_bleed', { params: { buff_duration: 2, maxVal: 5 } });
  assert.equal(actor.buffs.getAll()[0].remaining, 2);

  actor.buffs.tickTurn();
  actor.buffs.tickTurn();
  assert.equal(actor.buffs.has('buff_bleed'), false);

  actor.buffs.add('buff_slow', { params: { buff_speedVal: -4 } });
  actor.buffs.add('new_buff_1771487521271', { params: { speedUpVal: 2 } });
  assert.equal(actor.buffs.getEffectiveStat('speed', actor.stats.speed), 8);
});

test('BuffSystem 能通过通用回合事件触发流血、中毒和晕眩', async () => {
  const runtime = await buildRuntime();
  const actor = attachBuffs(createActor('player_1'), runtime);

  actor.buffs.add('buff_bleed', { params: { buff_duration: 2, maxVal: 5 } });
  runtime.eventBus.emit('TURN_START', { turn: 1 });
  assert.equal(actor.stats.hp, 95);

  actor.buffs.add('buff_poison', { params: { damageVal: 7 } });
  runtime.eventBus.emit('TURN_END', { turn: 1 });
  assert.equal(actor.stats.hp, 88);
  assert.equal(actor.buffs.has('buff_bleed'), true);

  runtime.eventBus.emit('TURN_END', { turn: 2 });
  assert.equal(actor.buffs.has('buff_bleed'), false);

  actor.buffs.add('buff_stun');
  runtime.eventBus.emit('TURN_START', { turn: 3 });
  assert.equal(actor._skipTurn, true);
});

test('BuffSystem 能输出免伤、受击获甲、攻击获甲和技能 AP 开销修正这些通用上下文字段', async () => {
  const runtime = await buildRuntime();
  const attacker = attachBuffs(createActor('enemy_1'), runtime);
  const defender = attachBuffs(createActor('player_1', {
    bodyParts: {
      chest: { current: 0, max: 10, weakness: 1 },
      head: { current: 2, max: 10, weakness: 1 }
    }
  }), runtime);

  defender.buffs.add('new_buff_1771481773827', { params: { buffDuration: 2, stackNum: 1 } });
  defender.buffs.add('new_buff_1771481936095');
  defender.buffs.add('new_buff_1771485041778', { params: { healArmorVal: 5 } });
  const damageContext = { attacker, target: defender, bodyPart: 'chest', rawDamage: 8, tempModifiers: Object.create(null) };
  runtime.eventBus.emit('BATTLE_TAKE_DAMAGE_PRE', damageContext);
  assert.equal(damageContext.preventArmorDamage, true);
  assert.equal(damageContext.preventHpDamage, true);
  assert.equal(defender.bodyParts.chest.current, 5);

  attacker.buffs.add('new_buff_1771482673293', { params: { ArmorGetVal: 4 } });
  runtime.eventBus.emit('BATTLE_ATTACK_PRE', { attacker, target: defender, bodyPart: 'head' });
  assert.equal(attacker.bodyParts.head.current, 4);

  attacker.buffs.add('new_buff_1771485482007', { params: { apReduceVal: 1 } });
  runtime.eventBus.emit('TURN_START', { turn: 1 });
  assert.equal(attacker._planningApCostFlatDelta, -1);

  defender.buffs.add('new_buff_1771487055554');
  runtime.eventBus.emit('TURN_START', { turn: 2 });
  assert.equal(defender._planningApCostFlatDelta, 1);
});

test('CoreEngine 桥接层消费 BuffSystem 写出的通用字段，而不是识别具体 Buff ID', async () => {
  const runtime = await buildRuntime();
  const { CoreEngine } = await importCoreEngineClass();
  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = runtime.eventBus;

  const attacker = attachBuffs(createActor('enemy_1'), runtime);
  const defender = attachBuffs(createActor('player_1', {
    bodyParts: { chest: { current: 10, max: 10, weakness: 1 } }
  }), runtime);
  defender.buffs.add('new_buff_1771481773827');

  const outcome = driver._applyBattleDamage({
    attacker,
    target: defender,
    skillId: 'skill_test_armor_guard',
    bodyPart: 'chest',
    rawDamage: 6
  });
  assert.equal(outcome.armorDamage, 0);
  assert.equal(defender.bodyParts.chest.current, 10);
  assert.equal(defender.stats.hp, 100);

  attacker.buffs.add('new_buff_1771485482007', { params: { apReduceVal: 1 } });
  runtime.eventBus.emit('TURN_START', { turn: 1 });
  assert.equal(driver._getSkillApCostStrict({ id: 'skill_cost_probe', costs: { ap: 2 } }, 'skill_cost_probe', attacker), 1);
  attacker.buffs.add('new_buff_1771487521271', { params: { speedUpVal: 3 } });
  assert.equal(driver._getEffectiveActorSpeed(attacker, { speed: 2 }), 15);
});

test('Skill 只负责施加 buffRefs，Buff 后续通过事件独立生效', async () => {
  const runtime = await buildRuntime();
  const { CoreEngine } = await importCoreEngineClass();
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const skill = rawSkills.skills.find(item => item.id === 'skill_1771769351059');
  assert.equal(skill?.name, '锯齿斩');

  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = runtime.eventBus;
  const player = attachBuffs(createActor('player_1'), runtime);
  const enemy = attachBuffs(createActor('enemy_1', {
    bodyParts: { chest: { current: 0, max: 0, weakness: 1 } }
  }), runtime);
  driver.data = { playerData: player, currentLevelData: { enemies: [enemy] } };

  const result = driver._executeSkillActions({
    actor: player,
    action: { targetId: enemy.id, bodyPart: 'chest' },
    skillConfig: skill
  });

  assert.equal(result.ok, true);
  assert.equal(enemy.stats.hp, 95);
  assert.equal(enemy.buffs.has('buff_bleed'), true);

  runtime.eventBus.emit('TURN_START', { turn: 1 });
  assert.equal(enemy.stats.hp, 90);
});

test('当前技能包的正式技能 Buff 引用会被分类：可测项通过，缺失项进入暂缓清单', async () => {
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const rawBuffs = await loadJson('buffs_v2_7.json');
  const buffIds = new Set(Object.keys(rawBuffs.buffs || {}));
  const skillIds = new Set((rawSkills.skills || []).map(skill => skill.id));
  const formalSkills = (rawSkills.skills || []).filter(skill => !isHiddenSkill(skill));

  const missingBuffRefs = [];
  const invalidPrerequisites = [];
  for (const skill of formalSkills) {
    for (const row of skill.buffRefs?.apply || []) {
      if (row?.buffId && !buffIds.has(row.buffId)) {
        missingBuffRefs.push({ skillId: skill.id, skillName: skill.name, buffId: row.buffId });
      }
    }
    for (const row of skill.buffRefs?.remove || []) {
      if (row?.buffId && !buffIds.has(row.buffId)) {
        missingBuffRefs.push({ skillId: skill.id, skillName: skill.name, buffId: row.buffId });
      }
    }
    for (const prerequisite of skill.prerequisites || []) {
      if (!skillIds.has(prerequisite)) {
        invalidPrerequisites.push({ skillId: skill.id, skillName: skill.name, prerequisite });
      }
    }
  }

  assert.deepEqual(missingBuffRefs, [
    { skillId: 'skill_fortify_copy_1769873501141', skillName: '西海岸', buffId: 'buff_shield' }
  ]);
  assert.deepEqual(invalidPrerequisites, []);

  const emptyRuntimeBuffs = Object.values(rawBuffs.buffs || {})
    .filter(buff => (buff.effects || []).length === 0 && (buff.statModifiers || []).length === 0)
    .map(buff => ({ id: buff.id, name: buff.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(emptyRuntimeBuffs, [
    { id: 'buff_pain_sup', name: '减伤' },
    { id: 'buff_vulnerable', name: '增伤' },
    { id: 'new_buff_1771487561747', name: '减速' }
  ]);

  const lifesteal = rawBuffs.buffs.buff_lifesteal;
  assert.deepEqual(lifesteal.effects.map(effect => effect.action), ['HEAL_ARMOR']);
});
