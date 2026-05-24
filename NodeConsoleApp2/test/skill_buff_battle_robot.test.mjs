import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dataRoot = path.join(projectRoot, 'assets', 'data');

async function moduleUrl(filePath, rewrite = source => source) {
  const source = rewrite(await fs.readFile(filePath, 'utf8'));
  return `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
}

async function importAsDataModule(filePath, rewrite = source => source) {
  return import(await moduleUrl(filePath, rewrite));
}

async function importCoreEngineClass() {
  return importAsDataModule(
    path.join(projectRoot, 'script', 'engine', 'CoreEngine.js'),
    source => source
      .replace(/^\uFEFF?import[^\n]*\n/gmu, '')
      .replace(/\/\/ 创建单例实例[\s\S]*?export \{ CoreEngine \};\s*$/u, 'export { CoreEngine };\n')
  );
}

async function importBuffRuntime() {
  const buffUrl = await moduleUrl(path.join(projectRoot, 'script', 'engine', 'buff', 'Buff.js'));
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

async function importTurnRuntime() {
  const timelineModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'TimelineManager.js'));
  const plannerModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'TurnPlanner.js'));
  const enemyPlannerModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'EnemyActionPlanner.js'));
  return {
    TimelineManager: timelineModule.default,
    TurnPlanner: plannerModule.default,
    EnemyActionPlanner: enemyPlannerModule.default
  };
}

async function loadJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(dataRoot, relativePath), 'utf8'));
}

class TestEventBus {
  constructor() {
    this.handlers = new Map();
    this.events = [];
    this.waiters = [];
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

    const remaining = [];
    for (const waiter of this.waiters) {
      if (waiter.name === name && waiter.predicate(payload)) {
        waiter.resolve(payload);
      } else {
        remaining.push(waiter);
      }
    }
    this.waiters = remaining;
  }

  waitFor(name, predicate = () => true) {
    return new Promise(resolve => {
      this.waiters.push({ name, predicate, resolve });
    });
  }

  eventsByName(name) {
    return this.events.filter(event => event.name === name);
  }
}

class TestFsm {
  constructor() {
    this.currentState = 'MAIN_MENU';
  }

  changeState(nextState, payload = undefined) {
    this.currentState = nextState;
    this.lastPayload = payload;
  }
}

function createBodyParts(overrides = {}) {
  return {
    head: { current: 20, max: 20, weakness: 1, ...(overrides.head || {}) },
    chest: { current: 0, max: 20, weakness: 1, ...(overrides.chest || {}) },
    abdomen: { current: 10, max: 20, weakness: 1, ...(overrides.abdomen || {}) },
    arm: { current: 10, max: 20, weakness: 1, ...(overrides.arm || {}) },
    leg: { current: 10, max: 20, weakness: 1, ...(overrides.leg || {}) }
  };
}

function createActor(id, overrides = {}) {
  const hp = overrides.hp ?? 100;
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
    skills: overrides.skills,
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

async function buildBattleRobotHarness() {
  const rawSkills = await loadJson('skills_melee_v4_5.json');
  const rawBuffs = await loadJson('buffs_v2_7.json');
  const slotLayouts = await loadJson('slot_layouts.json');
  const { BuffRegistry, BuffManager, BuffSystem } = await importBuffRuntime();
  const { TimelineManager, TurnPlanner, EnemyActionPlanner } = await importTurnRuntime();
  const { CoreEngine } = await importCoreEngineClass();

  const eventBus = new TestEventBus();
  const registry = new BuffRegistry(rawBuffs.buffs);
  const system = new BuffSystem(eventBus, registry);
  system.start();
  const runtime = { BuffManager, eventBus, registry, system };

  const player = attachBuffs(createActor('player_1', {
    name: '测试玩家',
    hp: 70,
    maxHp: 100,
    ap: 10,
    maxAp: 10,
    speed: 20,
    bodyParts: createBodyParts({
      head: { current: 20, max: 20 },
      chest: { current: 20, max: 20 },
      abdomen: { current: 20, max: 20 },
      arm: { current: 20, max: 20 },
      leg: { current: 20, max: 20 }
    })
  }), runtime);

  const enemy = attachBuffs(createActor('enemy_1', {
    name: '测试敌人',
    hp: 100,
    maxHp: 100,
    ap: 10,
    maxAp: 10,
    speed: 0,
    withTopLevelHp: true,
    skills: ['skill_shockwave_copy_1769791396881'],
    bodyParts: createBodyParts({
      head: { current: 20, max: 20 },
      chest: { current: 0, max: 20 }
    })
  }), runtime);

  const scenarioSkillIds = new Set([
    'skill_shockwave_copy_1770042951717',
    'skill_execute_copy_1770043820577',
    'skill_execute_copy_1770044052832',
    'skill_shockwave_copy_1769791396881'
  ]);
  const skillById = new Map(rawSkills.skills.map(skill => [skill.id, skill]));

  const data = {
    playerData: player,
    currentLevelData: {
      id: 'battle_robot_probe',
      name: '战斗机器人验收',
      enemies: [enemy],
      battlePlayerState: {
        stats: {
          hp: 70,
          maxHp: 100,
          ap: 10,
          maxAp: 10,
          speed: 20
        },
        bodyParts: createBodyParts({
          head: { current: 20, max: 20 },
          chest: { current: 20, max: 20 },
          abdomen: { current: 20, max: 20 },
          arm: { current: 20, max: 20 },
          leg: { current: 20, max: 20 }
        })
      }
    },
    dataConfig: {
      battleRules: { slotLayoutId: 'default_v1' },
      runtime: {}
    },
    gameConfig: {
      items: {},
      slotLayouts
    },
    getLevelConfig: () => ({ battleRules: { slotLayoutId: 'default_v1' } }),
    getSkillConfig: skillId => skillById.get(skillId) || null,
    getSkillCatalog: () => ({
      skillsList: rawSkills.skills.filter(skill => scenarioSkillIds.has(skill.id))
    }),
    saveGame: () => true,
    applyBattleSettlement: ({ levelId, victory }) => ({
      levelId,
      levelName: '战斗机器人验收',
      victory,
      rewards: { exp: 0, gold: 0, kp: 0 }
    })
  };

  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = eventBus;
  driver.fsm = new TestFsm();
  driver.data = data;
  driver.buffRegistry = registry;
  driver.buffSystem = system;
  driver.playerSkillQueue = [];
  driver.enemySkillQueue = [];
  driver.battlePhase = 'IDLE';
  driver.currentTurn = 0;
  driver.currentHistoryEntry = null;
  driver._battleSlotLayout = null;
  driver.turnPlanner = new TurnPlanner({
    getSlotLayout: () => driver._getBattleSlotLayout(),
    getPlayerId: () => driver.data.playerData.id,
    getSkillConfig: skillId => driver.data.getSkillConfig(skillId),
    getCurrentAp: () => driver.data.playerData.stats.ap,
    getUsedAp: () => (driver.playerSkillQueue || []).reduce((sum, action) => sum + (Number(action.cost) || 0), 0)
  });
  driver.enemyPlanner = new EnemyActionPlanner({
    getSkillConfig: skillId => driver.data.getSkillConfig(skillId)
  });
  driver.timeline = new TimelineManager({
    eventBus,
    executeEntry: async entry => driver._executeTimelineEntry(entry)
  });
  const realTimelineStart = driver.timeline.start.bind(driver.timeline);
  driver.timeline.start = (options = {}) => realTimelineStart({ ...options, stepDelayMs: 0 });
  driver._bindTimelineEvents();
  driver._bindBuffBridgeEvents();

  return { driver, eventBus, player, enemy };
}

function draftForSkill(skillId, targetId, slotKey = 'enemy:chest:0') {
  const [, part] = slotKey.split(':');
  return {
    skillId,
    targetId,
    placedSlots: [slotKey],
    selectionResult: { selectedParts: [part] }
  };
}

async function playPlannedTurn({ driver, eventBus, skillId, targetId }) {
  const roundId = driver.currentTurn;
  driver.commitPlanning({
    planningDraftBySkill: {
      [skillId]: draftForSkill(skillId, targetId)
    }
  });
  assert.equal(driver.timeline.phase, 'READY', `第 ${roundId} 回合规划后时间轴应 READY`);

  const finished = eventBus.waitFor('TIMELINE_FINISHED', payload => payload?.roundId === roundId);
  const timelineError = eventBus.waitFor('TIMELINE_ERROR').then(payload => {
    throw new Error(`Timeline failed: ${payload?.message || 'unknown'}`);
  });
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timed out waiting for round ${roundId}`)), 1000);
  });

  driver.commitTurn();
  await Promise.race([finished, timelineError, timeout]);
  assert.equal(driver.battlePhase, 'PLANNING');
  assert.equal(driver.currentTurn, roundId + 1);
}

