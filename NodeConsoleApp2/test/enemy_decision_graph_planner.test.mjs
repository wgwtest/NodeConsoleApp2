import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importSourceModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  assert.equal(fs.existsSync(filePath), true, `Missing source file ${filePath}`);
  const source = await fsp.readFile(filePath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function createPlayer() {
  return {
    id: 'player_decision_probe',
    stats: { hp: 100, maxHp: 100, ap: 6 },
    bodyParts: {
      head: { current: 12, max: 20, weakness: 1.2 },
      chest: { current: 18, max: 24, weakness: 1 },
      abdomen: { current: 10, max: 18, weakness: 1.1 }
    }
  };
}

function makeAttackSkill(id, amount, ap = 2) {
  return {
    id,
    name: id,
    costs: { ap },
    speed: 0,
    target: {
      subject: 'SUBJECT_ENEMY',
      scope: 'SCOPE_PART',
      selection: { mode: 'single', candidateParts: ['head', 'chest'], selectedParts: [], selectCount: 1 }
    },
    buffRefs: { apply: [], remove: [] },
    actions: [{ effect: { effectType: 'DMG_HP', amountType: 'ABS', amount } }]
  };
}

function makeBleedSkill(id, amount, ap = 1) {
  return {
    ...makeAttackSkill(id, amount, ap),
    buffRefs: {
      apply: [{ buffId: 'buff_bleed', target: 'enemy', chance: 1, duration: 2 }],
      remove: []
    }
  };
}

function makeEnemy(enemyDecision) {
  return {
    id: 'enemy_decision_probe',
    hp: 100,
    maxHp: 100,
    stats: { ap: 3, maxAp: 3, speed: 10 },
    skills: ['heavy_attack', 'bleed_cut'],
    bodyParts: {
      head: { current: 8, max: 8, weakness: 1 },
      chest: { current: 12, max: 12, weakness: 1 }
    },
    enemyDecision
  };
}

function graphWithAction(skillId, targetRule = 'player_weak_part') {
  return {
    schemaVersion: 'enemy_decision_graph_v1',
    graph: {
      entryNodeId: 'entry',
      initialStateId: 'state_normal',
      nodes: [
        { id: 'entry', type: 'entry' },
        { id: 'state_normal', type: 'state' },
        { id: `action_${skillId}`, type: 'action', skillId, targetRule, telegraph: true }
      ],
      edges: [
        { id: 'edge_entry_state', from: 'entry', to: 'state_normal', priority: 100 },
        { id: `edge_state_${skillId}`, from: 'state_normal', to: `action_${skillId}`, priority: 100 }
      ]
    },
    layout: { nodes: {} },
    slotBindings: {}
  };
}

function graphWithLowHpBranch() {
  return {
    schemaVersion: 'enemy_decision_graph_v1',
    graph: {
      entryNodeId: 'entry',
      initialStateId: 'state_normal',
      nodes: [
        { id: 'entry', type: 'entry' },
        { id: 'state_normal', type: 'state' },
        { id: 'branch_low_hp', type: 'branch', condition: { type: 'self_hp_ratio_lte', value: 0.35 } },
        { id: 'action_bleed', type: 'action', skillId: 'bleed_cut', targetRule: 'player_weak_part' },
        { id: 'action_heavy', type: 'action', skillId: 'heavy_attack', targetRule: 'player_weak_part' }
      ],
      edges: [
        { id: 'edge_entry_state', from: 'entry', to: 'state_normal', priority: 100 },
        { id: 'edge_state_branch', from: 'state_normal', to: 'branch_low_hp', priority: 100 },
        { id: 'edge_branch_true', from: 'branch_low_hp', to: 'action_bleed', branch: 'true', priority: 100 },
        { id: 'edge_branch_false', from: 'branch_low_hp', to: 'action_heavy', branch: 'false', priority: 100 }
      ]
    },
    layout: { nodes: {} },
    slotBindings: {}
  };
}

test('EnemyActionPlanner follows enemyDecision action nodes before score ranking', async () => {
  const { default: EnemyActionPlanner } = await importSourceModule('script/engine/EnemyActionPlanner.js');
  const skills = {
    heavy_attack: makeAttackSkill('heavy_attack', 30, 2),
    bleed_cut: makeBleedSkill('bleed_cut', 4, 1)
  };
  const planner = new EnemyActionPlanner({ getSkillConfig: skillId => skills[skillId] || null });
  const player = createPlayer();
  const enemy = makeEnemy(graphWithAction('bleed_cut'));

  const action = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 1 });

  assert.equal(action?.skillId, 'bleed_cut');
  assert.equal(action?.decisionSource, 'enemyDecision');
  assert.equal(action?.decisionNodeId, 'action_bleed_cut');
  assert.equal(action?.telegraph, true);
});

test('EnemyActionPlanner resolves enemyDecision branch conditions by battle state', async () => {
  const { default: EnemyActionPlanner } = await importSourceModule('script/engine/EnemyActionPlanner.js');
  const skills = {
    heavy_attack: makeAttackSkill('heavy_attack', 30, 2),
    bleed_cut: makeBleedSkill('bleed_cut', 4, 1)
  };
  const planner = new EnemyActionPlanner({ getSkillConfig: skillId => skills[skillId] || null });
  const player = createPlayer();
  const enemy = makeEnemy(graphWithLowHpBranch());

  const highHp = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 1 });
  const lowHp = planner.planTurn({
    enemy: { ...enemy, hp: 20, stats: { ...enemy.stats, hp: 20, maxHp: 100 } },
    player,
    playerBodyParts: player.bodyParts,
    turnNumber: 1
  });

  assert.equal(highHp?.skillId, 'heavy_attack');
  assert.equal(highHp?.decisionNodeId, 'action_heavy');
  assert.equal(lowHp?.skillId, 'bleed_cut');
  assert.equal(lowHp?.decisionNodeId, 'action_bleed');
});

test('EnemyActionPlanner falls back to scoring when enemyDecision selects an illegal action', async () => {
  const { default: EnemyActionPlanner } = await importSourceModule('script/engine/EnemyActionPlanner.js');
  const skills = {
    heavy_attack: makeAttackSkill('heavy_attack', 30, 2),
    bleed_cut: makeBleedSkill('bleed_cut', 4, 5)
  };
  const planner = new EnemyActionPlanner({ getSkillConfig: skillId => skills[skillId] || null });
  const player = createPlayer();
  const enemy = makeEnemy(graphWithAction('bleed_cut'));

  const action = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 1 });

  assert.equal(action?.skillId, 'heavy_attack');
  assert.equal(action?.decisionSource, undefined);
});

test('EnemyActionPlanner ignores removed legacy behavior fields', async () => {
  const { default: EnemyActionPlanner } = await importSourceModule('script/engine/EnemyActionPlanner.js');
  const skills = {
    heavy_attack: makeAttackSkill('heavy_attack', 30, 2),
    bleed_cut: makeBleedSkill('bleed_cut', 4, 1)
  };
  const planner = new EnemyActionPlanner({ getSkillConfig: skillId => skills[skillId] || null });
  const player = createPlayer();
  const enemy = {
    ...makeEnemy(null),
    intentModel: { pattern: ['bleed'], fallback: 'bleed' },
    decisionModel: {
      mode: 'intent_priority_table',
      actions: [{ priority: 100, when: { always: true }, skillId: 'bleed_cut', intent: 'bleed' }]
    }
  };

  const action = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 1 });

  assert.equal(action?.skillId, 'heavy_attack');
  assert.equal(action?.decisionSource, undefined);
  assert.equal(action?.intentSource, undefined);
});
