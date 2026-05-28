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

function isHiddenSkill(skill) {
  return skill?.hiddenInSkillTree === true || skill?.editorMeta?.hiddenInSkillTree === true;
}

function createBodyParts(overrides = {}) {
  return {
    head: { current: 60, max: 80, weakness: 1, ...(overrides.head || {}) },
    chest: { current: 0, max: 80, weakness: 1, ...(overrides.chest || {}) },
    abdomen: { current: 40, max: 80, weakness: 1, ...(overrides.abdomen || {}) },
    arm: { current: 50, max: 80, weakness: 1, ...(overrides.arm || {}) },
    leg: { current: 50, max: 80, weakness: 1, ...(overrides.leg || {}) }
  };
}

function createActor(id, overrides = {}) {
  const hp = overrides.hp ?? 80;
  const maxHp = overrides.maxHp ?? 100;
  const actor = {
    id,
    name: overrides.name || id,
    stats: {
      hp,
      maxHp,
      ap: overrides.ap ?? 10,
      maxAp: overrides.maxAp ?? overrides.ap ?? 10,
      speed: overrides.speed ?? 10,
      atk: overrides.atk ?? 10
    },
    bodyParts: JSON.parse(JSON.stringify(overrides.bodyParts || createBodyParts()))
  };

  if (overrides.withTopLevelHp) {
    actor.hp = hp;
    actor.maxHp = maxHp;
  }

  return actor;
}

