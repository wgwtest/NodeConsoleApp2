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

async function readEnemySkillAliasesFromDataManager() {
  const source = await fs.readFile(path.join(projectRoot, 'script', 'engine', 'DataManagerV2.js'), 'utf8');
  const match = source.match(/this\._enemySkillAliases\s*=\s*(\{[\s\S]*?\n\s*\});/u);
  assert.ok(match, 'DataManagerV2 应保留敌人技能别名表');
  return Function(`"use strict"; return (${match[1]});`)();
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

function findKeyPaths(value, keyName, pathName = '$') {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findKeyPaths(item, keyName, `${pathName}[${index}]`));
  }

  const paths = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${pathName}.${key}`;
    if (key === keyName) paths.push(childPath);
    paths.push(...findKeyPaths(child, keyName, childPath));
  }
  return paths;
}

function createSkillHarness(runtime, options = {}) {
  const eventBus = runtime.eventBus;
  const player = attachBuffs(createActor('player_1', {
    hp: options.playerHp ?? 80,
    maxHp: options.playerMaxHp ?? 100,
    ap: options.playerAp ?? 3,
    atk: options.playerAtk ?? 10,
    bodyParts: options.playerBodyParts || {
      head: { current: 5, max: 20, weakness: 1 },
      chest: { current: 6, max: 20, weakness: 1 },
      abdomen: { current: 4, max: 20, weakness: 1 },
      arm: { current: 8, max: 20, weakness: 1 },
      leg: { current: 7, max: 20, weakness: 1 }
    }
  }), runtime);
  const enemy = attachBuffs(createActor('enemy_1', {
    hp: options.enemyHp ?? 100,
    maxHp: options.enemyMaxHp ?? 100,
    ap: options.enemyAp ?? 3,
    atk: options.enemyAtk ?? 10,
    bodyParts: options.enemyBodyParts || {
      head: { current: 12, max: 20, weakness: 1 },
      chest: { current: 0, max: 20, weakness: 1 },
      abdomen: { current: 10, max: 20, weakness: 1 },
      arm: { current: 6, max: 20, weakness: 1 },
      leg: { current: 5, max: 20, weakness: 1 }
    }
  }), runtime);
  return {
    eventBus,
    player,
    enemy,
    data: { playerData: player, currentLevelData: { enemies: [enemy] } }
  };
}

async function executeFixtureSkill(skillName, action = {}, options = {}) {
  const runtime = await buildRuntime();
  const { CoreEngine } = await importCoreEngineClass();
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const skillConfig = rawSkills.skills.find(skill => skill.name === skillName);
  assert.ok(skillConfig, `缺少技能样本: ${skillName}`);
  const harness = createSkillHarness(runtime, options);
  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = runtime.eventBus;
  driver.data = harness.data;
  const actor = action.actor === 'enemy' ? harness.enemy : harness.player;
  const target = action.target === 'self' ? actor : (action.target === 'player' ? harness.player : harness.enemy);
  const result = driver._executeSkillActions({
    actor,
    action: {
      targetId: target.id,
      bodyPart: action.bodyPart ?? 'chest'
    },
    skillConfig
  });
  return { runtime, driver, skillConfig, ...harness, result };
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

test('增伤与减伤通过 damageTakenMult 数据修正进入通用伤害结算', async () => {
  const runtime = await buildRuntime();
  const { CoreEngine } = await importCoreEngineClass();
  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = runtime.eventBus;

  const vulnerableAttacker = attachBuffs(createActor('enemy_vulnerable'), runtime);
  const vulnerableTarget = attachBuffs(createActor('player_vulnerable', {
    bodyParts: { chest: { current: 0, max: 0, weakness: 1 } }
  }), runtime);
  vulnerableTarget.buffs.add('buff_vulnerable');

  const vulnerableOutcome = driver._applyBattleDamage({
    attacker: vulnerableAttacker,
    target: vulnerableTarget,
    skillId: 'skill_damage_taken_vulnerable_probe',
    bodyPart: 'chest',
    rawDamage: 10
  });
  assert.equal(vulnerableOutcome.damage, 12);
  assert.equal(vulnerableTarget.stats.hp, 88);

  const protectedAttacker = attachBuffs(createActor('enemy_protected'), runtime);
  const protectedTarget = attachBuffs(createActor('player_protected', {
    bodyParts: { chest: { current: 0, max: 0, weakness: 1 } }
  }), runtime);
  protectedTarget.buffs.add('buff_pain_sup');

  const protectedOutcome = driver._applyBattleDamage({
    attacker: protectedAttacker,
    target: protectedTarget,
    skillId: 'skill_damage_taken_protected_probe',
    bodyPart: 'chest',
    rawDamage: 10
  });
  assert.equal(protectedOutcome.damage, 7);
  assert.equal(protectedTarget.stats.hp, 93);
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
  const enemySkillAliases = await readEnemySkillAliasesFromDataManager();
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

  assert.deepEqual(missingBuffRefs, []);
  assert.deepEqual(invalidPrerequisites, []);

  const emptyRuntimeBuffs = Object.values(rawBuffs.buffs || {})
    .filter(buff => (buff.effects || []).length === 0 && (buff.statModifiers || []).length === 0)
    .map(buff => ({ id: buff.id, name: buff.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(emptyRuntimeBuffs, []);
  assert.equal(rawBuffs.buffs.new_buff_1771487561747, undefined);

  const lifesteal = rawBuffs.buffs.buff_lifesteal;
  assert.deepEqual(lifesteal.effects.map(effect => effect.action), ['HEAL_HP']);

  assert.equal(enemySkillAliases.skill_rage, 'skill_1770474698976');
  assert.equal(skillIds.has(enemySkillAliases.skill_rage), true);
});

test('临期食品和铁手按技能语义作用于自身，而不是误加给敌人', async () => {
  const staleFood = await executeFixtureSkill('临期食品', { target: 'self', bodyPart: 'chest' }, {
    playerHp: 80,
    enemyHp: 100,
    playerBodyParts: {
      head: { current: 5, max: 20, weakness: 1 },
      chest: { current: 6, max: 30, weakness: 1 },
      abdomen: { current: 4, max: 20, weakness: 1 },
      arm: { current: 8, max: 20, weakness: 1 },
      leg: { current: 7, max: 20, weakness: 1 }
    },
    enemyBodyParts: {
      chest: { current: 0, max: 30, weakness: 1 }
    }
  });
  assert.equal(staleFood.result.ok, true);
  assert.equal(staleFood.player.stats.hp, 75);
  assert.equal(staleFood.enemy.stats.hp, 100);
  assert.equal(staleFood.player.bodyParts.chest.current, 26);
  assert.equal(staleFood.enemy.bodyParts.chest.current, 0);

  const ironHand = await executeFixtureSkill('铁手', { target: 'self', bodyPart: 'arm' }, {
    playerBodyParts: {
      head: { current: 5, max: 20, weakness: 1 },
      chest: { current: 6, max: 20, weakness: 1 },
      abdomen: { current: 4, max: 20, weakness: 1 },
      arm: { current: 2, max: 20, weakness: 1 },
      leg: { current: 7, max: 20, weakness: 1 }
    },
    enemyBodyParts: {
      arm: { current: 0, max: 20, weakness: 1 }
    }
  });
  assert.equal(ironHand.result.ok, true);
  assert.equal(ironHand.player.bodyParts.arm.current, 17);
  assert.equal(ironHand.enemy.bodyParts.arm.current, 0);
});

test('后撤步和重新开始把增益加给自身，而不是误加给敌人', async () => {
  const backstep = await executeFixtureSkill('后撤步', { target: 'self', bodyPart: 'leg' }, {
    playerBodyParts: {
      head: { current: 5, max: 20, weakness: 1 },
      chest: { current: 6, max: 20, weakness: 1 },
      abdomen: { current: 4, max: 20, weakness: 1 },
      arm: { current: 8, max: 20, weakness: 1 },
      leg: { current: 7, max: 20, weakness: 1 }
    }
  });
  assert.equal(backstep.result.ok, true);
  assert.equal(backstep.player.bodyParts.leg.current, 2);
  assert.equal(backstep.player.buffs.has('new_buff_1771481773827'), true);
  assert.equal(backstep.enemy.buffs.has('new_buff_1771481773827'), false);

  const restart = await executeFixtureSkill('重新开始', { target: 'self' });
  assert.equal(restart.result.ok, true);
  assert.equal(restart.player.buffs.has('new_buff_1771485482007'), true);
  assert.equal(restart.enemy.buffs.has('new_buff_1771485482007'), false);
});

test('迸发和吸血用 BUFF_STACKS 读取目标流血层数结算，不写技能 ID 特判', async () => {
  const burst = await executeFixtureSkill('迸发', { bodyPart: 'chest' }, {
    enemyHp: 100,
    enemyBodyParts: { chest: { current: 0, max: 20, weakness: 1 } }
  });
  burst.enemy.buffs.add('buff_bleed', {
    stacks: 3,
    params: { buff_duration: 2, maxVal: 5 }
  });
  const burstResult = burst.driver._executeSkillActions({
    actor: burst.player,
    action: { targetId: burst.enemy.id, bodyPart: 'chest' },
    skillConfig: burst.skillConfig
  });
  assert.equal(burstResult.ok, true);
  assert.equal(burstResult.actions[0].damage, 15);
  assert.equal(burst.enemy.stats.hp, 85);
  assert.equal(burst.enemy.buffs.getStacks('buff_bleed'), 3);

  const drain = await executeFixtureSkill('吸血', { bodyPart: 'chest' }, {
    playerHp: 60,
    enemyHp: 100,
    enemyBodyParts: { chest: { current: 0, max: 20, weakness: 1 } }
  });
  drain.enemy.buffs.add('buff_bleed', {
    stacks: 4,
    params: { buff_duration: 2, maxVal: 5 }
  });
  const drainResult = drain.driver._executeSkillActions({
    actor: drain.player,
    action: { targetId: drain.enemy.id, bodyPart: 'chest' },
    skillConfig: drain.skillConfig
  });
  assert.equal(drainResult.ok, true);
  assert.equal(drainResult.actions[0].heal, 8);
  assert.equal(drain.player.stats.hp, 68);
  assert.equal(drain.enemy.stats.hp, 100);
  assert.equal(drain.enemy.buffs.getStacks('buff_bleed'), 4);
});

test('防守后 Buff 能通过通用事件触发反伤和反击请求', async () => {
  const runtime = await buildRuntime();
  const attacker = attachBuffs(createActor('enemy_1'), runtime);
  const defender = attachBuffs(createActor('player_1'), runtime);
  defender.buffs.add('buff_thorns');
  defender.buffs.add('buff_counter');

  let counterPayload = null;
  runtime.eventBus.on('BUFF_ATTACK_REQUEST', payload => {
    counterPayload = payload;
  });

  runtime.eventBus.emit('BATTLE_DEFEND_POST', {
    attacker,
    target: defender,
    damageTaken: 10,
    bodyPart: 'chest'
  });

  assert.equal(attacker.stats.hp, 97);
  assert.ok(counterPayload, 'buff_counter 应发出通用 BUFF_ATTACK_REQUEST，而不是直接调用 CoreEngine');
  assert.equal(counterPayload.source, defender);
  assert.equal(counterPayload.target, attacker);
  assert.equal(counterPayload.reason, 'BUFF_ATTACK');
});

test('回合护甲回复复用 HEAL_ARMOR，吸血在攻击后回复 HP', async () => {
  const runtime = await buildRuntime();
  const actor = attachBuffs(createActor('player_1', {
    hp: 90,
    maxHp: 100,
    bodyParts: {
      chest: { current: 0, max: 20, weakness: 1 },
      arm: { current: 3, max: 10, weakness: 1 }
    }
  }), runtime);
  const enemy = attachBuffs(createActor('enemy_1'), runtime);

  actor.buffs.add('buff_ap_regen', { params: { ArmorGetVal: 6, buffDuration: 2 } });
  runtime.eventBus.emit('TURN_START', { turn: 1 });
  assert.equal(actor.bodyParts.chest.current, 6);

  actor.buffs.add('buff_lifesteal');
  runtime.eventBus.emit('BATTLE_ATTACK_POST', {
    attacker: actor,
    target: enemy,
    damageDealt: 8,
    bodyPart: 'arm'
  });
  assert.equal(actor.bodyParts.arm.current, 3);
  assert.equal(actor.stats.hp, 98);
});

test('CoreEngine 应消费 BuffSystem 写入的通用 damageDealtMult，而不是让字段空转', async () => {
  const { BuffRegistry, BuffManager, BuffSystem } = await importBuffRuntime();
  const { CoreEngine } = await importCoreEngineClass();
  const eventBus = new TestEventBus();
  const registry = new BuffRegistry({
    buff_damage_dealt_probe: {
      id: 'buff_damage_dealt_probe',
      name: '通用增伤探针',
      lifecycle: { duration: 1, maxStacks: 1, stackStrategy: 'refresh' },
      effects: [],
      statModifiers: [
        { stat: 'damageDealtMult', type: 'flat', value: 0.5 }
      ]
    }
  });
  const system = new BuffSystem(eventBus, registry);
  system.start();
  const runtime = { BuffManager, registry, eventBus, system };
  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = eventBus;

  const attacker = attachBuffs(createActor('enemy_1'), runtime);
  const target = attachBuffs(createActor('player_1', {
    bodyParts: { chest: { current: 0, max: 0, weakness: 1 } }
  }), runtime);
  attacker.buffs.add('buff_damage_dealt_probe');

  const outcome = driver._applyBattleDamage({
    attacker,
    target,
    skillId: 'skill_damage_dealt_probe',
    bodyPart: 'chest',
    rawDamage: 10
  });

  assert.equal(outcome.damage, 15);
  assert.equal(target.stats.hp, 85);
});

test('正式技能直接动作层能执行 HEAL 与 ARMOR_ADD', async () => {
  const healCase = await executeFixtureSkill('治疗', { target: 'self' }, { playerHp: 60 });
  assert.equal(healCase.result.ok, true);
  assert.equal(healCase.player.stats.hp, 80);
  assert.equal(healCase.result.actions[0].heal, 20);

  const armorCase = await executeFixtureSkill('修理护甲', { target: 'self', bodyPart: 'head' }, {
    playerBodyParts: {
      head: { current: 5, max: 20, weakness: 1 },
      chest: { current: 6, max: 20, weakness: 1 },
      abdomen: { current: 4, max: 20, weakness: 1 },
      arm: { current: 8, max: 20, weakness: 1 },
      leg: { current: 7, max: 20, weakness: 1 }
    }
  });
  assert.equal(armorCase.result.ok, true);
  assert.equal(armorCase.player.bodyParts.head.current, 15);
  assert.equal(armorCase.result.actions[0].armorGain, 10);
});

test('正式技能直接动作层能执行 DMG_ARMOR 的 ABS、PCT_CURRENT 和 explicit self target', async () => {
  const skullCase = await executeFixtureSkill('裂颅一击', { bodyPart: 'head' }, {
    enemyBodyParts: {
      head: { current: 12, max: 20, weakness: 1 },
      chest: { current: 0, max: 20, weakness: 1 }
    }
  });
  assert.equal(skullCase.result.ok, true);
  assert.equal(skullCase.enemy.bodyParts.head.current, 0);
  assert.equal(skullCase.result.actions[0].armorDamage, 12);

  const baldCase = await executeFixtureSkill('光头', { target: 'self', bodyPart: 'head' }, {
    playerBodyParts: {
      head: { current: 9, max: 20, weakness: 1 },
      chest: { current: 6, max: 20, weakness: 1 }
    },
    playerAp: 2
  });
  assert.equal(baldCase.result.ok, true);
  assert.equal(baldCase.player.bodyParts.head.current, 0);
  assert.equal(baldCase.player.stats.ap, 5);

  const punchCase = await executeFixtureSkill('重拳', { bodyPart: 'arm' }, {
    playerBodyParts: {
      arm: { current: 8, max: 20, weakness: 1 },
      chest: { current: 6, max: 20, weakness: 1 }
    },
    enemyBodyParts: {
      arm: { current: 25, max: 30, weakness: 1 },
      chest: { current: 0, max: 20, weakness: 1 }
    }
  });
  assert.equal(punchCase.result.ok, true);
  assert.equal(punchCase.player.bodyParts.arm.current, 4);
  assert.equal(punchCase.enemy.bodyParts.arm.current, 5);
});

test('正式技能直接动作层能执行 DMG_HP、repeat、PCT_CURRENT 和 explicit 自伤', async () => {
  const slashCase = await executeFixtureSkill('剑砍', { bodyPart: 'chest' }, {
    enemyBodyParts: { chest: { current: 0, max: 20, weakness: 1 } },
    enemyHp: 100
  });
  assert.equal(slashCase.result.ok, true);
  assert.equal(slashCase.result.actions.length, 2);
  assert.equal(slashCase.enemy.stats.hp, 80);

  const executeCase = await executeFixtureSkill('斩首', { bodyPart: 'chest' }, {
    enemyBodyParts: { chest: { current: 0, max: 20, weakness: 1 } },
    enemyHp: 50,
    enemyMaxHp: 100
  });
  assert.equal(executeCase.result.ok, true);
  assert.equal(executeCase.result.actions[0].damage, 15);
  assert.equal(executeCase.enemy.stats.hp, 35);

  const bloodCase = await executeFixtureSkill('鲜血打击', { bodyPart: 'chest' }, {
    playerHp: 80,
    enemyBodyParts: { chest: { current: 0, max: 20, weakness: 1 } },
    enemyHp: 100
  });
  assert.equal(bloodCase.result.ok, true);
  assert.equal(bloodCase.player.stats.hp, 78);
  assert.equal(bloodCase.enemy.stats.hp, 80);
});

test('撕裂伤口施加撕裂状态，撕裂状态在行动前通过 Buff 侧逻辑增加流血层数', async () => {
  const tearCase = await executeFixtureSkill('撕裂伤口', { bodyPart: 'chest' }, {
    enemyBodyParts: { chest: { current: 10, max: 20, weakness: 1 } }
  });
  assert.equal(tearCase.result.ok, true);
  assert.equal(tearCase.enemy.buffs.has('buff_tear_wound'), true);
  assert.equal(tearCase.enemy.buffs.has('buff_slow'), false);

  tearCase.runtime.eventBus.emit('BATTLE_ACTION_PRE', {
    actor: tearCase.enemy,
    source: tearCase.enemy,
    target: tearCase.player,
    actionType: 'SKILL'
  });
  assert.equal(tearCase.enemy.buffs.getStacks('buff_bleed'), 1);

  tearCase.runtime.eventBus.emit('BATTLE_ACTION_PRE', {
    actor: tearCase.enemy,
    source: tearCase.enemy,
    target: tearCase.player,
    actionType: 'SKILL'
  });
  assert.equal(tearCase.enemy.buffs.getStacks('buff_bleed'), 2);

  tearCase.runtime.eventBus.emit('BATTLE_ACTION_PRE', {
    actor: tearCase.player,
    source: tearCase.player,
    target: tearCase.enemy,
    actionType: 'SKILL'
  });
  assert.equal(tearCase.enemy.buffs.getStacks('buff_bleed'), 2);
});

test('正式技能直接动作层能执行 BUFF_REMOVE，并记录数据语义待确认项', async () => {
  const runtime = await buildRuntime();
  const { CoreEngine } = await importCoreEngineClass();
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const skillConfig = rawSkills.skills.find(skill => skill.name === '光脚');
  assert.ok(skillConfig);
  const harness = createSkillHarness(runtime, {
    enemyBodyParts: { leg: { current: 5, max: 20, weakness: 1 } }
  });
  harness.enemy.buffs.add('buff_slow');
  harness.enemy.buffs.add('buff_ap_regen');
  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = runtime.eventBus;
  driver.data = harness.data;

  const result = driver._executeSkillActions({
    actor: harness.player,
    action: { targetId: harness.enemy.id, bodyPart: 'leg' },
    skillConfig
  });

  assert.equal(result.ok, true);
  assert.equal(harness.enemy.bodyParts.leg.current, 0);
  assert.equal(harness.enemy.buffs.has('buff_slow'), false);
  assert.equal(harness.enemy.buffs.has('buff_ap_regen'), true);
  assert.equal(harness.player.buffs.has('new_buff_1771487521271'), true);

  assert.deepEqual(findKeyPaths(rawSkills, 'scaling'), []);
  assert.equal(rawSkills.meta?.enums?.amountTypes?.includes('SCALING'), false);
});

test('正式技能运行时能力分类保持可审计，复杂项不伪装为已覆盖', async () => {
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const rawBuffs = await loadJson('buffs_v2_7.json');
  const buffIds = new Set(Object.keys(rawBuffs.buffs || {}));
  const formalSkills = (rawSkills.skills || []).filter(skill => !isHiddenSkill(skill));
  const supportedEffectTypes = new Set(['DMG_HP', 'DMG_ARMOR', 'HEAL', 'ARMOR_ADD', 'AP_GAIN', 'BUFF_REMOVE']);

  const rows = formalSkills.map(skill => {
    const issues = [];
    const actions = Array.isArray(skill.actions) ? skill.actions : [];
    const applyRows = Array.isArray(skill.buffRefs?.apply) ? skill.buffRefs.apply : [];
    const removeRows = Array.isArray(skill.buffRefs?.remove) ? skill.buffRefs.remove : [];

    if (actions.length === 0 && applyRows.length === 0 && removeRows.length === 0) {
      issues.push('empty_runtime');
    }

    for (const action of actions) {
      const effect = action?.effect || {};
      if (!supportedEffectTypes.has(effect.effectType)) {
        issues.push(`unsupported_effect:${effect.effectType || 'missing'}`);
      }
      if (effect.scaling) issues.push('legacy_scaling_field');
    }

    for (const row of [...applyRows, ...removeRows]) {
      if (row?.buffId && !buffIds.has(row.buffId)) {
        issues.push(`missing_buff:${row.buffId}`);
      }
    }

    return {
      skillId: skill.id,
      skillName: skill.name,
      issues: Array.from(new Set(issues)).sort()
    };
  });

  const byIssue = issueCode => rows
    .filter(row => row.issues.includes(issueCode))
    .map(row => row.skillName)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  assert.equal(formalSkills.length, 31);
  assert.equal(rawSkills.skills.some(skill => skill.id === 'skill_1770396871360'), false);
  assert.deepEqual(byIssue('missing_buff:buff_shield'), []);
  assert.deepEqual(byIssue('empty_runtime'), []);
  assert.deepEqual(byIssue('legacy_scaling_field'), []);

  const bloodStrike = rawSkills.skills.find(skill => skill.id === 'skill_1770474698976');
  assert.deepEqual(bloodStrike?.prerequisites, ['skill_double_thrust_copy_1770395861178']);

  const unsupported = rows.filter(row => row.issues.some(issue => issue.startsWith('unsupported_effect:')));
  assert.deepEqual(unsupported, []);

  const stableCount = rows.filter(row => row.issues.length === 0).length;
  assert.equal(stableCount, 31);
});

test('本轮数据修正不会误改无关技能目标语义', async () => {
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const byId = Object.fromEntries(rawSkills.skills.map(skill => [skill.id, skill]));

  assert.equal(byId.skill_heavy_swing.target.subject, 'SUBJECT_ENEMY');
  assert.equal(byId.skill_skull_cracker.target.subject, 'SUBJECT_ENEMY');
  assert.equal(byId.skill_shockwave.buffRefs.apply[0].target, 'self');
  assert.equal(byId.skill_hold_the_line.target.subject, 'SUBJECT_ENEMY');
  assert.equal(byId.skill_earthquake.buffRefs.apply[0].target, 'enemy');

  assert.equal(byId.skill_savage_charge.target.subject, 'SUBJECT_SELF');
  assert.equal(byId.skill_artery_slice_copy_1769788322314.target.subject, 'SUBJECT_SELF');
  assert.equal(byId.skill_shockwave_copy_1770041956468.buffRefs.apply[0].target, 'self');
  assert.equal(byId.skill_aegis_copy_1770042764756.buffRefs.apply[0].target, 'self');
});
