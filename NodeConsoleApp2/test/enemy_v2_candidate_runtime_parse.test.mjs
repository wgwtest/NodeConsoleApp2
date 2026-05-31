import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

const expectedStoryLevelIds = Array.from({ length: 3 }, (_, chapterIndex) => {
  const chapter = chapterIndex + 1;
  return Array.from({ length: 10 }, (_, levelIndex) => `level_${chapter}_${levelIndex + 1}`);
}).flat();

async function readJson(relativePath) {
  return JSON.parse(await fsp.readFile(path.join(projectRoot, relativePath), 'utf8'));
}

async function importSourceModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  assert.equal(fs.existsSync(filePath), true, `Missing source file ${filePath}`);
  let source = await fsp.readFile(filePath, 'utf8');
  source = source.replace(
    /^import\s+\{\s*buildContentPackOverrideKey,\s*getContentPackOverride\s*\}\s+from\s+'..\/tooling\/ContentPackOverrideStore\.js';\s*/u,
    'const buildContentPackOverrideKey = (contentKey, scopeId = null) => scopeId ? `${contentKey}:${scopeId}` : contentKey;\nconst getContentPackOverride = () => null;\n'
  );
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildCandidateLevelDocument(levelsDocument, candidateEnemies) {
  const nextDocument = clone(levelsDocument);
  const levels = asObject(nextDocument.levels);
  const enemyPools = asObject(nextDocument.enemyPools);
  const candidateByLevel = new Map(
    Object.values(candidateEnemies)
      .filter(enemy => typeof enemy?.candidateForLevel === 'string')
      .map(enemy => [enemy.candidateForLevel, enemy])
  );

  for (const levelId of expectedStoryLevelIds) {
    const level = levels[levelId];
    assert(level, `Missing story level ${levelId}`);
    const candidate = candidateByLevel.get(levelId);
    assert(candidate, `Missing candidate enemy for ${levelId}`);

    level.primaryEnemy = {
      ...(asObject(level.primaryEnemy)),
      templateId: candidate.id
    };

    const poolId = level.waves?.[0]?.enemyPoolId;
    assert.equal(typeof poolId, 'string', `${levelId} must reference an enemy pool`);
    assert(enemyPools[poolId], `${levelId} references missing enemy pool ${poolId}`);
    enemyPools[poolId].members = [
      {
        templateId: candidate.id,
        position: 1,
        weight: 1,
        role: 'primary'
      }
    ];
  }

  return nextDocument;
}

test('EnemyWorkspace parses the V2 candidate pack and preserves design-only fields', async () => {
  const candidateEnemies = await readJson('assets/enemy_packs/authoring/enemies_20260531_000000.json');
  const enemySkillPack = await readJson('assets/data/skills_enemy_v1.json');
  const { EnemyWorkspace } = await importSourceModule('script/editor/enemy/EnemyWorkspace.js');

  const workspace = new EnemyWorkspace(candidateEnemies, { skillCatalog: enemySkillPack });
  const missingSkills = workspace.validateDocument()
    .filter(issue => issue.code === 'missing_skill_reference')
    .map(issue => `${issue.enemyId}:${issue.refId}`);
  const exported = workspace.exportDocument();

  assert.deepEqual(missingSkills, []);
  assert.equal(workspace.listEnemies().length, 30);
  for (const [enemyId, sourceEnemy] of Object.entries(candidateEnemies)) {
    assert.deepEqual(exported[enemyId].capabilities, sourceEnemy.capabilities, `${enemyId} capabilities lost`);
    assert.deepEqual(exported[enemyId].intentModel, sourceEnemy.intentModel, `${enemyId} intentModel lost`);
    assert.deepEqual(exported[enemyId].runPressure, sourceEnemy.runPressure, `${enemyId} runPressure lost`);
    assert.deepEqual(exported[enemyId].statePersistence, sourceEnemy.statePersistence, `${enemyId} statePersistence lost`);
  }
});

