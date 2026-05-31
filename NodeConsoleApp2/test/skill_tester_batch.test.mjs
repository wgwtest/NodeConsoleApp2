import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBatchSkillTestReport,
  createSkillTesterBatchRoot
} from '../tools/skill_tester_batch.mjs';

function makeLevelsDocument() {
  return {
    enemyPools: {
      pool_level_1_2_primary: {
        members: [{ templateId: 'enemy_training_b' }]
      }
    },
    levels: {
      level_1_1: {
        id: 'level_1_1',
        name: '第一关',
        flow: { kind: 'story', order: 1, nodeLabel: '1-1' },
        primaryEnemy: { templateId: 'enemy_training_a' },
        rewards: { kp: 3 }
      },
      level_1_2: {
        id: 'level_1_2',
        name: '第二关',
        flow: { kind: 'story', order: 2, nodeLabel: '1-2' },
        waves: [{ enemyPoolId: 'pool_level_1_2_primary' }],
        rewards: { kp: 3 }
      },
      route_shop: {
        id: 'route_shop',
        name: '路线商店',
        flow: { kind: 'route_variant', order: 99 },
        rewards: { kp: 30 }
      }
    }
  };
}

const enemyDocuments = [
  {
    enemy_training_a: {
      id: 'enemy_training_a',
      name: '训练木桩 A',
      stats: { hp: 10, maxHp: 10, ap: 0 },
      bodyParts: { chest: { current: 0, max: 0, weakness: 1 } }
    },
    enemy_training_b: {
      id: 'enemy_training_b',
      name: '训练木桩 B',
      stats: { hp: 10, maxHp: 10, ap: 0 },
      bodyParts: { chest: { current: 0, max: 0, weakness: 1 } }
    }
  }
];

const skillPack = {
  skills: [
    {
      id: 'skill_hit',
      name: '稳定打击',
      editorMeta: { growthTrack: 'sword', growthTier: 1 },
      unlock: { cost: { kp: 1 } },
      prerequisites: [],
      costs: { ap: 1 },
      actions: [{ effect: { effectType: 'DMG_HP', amountType: 'ABS', amount: 10 } }],
      buffRefs: {}
    }
  ]
};

test('createSkillTesterBatchRoot uses one timestamped batch directory', () => {
  assert.equal(
    createSkillTesterBatchRoot('2026-05-31-121314'),
    'DOC/CODEX_DOC/05_测试文档/05_Skill技能系统测试记录/2026-05-31-121314-30关技能测试批量记录'
  );
});

test('buildBatchSkillTestReport runs story levels with each level original enemy and keeps raw record paths', () => {
  const batch = buildBatchSkillTestReport({
    timestamp: '2026-05-31-121314',
    sources: {
      skillPackPath: 'skill.json',
      buffPackPath: 'buff.json',
      levelsPath: 'levels.json',
      enemyPath: 'enemies.json',
      playerPath: 'player.json'
    },
    skillPack,
    buffPack: { buffs: [] },
    levelsDocument: makeLevelsDocument(),
    enemyDocuments,
    playerDocument: { default: { skills: { skillPoints: 5, learned: [] } } },
    scenario: {
      kpMode: 'actual_player_plus_rewards',
      apBudget: 5,
      maxTurns: 3,
      focus: 'sword',
      maxBuilds: 1
    }
  });

  assert.equal(batch.summary.levels.length, 2);
  assert.equal(batch.records.length, 2);
  assert.equal(batch.summary.aggregates.levelCount, 2);
  assert.equal(batch.summary.aggregates.killedCount, 2);
  assert.equal(batch.summary.aggregates.enemyMode, 'level_primary');
  assert.equal(batch.summary.scenario.testType, 'result_optimization');
  assert.deepEqual(batch.summary.aggregates.enemyIds, ['enemy_training_a', 'enemy_training_b']);
  assert.equal(batch.summary.levels[0].enemyId, 'enemy_training_a');
  assert.equal(batch.summary.levels[1].enemyId, 'enemy_training_b');
  assert.equal(batch.summary.levels[0].best.killed, true);
  assert.ok(batch.summary.conclusions.some(item => item.includes('全部 2 个关卡')));
  assert.ok(batch.summary.conclusions.some(item => item.includes('maxBuilds=1')));
  assert.match(batch.records[0].path, /levels\/01-level_1_1\/report\.json/u);
  assert.equal(batch.records[0].record.scenario.enemyIdOverride, undefined);
});
