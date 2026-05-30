import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSkillTestScenario,
  createSkillTestRecordPath,
  enumeratePurchasableBuilds,
  generateTurnCombos,
  compactSkillTestResultForRecord,
  resolveLevelTestContext,
  simulateSkillLoop
} from '../script/editor/skill_tester/skillTesterModel.mjs';

function makeLevelsDocument() {
  return {
    levels: {
      level_1_1: {
        id: 'level_1_1',
        name: '第一关',
        flow: { kind: 'story', order: 1, nodeLabel: '1-1' },
        rewards: { kp: 1 },
        primaryEnemy: { templateId: 'enemy_a' }
      },
      level_1_2: {
        id: 'level_1_2',
        name: '第二关',
        flow: { kind: 'story', order: 2, nodeLabel: '1-2' },
        rewards: { kp: 2 },
        waves: [{ enemyPoolId: 'pool_2' }]
      },
      route_shop: {
        id: 'route_shop',
        name: '路线商店',
        flow: { kind: 'route_variant', order: 99 },
        rewards: { kp: 99 }
      }
    },
    enemyPools: {
      pool_2: {
        members: [{ templateId: 'enemy_b', position: 1 }]
      }
    }
  };
}

const enemyDocuments = [
  {
    enemy_a: {
      id: 'enemy_a',
      name: '木桩甲兵',
      stats: { hp: 40, maxHp: 40, ap: 3 },
      bodyParts: { chest: { current: 5, max: 5, weakness: 1 } }
    },
    enemy_b: {
      id: 'enemy_b',
      name: '池中敌人',
      stats: { hp: 70, maxHp: 70, ap: 4 },
      bodyParts: { chest: { current: 10, max: 10, weakness: 1 } }
    }
  }
];

test('resolveLevelTestContext uses story order, initial KP plus per-level KP assumption, and primary enemy fallback', () => {
  const context = resolveLevelTestContext({
    levelsDocument: makeLevelsDocument(),
    enemyDocuments,
    levelIndex: 2,
    kpMode: 'assumed_per_level',
    assumedInitialKp: 5,
    assumedKpPerLevel: 3
  });

  assert.equal(context.level.id, 'level_1_2');
  assert.equal(context.kpBudget, 11);
  assert.equal(context.enemy.id, 'enemy_b');
  assert.equal(context.enemy.stats.hp, 70);
  assert.equal(context.storyLevels.length, 2);
});

test('resolveLevelTestContext actual mode includes player initial skill points', () => {
  const context = resolveLevelTestContext({
    levelsDocument: makeLevelsDocument(),
    enemyDocuments,
    playerDocument: {
      default: {
        skills: {
          skillPoints: 5,
          learned: []
        }
      }
    },
    levelIndex: 2,
    kpMode: 'actual_player_plus_rewards'
  });

  assert.equal(context.initialSkillPoints, 5);
  assert.equal(context.actualThroughCurrent, 3);
  assert.equal(context.kpBudget, 8);
});

test('enumeratePurchasableBuilds respects KP budget and prerequisite closure', () => {
  const skills = [
    { id: 'skill_a', name: 'A', unlock: { cost: { kp: 1 } }, prerequisites: [], costs: { ap: 1 } },
    { id: 'skill_b', name: 'B', unlock: { cost: { kp: 2 } }, prerequisites: ['skill_a'], costs: { ap: 1 } },
    { id: 'skill_c', name: 'C', unlock: { cost: { kp: 1 } }, prerequisites: ['missing_skill'], costs: { ap: 1 } },
    { id: 'skill_d', name: 'D', unlock: { cost: { kp: 4 } }, prerequisites: ['skill_b'], costs: { ap: 2 } }
  ];

  const builds = enumeratePurchasableBuilds(skills, { kpBudget: 3, maxBuilds: 50 });
  const buildKeys = builds.map(build => build.skillIds.join(','));

  assert.ok(buildKeys.includes('skill_a,skill_b'));
  assert.equal(builds.some(build => build.skillIds.includes('skill_c')), false);
  assert.equal(builds.some(build => build.skillIds.includes('skill_d')), false);
  assert.ok(builds.every(build => build.kpUsed <= 3));
});

test('generateTurnCombos respects AP and does not repeat a skill within one turn', () => {
  const skills = [
    { id: 'a', name: 'A', costs: { ap: 1 } },
    { id: 'b', name: 'B', costs: { ap: 2 } },
    { id: 'c', name: 'C', costs: { ap: 3 } }
  ];

  const combos = generateTurnCombos(skills, { apBudget: 3, maxCombos: 20 });

  assert.ok(combos.some(combo => combo.skillIds.join(',') === 'a,b'));
  assert.ok(combos.some(combo => combo.skillIds.join(',') === 'c'));
  assert.equal(combos.some(combo => combo.skillIds.join(',') === 'a,a'), false);
  assert.ok(combos.every(combo => combo.apUsed <= 3));
  assert.ok(combos.every(combo => new Set(combo.skillIds).size === combo.skillIds.length));
});

