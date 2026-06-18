import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const candidatePath = path.join(
  projectRoot,
  'assets',
  'enemy_packs',
  'authoring',
  'enemies_20260531_000000.json'
);

const expectedStoryLevelIds = Array.from({ length: 3 }, (_, chapterIndex) => {
  const chapter = chapterIndex + 1;
  return Array.from({ length: 10 }, (_, levelIndex) => `level_${chapter}_${levelIndex + 1}`);
}).flat();

const standardBodyParts = ['head', 'chest', 'abdomen', 'arm', 'leg'];

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), 'utf8'));
}

function unwrapEnemies(document) {
  return document?.enemies && typeof document.enemies === 'object'
    ? document.enemies
    : document;
}

test('enemy V2 candidate pack declares a standard data contract for editors', async () => {
  const candidatePack = await readJson('assets/enemy_packs/authoring/enemies_20260531_000000.json');

  assert.equal(candidatePack.$schemaVersion, 'enemies_v2_1');
  assert.equal(candidatePack.meta?.contentDomain, 'enemy');
  assert.equal(candidatePack.meta?.selectedPackId, 'enemy_v2_story');
  assert.equal(candidatePack.enemies && typeof candidatePack.enemies === 'object', true);

  const enums = candidatePack.meta?.enums || {};
  for (const enumKey of [
    'races',
    'classes',
    'tags',
    'capabilityTypes',
    'bodyParts',
    'capabilityCadences',
    'capabilityPressures',
    'counterplay',
    'decisionConditionTypes',
    'decisionTargetRules',
    'decisionGraphTemplateIds',
    'enemySkillIds'
  ]) {
    assert.equal(Array.isArray(enums[enumKey]), true, `meta.enums.${enumKey} must be an array`);
    assert.equal(enums[enumKey].length > 0, true, `meta.enums.${enumKey} must not be empty`);
  }

  assert.equal(enums.races.includes('goblin'), true);
  assert.equal(enums.classes.includes('scout'), true);
  assert.equal(enums.tags.includes('v2_candidate'), true);
  assert.equal(enums.capabilityTypes.includes('telegraph_countdown'), true);
  assert.equal(enums.capabilityCadences.includes('intent_loop_slot'), false, 'capability cadence should not mention removed intent loop slots');
  for (const unsupportedTrigger of [
    'after_counter',
    'after_mark',
    'hp_50_percent',
    'armor_break_phase',
    'phase_2',
    'phase_2_windup',
    'phase_3',
    'three_phases'
  ]) {
    assert.equal(
      enums.capabilityCadences.includes(unsupportedTrigger),
      false,
      `meta.enums.capabilityCadences must not expose unsupported runtime trigger ${unsupportedTrigger}`
    );
  }
  assert.equal('intentTokens' in enums, false, 'enemy pack should not declare removed intentTokens');
  assert.equal('decisionModelModes' in enums, false, 'enemy pack should not declare removed decisionModelModes');
  assert.equal('decisionWhenTypes' in enums, false, 'enemy pack should not declare removed decisionWhenTypes');
  assert.equal(enums.decisionConditionTypes.includes('always'), true);
  assert.equal(enums.decisionConditionTypes.includes('self_hp_ratio_lte'), true);
  assert.equal('runPressureTypes' in enums, false, 'enemy pack should not declare enemy-level runPressureTypes');
  assert.equal('carryoverImpact' in enums, false, 'enemy pack should not declare enemy-level carryoverImpact');
  assert.equal('carryOver' in enums, false, 'enemy pack should not declare enemy-level carryOver');
  assert.equal('clearAfterBattle' in enums, false, 'enemy pack should not declare enemy-level clearAfterBattle');
  const fieldNotes = candidatePack.meta?.fieldNotes || {};
  for (const fieldKey of [
    'enemies.*.race',
    'enemies.*.class',
    'enemies.*.tags[]',
    'enemies.*.capabilities[].type',
    'enemies.*.capabilities[].cadence',
    'enemies.*.capabilities[].pressure',
    'enemies.*.capabilities[].counterplay[]',
    'enemies.*.enemyDecision.schemaVersion',
    'enemies.*.enemyDecision.graph.nodes[]',
    'enemies.*.enemyDecision.graph.edges[]',
    'enemies.*.enemyDecision.slotBindings',
    'enemies.*.enemyDecision.layout.nodes'
  ]) {
    assert.equal(typeof fieldNotes[fieldKey], 'string', `meta.fieldNotes.${fieldKey} must explain edit rules`);
  }
  for (const fieldKey of [
    'enemies.*.intentModel.pattern[]',
    'enemies.*.decisionModel.mode',
    'enemies.*.decisionModel.intentTimeline[]',
    'enemies.*.decisionModel.actions[].when',
    'enemies.*.decisionModel.actions[].intent',
    'enemies.*.decisionModel.actions[].skillId',
    'enemies.*.runPressure.type',
    'enemies.*.runPressure.carryoverImpact[]',
    'enemies.*.runPressure.counterplay[]',
    'enemies.*.statePersistence.carryOver[]',
    'enemies.*.statePersistence.clearAfterBattle[]'
  ]) {
    assert.equal(fieldKey in fieldNotes, false, `meta.fieldNotes.${fieldKey} should be removed`);
  }
});

