import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const modelPath = path.join(projectRoot, 'script', 'editor', 'enemy', 'decision', 'EnemyDecisionGraphModel.js');

async function importModel() {
  const source = await fs.readFile(modelPath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

test('normalizeEnemyDecision creates a graph from enemy skills without legacy behavior fields', async () => {
  const { normalizeEnemyDecision } = await importModel();
  const decision = normalizeEnemyDecision({
    enemy: {
      id: 'enemy_test',
      skills: ['skill_throw_stone', 'enemy_skill_rusty_shiv']
    },
    templates: {}
  });

  assert.equal(decision.schemaVersion, 'enemy_decision_graph_v1');
  assert.equal(decision.graph.entryNodeId, 'entry');
  assert.equal(decision.graph.initialStateId, 'state_normal');
  assert.equal(decision.graph.nodes.some(node => node.type === 'entry'), true);
  assert.equal(decision.graph.nodes.some(node => node.type === 'state'), true);
  const actionSkillIds = decision.graph.nodes.filter(node => node.type === 'action').map(node => node.skillId);
  assert.equal(actionSkillIds.every(skillId => ['skill_throw_stone', 'enemy_skill_rusty_shiv'].includes(skillId)), true);
  assert.deepEqual([...new Set(actionSkillIds)], ['skill_throw_stone', 'enemy_skill_rusty_shiv']);
  assert.equal(decision.layout.nodes.state_normal.x, 410);
  assert.equal(decision.layout.nodes.state_normal.y, 132);
});

test('normalizeEnemyDecision ignores removed legacy intent and decision fields', async () => {
  const { normalizeEnemyDecision } = await importModel();
  const decision = normalizeEnemyDecision({
    enemy: {
      id: 'enemy_test',
      skills: ['skill_throw_stone'],
      intentModel: { pattern: ['attack', 'bleed'], fallback: 'attack' },
      decisionModel: {
        actions: [
          {
            priority: 100,
            when: { always: true },
            skillId: 'legacy_bleed_skill',
            targetRule: 'player_weak_part'
          }
        ]
      }
    },
    templates: {}
  });

  assert.deepEqual(
    decision.graph.nodes.filter(node => node.type === 'action').map(node => node.skillId),
    ['skill_throw_stone']
  );
  assert.equal(decision.graph.nodes.some(node => node.skillId === 'legacy_bleed_skill'), false);
});

test('validateEnemyDecision rejects missing skill bindings and branch exits', async () => {
  const { validateEnemyDecision } = await importModel();
  const issues = validateEnemyDecision({
    decision: {
      schemaVersion: 'enemy_decision_graph_v1',
      graph: {
        entryNodeId: 'entry',
        initialStateId: 'state_normal',
        nodes: [
          { id: 'entry', type: 'entry' },
          { id: 'state_normal', type: 'state', fallbackNodeId: 'action_missing' },
          { id: 'branch_low_hp', type: 'branch', condition: { type: 'self_hp_ratio_lte', value: 0.35 } },
          { id: 'action_missing', type: 'action', skillId: 'missing_skill', targetRule: 'player_weak_part' }
        ],
        edges: [
          { id: 'edge_entry_state', from: 'entry', to: 'state_normal' },
          { id: 'edge_state_branch', from: 'state_normal', to: 'branch_low_hp' },
          { id: 'edge_branch_true', from: 'branch_low_hp', to: 'action_missing', branch: 'true' }
        ]
      }
    },
    enemy: { skills: ['skill_throw_stone'] },
    resolveSkill: () => null
  });

  assert.equal(issues.some(issue => issue.code === 'branch_missing_false_exit'), true);
  assert.equal(issues.some(issue => issue.code === 'missing_skill_binding'), true);
});

test('previewEnemyDecision returns turn traces and fallback reasons', async () => {
  const { normalizeEnemyDecision, previewEnemyDecision } = await importModel();
  const decision = normalizeEnemyDecision({
    enemy: {
      id: 'enemy_test',
      skills: ['skill_throw_stone']
    }
  });
  const result = previewEnemyDecision({
    decision,
    enemy: { id: 'enemy_test', stats: { hp: 10, maxHp: 10, ap: 0 }, skills: ['skill_throw_stone'] },
    resolveSkill: () => ({ id: 'skill_throw_stone', costs: { ap: 2 } }),
    turns: 1
  });

  assert.equal(result.traces.length, 1);
  assert.equal(result.traces[0].fallbacks.some(item => item.reason === 'skill_ap_too_high'), true);
});

test('skill-driven action nodes explicitly flow back to the initial state', async () => {
  const { normalizeEnemyDecision, previewEnemyDecision } = await importModel();
  const decision = normalizeEnemyDecision({
    enemy: {
      id: 'enemy_test',
      skills: ['skill_throw_stone']
    }
  });
  const action = decision.graph.nodes.find(node => node.type === 'action');

  assert.equal(action.nextStateId, 'state_normal');

  const result = previewEnemyDecision({
    decision,
    enemy: { id: 'enemy_test', stats: { hp: 10, maxHp: 10, ap: 4 }, skills: ['skill_throw_stone'] },
    resolveSkill: () => ({ id: 'skill_throw_stone', costs: { ap: 2 } }),
    turns: 1
  });

  assert.equal(result.traces[0].nextStateId, 'state_normal');
  assert.equal(result.traces[0].endStateId, 'state_normal');
});

test('normalizeEnemyDecision builds the v3 activity-diagram decision chain for throw and bleed enemies', async () => {
  const { normalizeEnemyDecision, previewEnemyDecision } = await importModel();
  const decision = normalizeEnemyDecision({
    enemy: {
      id: 'enemy_test',
      skills: ['skill_throw_stone', 'enemy_skill_rusty_shiv']
    }
  });

  const nodeIds = decision.graph.nodes.map(node => node.id);
  assert.deepEqual(
    nodeIds.filter(id => id.startsWith('branch_')),
    ['branch_low_hp', 'branch_far_target', 'branch_target_missing_bleed']
  );
  assert.deepEqual(
    nodeIds.filter(id => id.startsWith('action_')),
    ['action_conservative_throw', 'action_far_throw', 'action_rusty_shiv', 'action_fallback_throw']
  );
  assert.deepEqual(
    decision.graph.nodes.filter(node => node.type === 'branch').map(node => node.condition?.type),
    ['self_hp_ratio_lte', 'target_distance_gte', 'target_missing_status']
  );
  assert.equal(decision.graph.edges.some(edge => edge.from === 'branch_target_missing_bleed' && edge.to === 'action_rusty_shiv' && edge.branch === 'true'), true);
  assert.equal(decision.graph.edges.some(edge => edge.from === 'branch_target_missing_bleed' && edge.to === 'action_fallback_throw' && edge.branch === 'false'), true);

  const highHpFarMissingBleed = previewEnemyDecision({
    decision,
    enemy: { id: 'enemy_test', stats: { hp: 10, maxHp: 10, ap: 4 }, skills: ['skill_throw_stone', 'enemy_skill_rusty_shiv'] },
    resolveSkill: skillId => ({ id: skillId, costs: { ap: 1 } }),
    context: { targetDistance: 3, targetStatuses: [] },
    turns: 1
  });
  assert.deepEqual(
    highHpFarMissingBleed.traces[0].visitedNodes,
    ['state_normal', 'branch_low_hp', 'branch_far_target', 'action_far_throw']
  );

  const highHpCloseMissingBleed = previewEnemyDecision({
    decision,
    enemy: { id: 'enemy_test', stats: { hp: 10, maxHp: 10, ap: 4 }, skills: ['skill_throw_stone', 'enemy_skill_rusty_shiv'] },
    resolveSkill: skillId => ({ id: skillId, costs: { ap: 1 } }),
    context: { targetDistance: 1, targetStatuses: [] },
    turns: 1
  });
  assert.deepEqual(
    highHpCloseMissingBleed.traces[0].visitedNodes,
    ['state_normal', 'branch_low_hp', 'branch_far_target', 'branch_target_missing_bleed', 'action_rusty_shiv']
  );
});

test('normalizeEnemyDecision replaces pre-v3 enemyDecision graphs with the v3 activity diagram when skills support it', async () => {
  const { normalizeEnemyDecision } = await importModel();
  const decision = normalizeEnemyDecision({
    enemy: {
      id: 'enemy_test',
      skills: ['skill_throw_stone', 'enemy_skill_rusty_shiv'],
      enemyDecision: {
        schemaVersion: 'enemy_decision_graph_v1',
        graph: {
          entryNodeId: 'entry',
          initialStateId: 'state_normal',
          nodes: [
            { id: 'entry', type: 'entry', label: 'Start' },
            { id: 'state_normal', type: 'state', label: 'Normal' },
            { id: 'action_skill_throw_stone', type: 'action', skillId: 'skill_throw_stone' },
            { id: 'action_enemy_skill_rusty_shiv', type: 'action', skillId: 'enemy_skill_rusty_shiv' }
          ],
          edges: [
            { id: 'edge_entry_state', from: 'entry', to: 'state_normal' },
            { id: 'edge_state_throw', from: 'state_normal', to: 'action_skill_throw_stone' },
            { id: 'edge_state_shiv', from: 'state_normal', to: 'action_enemy_skill_rusty_shiv' }
          ]
        },
        layout: {
          nodes: {
            entry: { x: 40, y: 80 },
            state_normal: { x: 260, y: 80 },
            action_skill_throw_stone: { x: 620, y: 48 },
            action_enemy_skill_rusty_shiv: { x: 620, y: 180 }
          }
        }
      }
    }
  });

  assert.equal(decision.layout.activityDiagramVersion, 3);
  assert.equal(decision.graph.nodes.some(node => node.id === 'action_skill_throw_stone'), false);
  assert.deepEqual(
    decision.graph.nodes.filter(node => node.type === 'branch').map(node => node.id),
    ['branch_low_hp', 'branch_far_target', 'branch_target_missing_bleed']
  );
  assert.deepEqual(
    decision.graph.nodes.filter(node => node.type === 'action').map(node => node.id),
    ['action_conservative_throw', 'action_far_throw', 'action_rusty_shiv', 'action_fallback_throw']
  );
  assert.deepEqual(decision.layout.nodes.action_fallback_throw, { x: 196, y: 506 });
});
