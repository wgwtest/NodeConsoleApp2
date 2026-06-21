import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const modelPath = path.join(projectRoot, 'script', 'editor', 'enemy', 'decision', 'toolSpike', 'EnemyDecisionToolSpikeModel.js');
const htmlPath = path.join(projectRoot, 'test', 'enemy_decision_tool_spike.html');

async function importModel() {
  const source = await fs.readFile(modelPath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

test('tool spike scenario describes the same enemy decision graph for all three candidates', async () => {
  const { createDecisionToolSpikeScenario } = await importModel();
  const scenario = createDecisionToolSpikeScenario();

  assert.equal(scenario.title, '敌人决策工具选型原型');
  assert.deepEqual(
    scenario.tools.map(tool => tool.id),
    ['logicflow', 'maxgraph', 'rete']
  );

  const nodeTypes = new Set(scenario.nodes.map(node => node.type));
  assert.equal(nodeTypes.has('entry'), true);
  assert.equal(nodeTypes.has('state'), true);
  assert.equal(nodeTypes.has('branch'), true);
  assert.equal(nodeTypes.has('action'), true);
  assert.equal(nodeTypes.has('merge'), true);
  assert.equal(nodeTypes.has('endTurn'), true);
  assert.equal(nodeTypes.has('end'), true);

  assert.equal(scenario.nodes.some(node => node.label === '默认状态'), true);
  assert.equal(scenario.nodes.some(node => node.label === '目标未流血?'), true);
  assert.equal(scenario.edges.some(edge => edge.kind === 'loop' && edge.to === 'state_normal'), true);
});

test('activity auto layout creates a readable vertical trunk with outside loop rail', async () => {
  const {
    createActivityAutoLayout,
    createDecisionToolSpikeScenario
  } = await importModel();
  const scenario = createDecisionToolSpikeScenario();
  const layout = createActivityAutoLayout(scenario);
  const nodes = layout.nodesById;

  const trunkIds = [
    'entry',
    'state_normal',
    'branch_low_hp',
    'branch_far_target',
    'branch_target_missing_bleed',
    'merge',
    'end_turn',
    'end'
  ];
  const trunkX = nodes.entry.x;
  assert.deepEqual(
    trunkIds.map(id => nodes[id].x),
    trunkIds.map(() => trunkX)
  );

  const trunkY = trunkIds.map(id => nodes[id].y);
  assert.deepEqual(
    [...trunkY].sort((a, b) => a - b),
    trunkY
  );

  assert.ok(nodes.action_conservative_throw.x > trunkX);
  assert.ok(nodes.action_far_throw.x > trunkX);
  assert.ok(nodes.action_rusty_shiv.x > trunkX);
  assert.ok(nodes.action_fallback_throw.x < trunkX);

  const entryToState = layout.edgeRoutes.edge_entry_state;
  const stateToHp = layout.edgeRoutes.edge_state_low_hp;
  assert.equal(entryToState.length, 2);
  assert.equal(stateToHp.length, 2);
  assert.equal(entryToState[0].x, trunkX);
  assert.equal(entryToState[1].x, trunkX);
  assert.equal(stateToHp[0].x, trunkX);
  assert.equal(stateToHp[1].x, trunkX);
  assert.equal(entryToState[1].y, nodes.state_normal.y - nodes.state_normal.height / 2);
  assert.equal(stateToHp[0].y, nodes.state_normal.y + nodes.state_normal.height / 2);

  const loopEdges = scenario.edges.filter(edge => edge.kind === 'loop');
  assert.equal(loopEdges.length, 1);
  assert.equal(loopEdges[0].to, 'state_normal');

  const loopRoute = layout.edgeRoutes[loopEdges[0].id];
  const loopMinX = Math.min(...loopRoute.map(point => point.x));
  const fallbackLeft = nodes.action_fallback_throw.x - nodes.action_fallback_throw.width / 2;
  assert.ok(loopMinX < fallbackLeft);
  assert.equal(loopRoute[loopRoute.length - 1].x, nodes.state_normal.x - nodes.state_normal.width / 2);
});

test('tool spike html exposes isolated mounts for LogicFlow, maxGraph, and Rete', async () => {
  const html = await fs.readFile(htmlPath, 'utf8');

  assert.match(html, /id="logicflowMount"/u);
  assert.match(html, /id="maxgraphMount"/u);
  assert.match(html, /id="reteMount"/u);
  assert.match(html, /EnemyDecisionToolSpikePage\.js/u);
});