test('enemy V2 候选包为 30 个正式关卡生成机制化主敌', async () => {
  const candidatePack = await readJson('assets/enemy_packs/authoring/enemies_20260531_000000.json');
  const candidateEnemies = unwrapEnemies(candidatePack);
  const enemySkills = await readJson('assets/data/skills_enemy_v1.json');
  const skillIds = new Set((enemySkills.skills || []).map(skill => skill.id));
  const enemies = Object.values(candidateEnemies);

  assert.equal(enemies.length, 30, '候选包应包含 30 个 V2 主敌');
  assert.deepEqual(
    enemies.map(enemy => enemy.candidateForLevel).sort(),
    expectedStoryLevelIds.sort(),
    '候选包应一一覆盖 30 个正式 story 关卡'
  );

  for (const enemy of enemies) {
    assert.match(enemy.name || '', /[\u4e00-\u9fff]/u, `${enemy.id} should use a Chinese display name`);
    assert.match(enemy.id, /^(enemy|boss)_v2_c[123]_\d{2}_/u, `${enemy.id} 应使用 V2 章节语义 ID`);
    assert.equal(enemy.tags?.includes('v2_candidate'), true, `${enemy.id} 应标记为候选敌人`);
    assert.equal(enemy.stats?.hp > 0, true, `${enemy.id} 应有 HP`);
    assert.equal(enemy.stats?.ap > 0, true, `${enemy.id} 应有 AP`);
    assert.deepEqual(Object.keys(enemy.bodyParts || {}).sort(), standardBodyParts.sort(), `${enemy.id} 应使用标准部位`);

    assert.equal(typeof enemy.mechanicProfile?.slotId, 'string', `${enemy.id} 应声明机制槽位`);
    assert.equal(Array.isArray(enemy.capabilities), true, `${enemy.id} 应声明敌人自身能力`);
    assert.equal(enemy.capabilities.length >= 1, true, `${enemy.id} 至少需要一个自身能力`);
    for (const capability of enemy.capabilities) {
      assert.equal(typeof capability.type, 'string', `${enemy.id} capability 应有 type`);
      assert.equal(
        candidatePack.meta.enums.capabilityCadences.includes(capability.cadence),
        true,
        `${enemy.id} capability cadence must come from meta.enums.capabilityCadences`
      );
      assert.equal(
        candidatePack.meta.enums.capabilityPressures.includes(capability.pressure),
        true,
        `${enemy.id} capability pressure must come from meta.enums.capabilityPressures`
      );
      assert.equal(Array.isArray(capability.counterplay), true, `${enemy.id} capability 应有 counterplay`);
      for (const counterplay of capability.counterplay) {
        assert.equal(
          candidatePack.meta.enums.counterplay.includes(counterplay),
          true,
          `${enemy.id} capability counterplay must come from meta.enums.counterplay`
        );
      }
    }

    assert.equal('intentModel' in enemy, false, `${enemy.id} should not declare removed intentModel`);
    assert.equal('decisionModel' in enemy, false, `${enemy.id} should not declare removed decisionModel`);
    assert.equal(enemy.enemyDecision?.schemaVersion, 'enemy_decision_graph_v1', `${enemy.id} should declare enemyDecision`);
    assert.equal(Array.isArray(enemy.enemyDecision.graph?.nodes), true, `${enemy.id} enemyDecision nodes should be an array`);
    assert.equal(Array.isArray(enemy.enemyDecision.graph?.edges), true, `${enemy.id} enemyDecision edges should be an array`);
    assert.equal(enemy.enemyDecision.graph.nodes.some(node => node.type === 'entry'), true, `${enemy.id} enemyDecision needs entry node`);
    assert.equal(enemy.enemyDecision.graph.nodes.some(node => node.type === 'state'), true, `${enemy.id} enemyDecision needs state node`);
    const actionNodes = enemy.enemyDecision.graph.nodes.filter(node => node.type === 'action');
    assert.equal(actionNodes.length >= enemy.skills.length, true, `${enemy.id} enemyDecision action nodes should cover enemy skills`);
    for (const action of actionNodes) {
      assert.equal(skillIds.has(action.skillId), true, `${enemy.id} action node references missing skill ${action.skillId}`);
      assert.equal(candidatePack.meta.enums.enemySkillIds.includes(action.skillId), true, `${enemy.id} action node skillId must come from meta.enums.enemySkillIds`);
      assert.equal(enemy.skills.includes(action.skillId), true, `${enemy.id} action node must reference this enemy skills[] ${action.skillId}`);
      assert.equal(typeof action.targetRule, 'string', `${enemy.id} action node should have targetRule`);
      assert.equal(candidatePack.meta.enums.decisionTargetRules.includes(action.targetRule), true, `${enemy.id} action node targetRule must come from meta.enums.decisionTargetRules`);
    }
    assert.equal('runPressure' in enemy, false, `${enemy.id} should not declare enemy-level runPressure`);
    assert.equal('statePersistence' in enemy, false, `${enemy.id} should not declare enemy-level statePersistence`);

    assert.equal(Array.isArray(enemy.skills), true, `${enemy.id} 应引用敌技`);
    assert.equal(enemy.skills.length >= 2, true, `${enemy.id} 至少需要 2 个技能引用`);
    for (const skillId of enemy.skills) {
      assert.equal(skillIds.has(skillId), true, `${enemy.id} 引用了不存在的敌技 ${skillId}`);
    }
  }
});