test('simulateSkillLoop applies armor overflow to HP and settles bleed at turn end', () => {
  const skills = [
    {
      id: 'bleed_cut',
      name: '开窗斩',
      costs: { ap: 1 },
      actions: [
        {
          effect: { effectType: 'DMG_ARMOR', amountType: 'ABS', amount: 7 }
        }
      ],
      buffRefs: {
        apply: [
          {
            buffId: 'buff_bleed',
            target: 'enemy',
            params: { buff_duration: 2 },
            duration: 2,
            stackStrategy: 'extend',
            extendBy: 2
          }
        ]
      }
    },
    {
      id: 'blood_surge',
      name: '读窗斩',
      costs: { ap: 2 },
      requirements: { targetBuff: { buffId: 'buff_bleed', minRemaining: 2 } },
      actions: [
        {
          effect: {
            effectType: 'DMG_ARMOR',
            amountType: 'BUFF_REMAINING',
            amountSource: {
              owner: 'skillTarget',
              buffId: 'buff_bleed',
              multiplier: 3,
              maxRead: 4,
              missingAs: 0
            }
          }
        }
      ],
      buffRefs: {}
    }
  ];

  const result = simulateSkillLoop({
    skills,
    loopSkillIds: ['bleed_cut', 'blood_surge'],
    enemy: {
      id: 'enemy_training',
      name: '训练木桩',
      stats: { hp: 30, maxHp: 30 },
      bodyParts: { chest: { current: 5, max: 5, weakness: 1 } }
    },
    apBudget: 5,
    maxTurns: 1
  });

  assert.equal(result.turns.length, 1);
  assert.equal(result.final.enemy.hp, 17);
  assert.equal(result.final.enemy.armorTotal, 0);
  assert.equal(result.final.enemy.buffs.buff_bleed.remaining, 1);
  assert.equal(result.turns[0].delta.hp, -13);
  assert.equal(result.turns[0].delta.armor, -5);
});

test('createSkillTestRecordPath includes date and time in record directory', () => {
  const recordPath = createSkillTestRecordPath('2026-05-30-123456');
  assert.equal(
    recordPath,
    'DOC/CODEX_DOC/05_测试文档/05_Skill技能系统测试记录/2026-05-30-123456-技能测试器记录/report.json'
  );
});

test('compactSkillTestResultForRecord keeps replay evidence without bulky source objects', () => {
  const compact = compactSkillTestResultForRecord({
    context: {
      storyLevels: [{ id: 'level_1_1' }],
      level: { id: 'level_1_5', name: '密林前哨' },
      levelIndex: 5,
      kpBudget: 15,
      actualThroughCurrent: 3,
      enemyId: 'enemy_a',
      enemyName: '敌人A'
    },
    allSkillCount: 30,
    focusedSkillCount: 8,
    builds: [{ skillIds: ['a'], skills: [{ id: 'a', description: 'long' }], kpUsed: 1 }],
    candidates: [
      {
        score: 88,
        build: {
          skillIds: ['a'],
          kpUsed: 1,
          skills: [{ id: 'a', name: 'A', actions: [{ huge: true }] }]
        },
        combo: {
          skillIds: ['a'],
          apUsed: 1,
          skills: [{ id: 'a', name: 'A', actions: [{ huge: true }] }]
        },
        simulation: {
          killed: false,
          turnsToKill: null,
          metrics: { averageApUsed: 1 },
          final: { enemy: { hp: 9 } },
          findings: [{ id: 'enemy_survived', text: '未击败' }],
          turns: [{ turn: 1, usedSkillIds: ['a'], after: { hp: 9 } }]
        }
      }
    ],
    findings: [{ id: 'kp_model_gap', text: 'KP 差异' }]
  });

  assert.equal(compact.context.level.id, 'level_1_5');
  assert.equal(Object.prototype.hasOwnProperty.call(compact.context, 'storyLevels'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(compact.candidates[0].build, 'skills'), false);
  assert.deepEqual(compact.candidates[0].build.skillNames, ['A']);
  assert.deepEqual(compact.candidates[0].combo.skillNames, ['A']);
  assert.equal(compact.candidates[0].simulation.turns.length, 1);
});

test('analyzeSkillTestScenario defaults to at most ten candidate loops', () => {
  const skills = Array.from({ length: 12 }, (_, index) => ({
    id: `skill_sword_${index + 1}`,
    name: `剑技${index + 1}`,
    editorMeta: { growthTrack: 'sword', growthTier: 1 },
    unlock: { cost: { kp: 1 } },
    prerequisites: [],
    costs: { ap: 1 },
    actions: [{ effect: { effectType: 'DMG_ARMOR', amountType: 'ABS', amount: 10 } }],
    buffRefs: {}
  }));

  const result = analyzeSkillTestScenario({
    skillPack: { skills },
    levelsDocument: makeLevelsDocument(),
    enemyDocuments,
    playerDocument: { default: { skills: { skillPoints: 5, learned: [] } } },
    levelIndex: 1,
    kpMode: 'assumed_per_level',
    assumedInitialKp: 5,
    assumedKpPerLevel: 3,
    apBudget: 5,
    maxTurns: 3,
    focus: 'sword',
    maxBuilds: 30
  });

  assert.equal(result.candidates.length <= 10, true);
});