function findTimelineResult(eventBus, skillId) {
  return eventBus.eventsByName('TIMELINE_ENTRY_END')
    .map(event => event.payload)
    .find(payload => payload?.entry?.sourceAction?.skillId === skillId)
    ?.result || null;
}

test('战斗机器人按真实回合流验证撕裂伤口、迸发、吸血与 Buff 层数结算', async () => {
  const { driver, eventBus, player, enemy } = await buildBattleRobotHarness();

  driver.startBattle();
  assert.equal(driver.currentTurn, 1);
  assert.equal(driver.battlePhase, 'PLANNING');
  assert.equal(player.stats.hp, 70);
  assert.equal(enemy.hp, 100);
  assert.equal(enemy.stats.hp, 100);

  await playPlannedTurn({
    driver,
    eventBus,
    skillId: 'skill_shockwave_copy_1770042951717',
    targetId: enemy.id
  });
  assert.equal(enemy.buffs.has('buff_tear_wound'), true);
  assert.equal(enemy.buffs.getStacks('buff_bleed'), 1);
  assert.equal(enemy.hp, 95);
  assert.equal(enemy.stats.hp, 95);

  await playPlannedTurn({
    driver,
    eventBus,
    skillId: 'skill_execute_copy_1770043820577',
    targetId: enemy.id
  });
  const burstResult = findTimelineResult(eventBus, 'skill_execute_copy_1770043820577');
  assert.equal(burstResult?.actions?.[0]?.damage, 5);
  assert.equal(burstResult?.actions?.[0]?.targetHpRemaining, 90);
  assert.equal(enemy.buffs.getStacks('buff_bleed'), 2);
  assert.equal(enemy.hp, 85);
  assert.equal(enemy.stats.hp, 85);

  await playPlannedTurn({
    driver,
    eventBus,
    skillId: 'skill_execute_copy_1770044052832',
    targetId: enemy.id
  });
  const drainResult = findTimelineResult(eventBus, 'skill_execute_copy_1770044052832');
  assert.equal(drainResult?.actions?.[0]?.heal, 4);
  assert.equal(player.stats.hp, 74);
  assert.equal(enemy.hp, 85);
  assert.equal(enemy.stats.hp, 85);
  assert.equal(enemy.buffs.has('buff_bleed'), false);

  const history = driver.data.dataConfig.runtime.history;
  assert.equal(history[0].actions.length, 2);
  assert.equal(history[1].actions.length, 2);
  assert.equal(history[2].actions.length, 2);
  assert.equal(eventBus.eventsByName('TIMELINE_ERROR').length, 0);
  assert.ok(eventBus.eventsByName('BATTLE_LOG').some(event => String(event.payload?.text || '').includes('撕裂伤口')));
  assert.ok(eventBus.eventsByName('BATTLE_LOG').some(event => String(event.payload?.text || '').includes('迸发 dealt 5 HP')));
  assert.ok(eventBus.eventsByName('BATTLE_LOG').some(event => String(event.payload?.text || '').includes('吸血 healed 测试玩家 for 4 HP')));
});