function attachBuffs(actor, runtime) {
  actor.buffs = new runtime.BuffManager(actor, runtime.registry, runtime.eventBus);
  runtime.system.registerManager(actor.buffs);
  return actor;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshotActor(actor) {
  return {
    hp: actor.hp,
    statsHp: actor.stats?.hp,
    ap: actor.stats?.ap,
    bodyParts: clone(actor.bodyParts || {}),
    buffs: actor.buffs?.getAll ? actor.buffs.getAll().map(buff => ({
      id: buff.id,
      stacks: buff.stacks,
      remaining: buff.remaining
    })) : []
  };
}

function chooseBodyPart(skill) {
  const candidateParts = Array.isArray(skill?.target?.selection?.candidateParts)
    ? skill.target.selection.candidateParts
    : ['head', 'chest', 'abdomen', 'arm', 'leg'];
  const hasDamageArmor = (skill.actions || []).some(action => action?.effect?.effectType === 'DMG_ARMOR');
  const hasDamageHp = (skill.actions || []).some(action => action?.effect?.effectType === 'DMG_HP');

  if (skill.id === 'skill_shockwave') return 'leg';
  if (hasDamageArmor && candidateParts.includes('head')) return 'head';
  if (hasDamageHp && candidateParts.includes('chest')) return 'chest';
  if (candidateParts.includes('chest')) return 'chest';
  return candidateParts[0] || 'chest';
}

function setupSkillPreconditions({ skill, player, enemy }) {
  const effectTypes = new Set((skill.actions || []).map(action => action?.effect?.effectType).filter(Boolean));
  if (effectTypes.has('BUFF_REMOVE')) {
    enemy.buffs.add('buff_slow');
  }

  const usesBuffResource = (skill.actions || []).some(action => {
    const amountType = action?.effect?.amountType;
    return amountType === 'BUFF_STACKS' || amountType === 'BUFF_REMAINING';
  });
  if (usesBuffResource) {
    enemy.buffs.add('buff_bleed', {
      duration: 3,
      params: { buff_duration: 3 }
    });
  }

  if (skill.target?.subject === 'SUBJECT_SELF') {
    player.stats.hp = Math.min(player.stats.hp, 70);
  } else {
    enemy.hp = Math.min(enemy.hp, 80);
    enemy.stats.hp = Math.min(enemy.stats.hp, 80);
  }
}

async function createSkillExecutionHarness({ rawSkills, rawBuffs, skill }) {
  const { CoreEngine } = await importCoreEngineClass();
  const { BuffRegistry, BuffManager, BuffSystem } = await importBuffRuntime();
  const eventBus = new TestEventBus();
  const registry = new BuffRegistry(rawBuffs.buffs);
  const system = new BuffSystem(eventBus, registry);
  system.start();
  const runtime = { BuffManager, eventBus, registry, system };

  const player = attachBuffs(createActor('player_1', {
    name: '矩阵玩家',
    hp: 70,
    maxHp: 100,
    ap: 10,
    maxAp: 10,
    bodyParts: createBodyParts({
      head: { current: 60, max: 80 },
      chest: { current: 40, max: 80 },
      abdomen: { current: 40, max: 80 },
      arm: { current: 50, max: 80 },
      leg: { current: 50, max: 80 }
    })
  }), runtime);

  const enemy = attachBuffs(createActor('enemy_1', {
    name: '矩阵敌人',
    hp: 80,
    maxHp: 100,
    ap: 10,
    maxAp: 10,
    withTopLevelHp: true,
    bodyParts: createBodyParts({
      head: { current: 60, max: 80 },
      chest: { current: 0, max: 80 },
      abdomen: { current: 40, max: 80 },
      arm: { current: 50, max: 80 },
      leg: { current: 50, max: 80 }
    })
  }), runtime);

  setupSkillPreconditions({ skill, player, enemy });

  const skillById = new Map(rawSkills.skills.map(item => [item.id, item]));
  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = eventBus;
  driver.currentTurn = 1;
  driver.battlePhase = 'PLANNING';
  driver.playerSkillQueue = [];
  driver.enemySkillQueue = [];
  driver.timeline = null;
  driver.data = {
    playerData: player,
    currentLevelData: {
      id: 'formal_skill_matrix',
      name: '正式技能矩阵',
      enemies: [enemy]
    },
    dataConfig: {
      runtime: {
        playerBattleState: {
          bodyParts: player.bodyParts
        }
      }
    },
    getSkillConfig: skillId => skillById.get(skillId) || null
  };

  return { driver, player, enemy, eventBus };
}

async function executeFormalSkill({ rawSkills, rawBuffs, skill }) {
  const { driver, player, enemy, eventBus } = await createSkillExecutionHarness({ rawSkills, rawBuffs, skill });
  const target = skill.target?.subject === 'SUBJECT_SELF' ? player : enemy;
  const scope = skill.target?.scope;
  const bodyPart = (scope === 'SCOPE_PART' || scope === 'SCOPE_MULTI_PARTS') ? chooseBodyPart(skill) : null;
  const before = {
    player: snapshotActor(player),
    enemy: snapshotActor(enemy)
  };

  const result = driver.executePlayerSkill({
    source: 'PLAYER',
    sourceId: player.id,
    skillId: skill.id,
    targetId: target.id,
    bodyPart,
    cost: Number(skill.costs?.ap ?? 0) || 0
  });

  return {
    skillId: skill.id,
    skillName: skill.name,
    targetId: target.id,
    bodyPart,
    result,
    before,
    after: {
      player: snapshotActor(player),
      enemy: snapshotActor(enemy)
    },
    emittedErrors: eventBus.events.filter(event => event.name === 'BUFF:ERROR' || event.name === 'TIMELINE_ERROR'),
    emittedWarnings: eventBus.events.filter(event => event.name === 'BUFF:WARN')
  };
}

function validateExecutionRow(row, skill) {
  const failures = [];
  if (!row.result) {
    failures.push('executePlayerSkill returned null/undefined');
    return failures;
  }
  if (row.result.ok !== true) {
    failures.push(`result.ok is not true: ${row.result.reason || JSON.stringify(row.result)}`);
  }

  const configuredActions = Array.isArray(skill.actions) ? skill.actions : [];
  const configuredBuffRefs = [
    ...(Array.isArray(skill.buffRefs?.apply) ? skill.buffRefs.apply : []),
    ...(Array.isArray(skill.buffRefs?.remove) ? skill.buffRefs.remove : [])
  ];
  const actionResults = Array.isArray(row.result.actions) ? row.result.actions : [];
  const buffResults = Array.isArray(row.result.buffResults) ? row.result.buffResults : [];

  if (configuredActions.length > 0 && actionResults.length === 0) {
    failures.push('configured actions produced no action results');
  }
  if (configuredBuffRefs.length > 0 && buffResults.length === 0) {
    failures.push('configured buffRefs produced no buff results');
  }
  if (actionResults.some(item => item?.removedBuffs !== undefined) && !actionResults.some(item => item.removedBuffs > 0)) {
    failures.push('BUFF_REMOVE executed but removed no debuff in matrix fixture');
  }
  if (row.emittedErrors.length > 0) {
    failures.push(`runtime emitted errors: ${row.emittedErrors.map(event => event.payload?.error || event.payload?.message || event.name).join('; ')}`);
  }

  if (skill.id === 'skill_execute_copy_1770043820577') {
    const damage = actionResults[0]?.damage;
    if (damage !== 15) failures.push(`迸发 expected 15 damage from 3 bleed remaining turns, got ${damage}`);
  }
  if (skill.id === 'skill_execute_copy_1770044052832') {
    const heal = actionResults[0]?.heal;
    if (heal !== 12) failures.push(`吸血 expected 12 heal from 3 bleed remaining turns, got ${heal}`);
  }

  return failures;
}

test('所有正式技能都能在 CoreEngine 执行入口至少成功运行一次', async () => {
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const rawBuffs = await loadJson('buffs_v2_7.json');
  const formalSkills = rawSkills.skills.filter(skill => !isHiddenSkill(skill));

  assert.equal(formalSkills.length, 40);

  const rows = [];
  const failures = [];
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    for (const skill of formalSkills) {
      try {
        const row = await executeFormalSkill({ rawSkills, rawBuffs, skill });
        rows.push(row);
        const rowFailures = validateExecutionRow(row, skill);
        if (rowFailures.length > 0) {
          failures.push({
            skillId: skill.id,
            skillName: skill.name,
            targetId: row.targetId,
            bodyPart: row.bodyPart,
            failures: rowFailures,
            result: row.result
          });
        }
      } catch (error) {
        failures.push({
          skillId: skill.id,
          skillName: skill.name,
          failures: [error?.stack || error?.message || String(error)]
        });
      }
    }
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(rows.length + failures.filter(item => !rows.some(row => row.skillId === item.skillId)).length, 40);
  assert.deepEqual(failures, []);
});
