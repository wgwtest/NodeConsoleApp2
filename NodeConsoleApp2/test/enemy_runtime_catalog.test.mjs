import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const runtimeEnemyPath = path.join(projectRoot, 'assets', 'enemy_packs', 'current', 'enemies.json');
const dataConfigPath = path.join(projectRoot, 'assets', 'data', 'config.json');
const authoringEnemyRoot = path.join(projectRoot, 'assets', 'enemy_packs', 'authoring');
const runtimeLevelPaths = [
  path.join(projectRoot, 'assets', 'data', 'levels.json'),
  path.join(projectRoot, 'assets', 'map_packs', 'current', 'story_pack_v1', 'levels.json'),
  path.join(projectRoot, 'assets', 'map_packs', 'authoring', 'story_pack_v1', 'levels.json')
];
const runtimeMapPaths = [
  path.join(projectRoot, 'assets', 'map_packs', 'current', 'story_pack_v1', 'maps.json'),
  path.join(projectRoot, 'assets', 'map_packs', 'authoring', 'story_pack_v1', 'maps.json'),
  path.join(projectRoot, 'assets', 'data', 'level_map_pack_v1.authoring.json')
];
const expectedStoryLevelIds = Array.from({ length: 3 }, (_, chapterIndex) => {
  const chapter = chapterIndex + 1;
  return Array.from({ length: 10 }, (_, levelIndex) => `level_${chapter}_${levelIndex + 1}`);
}).flat();

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function collectWaveEnemyPoolIds(levelsDocument) {
  return Object.values(levelsDocument.levels || {})
    .flatMap(level => level.waves || [])
    .map(wave => wave.enemyPoolId)
    .filter(Boolean);
}

function collectEnemyTemplateIds(levelsDocument) {
  return Object.values(levelsDocument.enemyPools || {})
    .flatMap(pool => pool.members || [])
    .map(member => member.templateId)
    .filter(Boolean);
}

async function readNewestAuthoringEnemyDocument() {
  const files = (await fs.readdir(authoringEnemyRoot))
    .filter(fileName => /^enemies_\d{8}_\d{6}\.json$/u.test(fileName))
    .sort();
  assert.notEqual(files.length, 0, '缺少敌人工作稿版本');
  return readJson(path.join(authoringEnemyRoot, files.at(-1)));
}

test('运行时敌人目录不再发布 enemy_acceptance 测试敌人', async () => {
  const runtimeEnemies = await readJson(runtimeEnemyPath);
  const newestAuthoringEnemies = await readNewestAuthoringEnemyDocument();

  for (const [sourceName, enemies] of [
    ['assets/enemy_packs/current/enemies.json', runtimeEnemies],
    ['最新敌人工作稿', newestAuthoringEnemies]
  ]) {
    assert.deepEqual(
      Object.keys(enemies).filter(enemyId => enemyId.startsWith('enemy_acceptance_')),
      [],
      `${sourceName} 不应再包含 enemy_acceptance_*`
    );
  }
});

test('runtime data config reads enemies from the current enemy pack', async () => {
  const dataConfig = await readJson(dataConfigPath);

  assert.equal(dataConfig.contentRegistry?.enemies?.path, '/assets/enemy_packs/current/enemies.json');
  assert.equal(dataConfig.sources?.enemies, '/assets/enemy_packs/current/enemies.json');
});

test('runtime current enemy pack publishes the V2 authoring roster', async () => {
  const runtimeEnemies = await readJson(runtimeEnemyPath);
  const authoringEnemies = await readJson(path.join(authoringEnemyRoot, 'enemies_20260531_000000.json'));

  assert.deepEqual(Object.keys(runtimeEnemies).sort(), Object.keys(authoringEnemies).sort());
  assert.equal(Object.keys(runtimeEnemies).length, 30);
  assert.equal(Object.values(runtimeEnemies).every(enemy => enemy.tags?.includes('v2_candidate')), true);
});

test('story levels reference the V2 candidate assigned to each level', async () => {
  const authoringEnemies = await readJson(path.join(authoringEnemyRoot, 'enemies_20260531_000000.json'));
  const candidateByLevel = new Map(
    Object.values(authoringEnemies).map(enemy => [enemy.candidateForLevel, enemy.id])
  );

  for (const filePath of runtimeLevelPaths) {
    const levelsDocument = await readJson(filePath);
    const label = path.relative(projectRoot, filePath);

    for (const levelId of expectedStoryLevelIds) {
      const expectedEnemyId = candidateByLevel.get(levelId);
      const level = levelsDocument.levels?.[levelId];
      const poolId = level?.waves?.[0]?.enemyPoolId;
      const firstMemberId = levelsDocument.enemyPools?.[poolId]?.members?.[0]?.templateId;

      assert.equal(level?.primaryEnemy?.templateId, expectedEnemyId, `${label} ${levelId} primaryEnemy should use V2`);
      assert.equal(firstMemberId, expectedEnemyId, `${label} ${levelId} first pool member should use V2`);
    }
  }
});

test('运行时关卡包不再引用 enemy_acceptance 测试敌人池', async () => {
  for (const filePath of runtimeLevelPaths) {
    const levelsDocument = await readJson(filePath);
    const label = path.relative(projectRoot, filePath);

    assert.deepEqual(
      Object.keys(levelsDocument.enemyPools || {}).filter(poolId => poolId.startsWith('pool_acceptance_')),
      [],
      `${label} 不应再包含 pool_acceptance_*`
    );
    assert.deepEqual(
      collectWaveEnemyPoolIds(levelsDocument).filter(poolId => poolId.startsWith('pool_acceptance_')),
      [],
      `${label} 不应再引用 pool_acceptance_*`
    );
    assert.deepEqual(
      collectEnemyTemplateIds(levelsDocument).filter(templateId => templateId.startsWith('enemy_acceptance_')),
      [],
      `${label} 不应再引用 enemy_acceptance_*`
    );
  }
});

test('运行时地图节点不再绑定 enemy_acceptance 专用验收关卡', async () => {
  for (const filePath of runtimeMapPaths) {
    const mapPack = await readJson(filePath);
    const label = path.relative(projectRoot, filePath);
    const acceptanceBindings = (mapPack.maps || [])
      .flatMap(map => map.nodes || [])
      .map(node => node.levelId)
      .filter(levelId => /^level_1_\d+_acceptance/u.test(String(levelId || '')));

    assert.deepEqual(
      acceptanceBindings,
      [],
      `${label} 不应再把地图节点绑定到 enemy_acceptance 专用验收关卡`
    );
  }
});