test('敌人规划和执行优先使用 enemy skill catalog，不从玩家技能包取同名技能', async () => {
  const { CoreEngine } = await importCoreEngineClass();
  const { EnemyActionPlanner } = await importTurnRuntime();
  const runtime = await importBuffRuntime();
  const rawBuffs = await loadJson('buffs_v2_7.json');
  const eventBus = new TestEventBus();
  const registry = new runtime.BuffRegistry(rawBuffs.buffs);
  const system = new runtime.BuffSystem(eventBus, registry);
  system.start();
  const buffRuntime = { BuffManager: runtime.BuffManager, eventBus, registry, system };

  const player = attachBuffs(createActor('player_1', {
    hp: 100,
    maxHp: 100,
    bodyParts: createBodyParts({ chest: { current: 0, max: 0, weakness: 1 } })
  }), buffRuntime);
  const enemy = attachBuffs(createActor('enemy_1', {
    hp: 50,
    maxHp: 50,
    ap: 2,
    maxAp: 2,
    skills: ['enemy_skill_probe']
  }), buffRuntime);

  const playerSkill = {
    id: 'enemy_skill_probe',
    name: '错误的玩家同名技能',
    speed: 0,
    costs: { ap: 1 },
    target: {
      subject: 'SUBJECT_ENEMY',
      scope: 'SCOPE_PART',
      selection: { mode: 'single', candidateParts: ['chest'], selectedParts: ['chest'], selectCount: 1 }
    },
    actions: [{ effect: { effectType: 'DMG_HP', amountType: 'ABS', amount: 99 } }],
    buffRefs: { apply: [], remove: [] }
  };
  const enemySkill = {
    id: 'enemy_skill_probe',
    name: '敌人探针技能',
    speed: 0,
    costs: { ap: 1 },
    target: {
      subject: 'SUBJECT_ENEMY',
      scope: 'SCOPE_PART',
      selection: { mode: 'single', candidateParts: ['chest'], selectedParts: ['chest'], selectCount: 1 }
    },
    actions: [{ effect: { effectType: 'DMG_HP', amountType: 'ABS', amount: 7 } }],
    buffRefs: { apply: [], remove: [] }
  };

  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = eventBus;
  driver.buffRegistry = registry;
  driver.buffSystem = system;
  driver.playerSkillQueue = [];
  driver.enemySkillQueue = [];
  driver.currentHistoryEntry = null;
  driver.data = {
    playerData: player,
    currentLevelData: { enemies: [enemy] },
    getSkillConfig: skillId => (skillId === playerSkill.id ? playerSkill : null),
    getEnemySkillConfig: skillId => (skillId === enemySkill.id ? enemySkill : null)
  };
  driver.enemyPlanner = new EnemyActionPlanner({
    getSkillConfig: skillId => driver.data.getEnemySkillConfig(skillId)
  });

  const plans = driver._buildEnemyPlans();
  assert.equal(plans.length, 1);
  assert.equal(plans[0].skillName, '敌人探针技能');

  const result = driver.executeEnemySkill(plans[0]);
  assert.equal(result.ok, true);
  assert.equal(result.actions[0].damage, 7);
  assert.equal(player.stats.hp, 93);
});