test('DataManagerV2 instantiates all story levels against the V2 candidate pack', async () => {
  const candidateEnemies = await readJson('assets/enemy_packs/authoring/enemies_20260531_000000.json');
  const levelsDocument = await readJson('assets/map_packs/current/story_pack_v1/levels.json');
  const candidateLevelsDocument = buildCandidateLevelDocument(levelsDocument, candidateEnemies);
  const { default: dm } = await importSourceModule('script/engine/DataManagerV2.js');

  dm.gameConfig = {
    enemies: candidateEnemies,
    levels: dm._expandLevelEnemyPools(candidateLevelsDocument)
  };
  dm.levelCatalog = null;

  for (const levelId of expectedStoryLevelIds) {
    const runtimeLevel = dm.instantiateLevel(levelId);
    assert(runtimeLevel, `${levelId} should instantiate`);
    assert.equal(runtimeLevel.enemies.length, 1, `${levelId} should instantiate one candidate enemy`);

    const enemy = runtimeLevel.enemies[0];
    const templateId = candidateLevelsDocument.enemyPools[levelId.replace('level_', 'enemy_pool_')]?.members?.[0]?.templateId
      || candidateLevelsDocument.levels[levelId].primaryEnemy.templateId;
    const template = candidateEnemies[templateId];

    assert(template, `${levelId} should point at a candidate template`);
    assert.equal(enemy.id.startsWith(`${template.id}_`), true, `${levelId} runtime id should derive from template id`);
    assert.equal(enemy.hp, template.stats.hp, `${levelId} should initialize hp`);
    assert.equal(enemy.maxHp, template.stats.maxHp, `${levelId} should initialize maxHp`);
    assert.equal(enemy.stats.maxAp, template.stats.ap, `${levelId} should derive maxAp from ap`);
    assert.deepEqual(enemy.capabilities, template.capabilities, `${levelId} should preserve capabilities`);
    assert.deepEqual(enemy.intentModel, template.intentModel, `${levelId} should preserve intentModel`);

    for (const [partId, part] of Object.entries(enemy.bodyParts || {})) {
      assert.equal(typeof part.max, 'number', `${levelId}.${partId} should have runtime max armor`);
      assert.equal(typeof part.current, 'number', `${levelId}.${partId} should have runtime current armor`);
      assert.equal(part.current <= part.max, true, `${levelId}.${partId} current armor must not exceed max`);
      assert.equal(part.status, 'NORMAL', `${levelId}.${partId} should initialize body part status`);
    }
  }
});

test('EnemyActionPlanner can plan first-turn actions for V2 candidate enemies', async () => {
  const candidateEnemies = await readJson('assets/enemy_packs/authoring/enemies_20260531_000000.json');
  const enemySkillPack = await readJson('assets/data/skills_enemy_v1.json');
  const enemySkillMap = new Map((enemySkillPack.skills || []).map(skill => [skill.id, skill]));
  const { default: EnemyActionPlanner } = await importSourceModule('script/engine/EnemyActionPlanner.js');
  const planner = new EnemyActionPlanner({
    getSkillConfig: skillId => enemySkillMap.get(skillId) || null
  });
  const player = {
    id: 'player_v2_parse_probe',
    stats: { hp: 100, maxHp: 100, ap: 6, speed: 10 },
    bodyParts: {
      head: { current: 12, max: 20, weakness: 1.2 },
      chest: { current: 18, max: 24, weakness: 1 },
      abdomen: { current: 10, max: 18, weakness: 1.1 },
      arm: { current: 8, max: 16, weakness: 1 },
      leg: { current: 6, max: 16, weakness: 1 }
    }
  };

  const planningIssues = [];
  for (const [enemyId, enemy] of Object.entries(candidateEnemies)) {
    const action = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts });
    const enemyAp = Number(enemy.stats?.ap ?? 0) || 0;
    if (!action?.skillId || !action.targetId) {
      planningIssues.push(`${enemyId}: no action`);
    } else if ((Number(action.cost ?? 0) || 0) > enemyAp) {
      planningIssues.push(`${enemyId}: ${action.skillId} cost ${action.cost} > ap ${enemyAp}`);
    }
  }

  assert.deepEqual(planningIssues, []);
});