test('敌人规划不会连续刷新已存在的自我增益而放弃攻击', async () => {
  const { EnemyActionPlanner } = await importTurnRuntime();
  const runtime = await importBuffRuntime();
  const rawBuffs = await loadJson('buffs_v2_7.json');
  const eventBus = new TestEventBus();
  const registry = new runtime.BuffRegistry(rawBuffs.buffs);
  const system = new runtime.BuffSystem(eventBus, registry);
  system.start();
  const buffRuntime = { BuffManager: runtime.BuffManager, eventBus, registry, system };

  const player = attachBuffs(createActor('player_1', {
    hp: 100,
    maxHp: 100,
    bodyParts: createBodyParts({ chest: { current: 0, max: 0, weakness: 1 } })
  }), buffRuntime);
  const enemy = attachBuffs(createActor('enemy_1', {
    hp: 120,
    maxHp: 120,
    ap: 4,
    maxAp: 4,
    skills: ['enemy_skill_blood_heat', 'enemy_skill_orc_club']
  }), buffRuntime);

  enemy.buffs.add('buff_lifesteal', { duration: 2 });

  const skills = {
    enemy_skill_blood_heat: {
      id: 'enemy_skill_blood_heat',
      name: '血热',
      speed: 0,
      costs: { ap: 1 },
      target: { subject: 'SUBJECT_SELF', scope: 'SCOPE_SELF' },
      actions: [],
      buffRefs: { apply: [{ target: 'self', buffId: 'buff_lifesteal', duration: 2 }], remove: [] }
    },
    enemy_skill_orc_club: {
      id: 'enemy_skill_orc_club',
      name: '重棒',
      speed: 0,
      costs: { ap: 2 },
      target: {
        subject: 'SUBJECT_ENEMY',
        scope: 'SCOPE_PART',
        selection: { mode: 'single', candidateParts: ['chest'], selectedParts: ['chest'], selectCount: 1 }
      },
      actions: [{ effect: { effectType: 'DMG_HP', amountType: 'ABS', amount: 18 } }],
      buffRefs: { apply: [], remove: [] }
    }
  };

  const planner = new EnemyActionPlanner({ getSkillConfig: skillId => skills[skillId] || null });
  const action = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts });

  assert.equal(action?.skillId, 'enemy_skill_orc_club');
});
