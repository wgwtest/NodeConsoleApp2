import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');

const levelDocumentPaths = [
  'assets/map_packs/current/story_pack_v1/levels.json',
  'assets/map_packs/authoring/story_pack_v1/levels.json',
  'assets/data/levels.json'
];

const mapDocumentPaths = [
  'assets/map_packs/current/story_pack_v1/maps.json',
  'assets/map_packs/authoring/story_pack_v1/maps.json',
  'assets/data/level_map_pack_v1.authoring.json'
];

const expectedStoryLevels = Array.from({ length: 3 }, (_, chapterIndex) => {
  const chapter = chapterIndex + 1;
  return Array.from({ length: 10 }, (_, levelIndex) => {
    const localOrder = levelIndex + 1;
    return {
      id: `level_${chapter}_${localOrder}`,
      nodeLabel: `${chapter}-${localOrder}`,
      chapter,
      localOrder,
      globalOrder: chapterIndex * 10 + localOrder
    };
  });
}).flat();

const expectedStoryLevelIds = expectedStoryLevels.map(item => item.id);

const expectedRouteVariantIds = [
  'level_1_3_supply_route',
  'level_1_4_supply_route',
  'level_2_3_shortcut_route',
  'level_2_4_shortcut_elite',
  'level_3_3_supply_route',
  'level_3_5_well_route'
];

const standardBodyParts = ['head', 'chest', 'abdomen', 'arm', 'leg'];
const requiredEnemyRoleTags = [
  'role_fast',
  'role_armor',
  'role_repair',
  'role_status',
  'role_elite',
  'role_boss'
];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), 'utf8'));
}

async function importSourceModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  let source = await fs.readFile(filePath, 'utf8');
  source = source.replace(
    /^import\s+\{\s*buildContentPackOverrideKey,\s*getContentPackOverride\s*\}\s+from\s+'..\/tooling\/ContentPackOverrideStore\.js';\s*/u,
    'const buildContentPackOverrideKey = (contentKey, scopeId = null) => scopeId ? `${contentKey}:${scopeId}` : contentKey;\nconst getContentPackOverride = () => null;\n'
  );
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function listMapNodes(mapDocument) {
  return (mapDocument.maps || [])
    .flatMap(map => (map.nodes || []).map(node => ({ ...node, mapId: map.id, chapterId: map.chapterId })));
}

function normalizeEnemies(rawEnemies) {
  return asObject(rawEnemies.enemies || rawEnemies);
}

function collectTemplateIds(levelsDocument) {
  return Object.values(asObject(levelsDocument.enemyPools))
    .flatMap(pool => Array.isArray(pool.members) ? pool.members : [])
    .map(member => member?.templateId)
    .filter(Boolean);
}

function collectStoryLevelEnemyIds(levelsDocument) {
  const levels = asObject(levelsDocument.levels);
  const enemyPools = asObject(levelsDocument.enemyPools);
  const rows = [];

  for (const level of Object.values(levels)) {
    if (level?.flow?.kind !== 'story') {
      continue;
    }
    const poolId = level.waves?.[0]?.enemyPoolId;
    const members = Array.isArray(enemyPools[poolId]?.members) ? enemyPools[poolId].members : [];
    for (const member of members) {
      if (!member?.templateId) {
        continue;
      }
      rows.push({
        chapter: Number(level.flow.chapterOrder),
        levelId: level.id,
        poolId,
        templateId: member.templateId
      });
    }
  }

  return rows;
}

function listMissingEnemyFields(enemyId, enemy) {
  const missing = [];
  const stats = asObject(enemy.stats);
  const bodyParts = asObject(enemy.bodyParts);
  const presentation = asObject(enemy.presentation);

  for (const fieldName of ['race', 'class', 'description']) {
    if (typeof enemy[fieldName] !== 'string' || enemy[fieldName].trim().length === 0) {
      missing.push(fieldName);
    }
  }
  if (!Array.isArray(enemy.tags) || enemy.tags.length === 0) {
    missing.push('tags');
  }
  for (const statName of ['hp', 'maxHp', 'ap', 'speed']) {
    if (typeof stats[statName] !== 'number' || stats[statName] <= 0) {
      missing.push(`stats.${statName}`);
    }
  }
  for (const partName of standardBodyParts) {
    const part = asObject(bodyParts[partName]);
    for (const fieldName of ['current', 'max', 'weakness']) {
      if (typeof part[fieldName] !== 'number') {
        missing.push(`bodyParts.${partName}.${fieldName}`);
      }
    }
  }
  if (!Array.isArray(enemy.skills) || enemy.skills.length === 0) {
    missing.push('skills');
  }
  if (typeof presentation.battleSpriteRef !== 'string' || presentation.battleSpriteRef.trim().length === 0) {
    missing.push('presentation.battleSpriteRef');
  }

  return missing.length > 0 ? `${enemyId}: ${missing.join(', ')}` : null;
}

test('故事地图包暴露 30 个正式编号节点，并将 6 个路线变体排除在正式关卡外', async () => {
  for (const relativePath of mapDocumentPaths) {
    const mapDocument = await readJson(relativePath);
    const nodes = listMapNodes(mapDocument);
    const numberedNodes = nodes.filter(node => /^\d+-\d+$/u.test(String(node.label || '')));
    const routeVariantNodes = nodes.filter(node => expectedRouteVariantIds.includes(node.levelId));

    assert.equal(numberedNodes.length, 30, `${relativePath} 应有 30 个严格编号节点`);
    assert.deepEqual(
      numberedNodes.map(node => node.label).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
      expectedStoryLevels.map(item => item.nodeLabel),
      `${relativePath} 编号节点应覆盖 1-1 到 3-10`
    );
    assert.deepEqual(
      numberedNodes.map(node => node.levelId).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
      expectedStoryLevelIds,
      `${relativePath} 编号节点应一一绑定 30 个独立 story levelId`
    );
    assert.equal(
      numberedNodes.every(node => node.contentRole === 'story_level'),
      true,
      `${relativePath} 编号节点应显式标记 contentRole=story_level`
    );
    assert.equal(routeVariantNodes.length, 6, `${relativePath} 应保留 6 个路线 / 补给 / 事件变体节点`);
    assert.equal(
      routeVariantNodes.every(node => !/^\d+-\d+$/u.test(String(node.label || ''))),
      true,
      `${relativePath} 变体节点不能占用正式编号标签`
    );
    assert.equal(
      routeVariantNodes.every(node => node.contentRole === 'route_variant'),
      true,
      `${relativePath} 变体节点应显式标记 contentRole=route_variant`
    );
  }
});

test('关卡事实源定义 30 个 story 关卡、6 个路线变体和独立敌人池', async () => {
  const enemyIds = new Set(Object.keys(normalizeEnemies(await readJson('assets/data/enemies.json'))));

  for (const relativePath of levelDocumentPaths) {
    const levelsDocument = await readJson(relativePath);
    const levels = asObject(levelsDocument.levels);
    const enemyPools = asObject(levelsDocument.enemyPools);
    const storyLevels = Object.values(levels)
      .filter(level => level?.flow?.kind === 'story')
      .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
    const routeVariantLevels = Object.values(levels)
      .filter(level => level?.flow?.kind === 'route_variant')
      .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));

    assert.deepEqual(
      storyLevels.map(level => level.id),
      expectedStoryLevelIds,
      `${relativePath} story 关卡应只包含 30 个正式编号关卡`
    );
    assert.deepEqual(
      routeVariantLevels.map(level => level.id).sort(),
      [...expectedRouteVariantIds].sort(),
      `${relativePath} 应显式声明 6 个 route_variant 关卡`
    );

    for (const expected of expectedStoryLevels) {
      const level = levels[expected.id];
      assert.equal(level.flow.chapterOrder, expected.chapter, `${relativePath} ${expected.id} chapterOrder 错误`);
      assert.equal(level.flow.nodeLabel, expected.nodeLabel, `${relativePath} ${expected.id} nodeLabel 错误`);
      assert.equal(level.flow.order, expected.globalOrder, `${relativePath} ${expected.id} 应使用全局剧情顺序`);
      assert.equal(level.waves?.length >= 1, true, `${relativePath} ${expected.id} 缺少波次`);

      const poolId = level.waves[0]?.enemyPoolId;
      assert.equal(typeof poolId, 'string', `${relativePath} ${expected.id} 缺少 enemyPoolId`);
      assert.equal(poolId.length > 0, true, `${relativePath} ${expected.id} enemyPoolId 为空`);
      assert.equal(Boolean(enemyPools[poolId]), true, `${relativePath} ${expected.id} 引用不存在的敌人池 ${poolId}`);
      assert.equal(Array.isArray(enemyPools[poolId].members), true, `${relativePath} ${poolId} members 必须为数组`);
      assert.equal(enemyPools[poolId].members.length >= 1, true, `${relativePath} ${poolId} 至少需要 1 个敌人`);
    }

    const storyPoolIds = storyLevels.map(level => level.waves?.[0]?.enemyPoolId).filter(Boolean);
    assert.equal(new Set(storyPoolIds).size, 30, `${relativePath} 30 个 story 关卡应有 30 个独立敌人池`);

    const missingTemplates = collectTemplateIds(levelsDocument).filter(templateId => !enemyIds.has(templateId));
    assert.deepEqual(missingTemplates, [], `${relativePath} 不应引用不存在的敌人模板`);
  }
});

test('三章 30 关敌人模板满足 WBS-3.4.2 的数量、角色和字段完整性约束', async () => {
  const enemies = normalizeEnemies(await readJson('assets/data/enemies.json'));
  const enemySkillPack = await readJson('assets/data/skills_enemy_v1.json');
  const enemySkillIds = new Set((enemySkillPack.skills || []).map(skill => skill.id).filter(Boolean));
  const enemyEntries = Object.entries(enemies);

  assert.equal(enemyEntries.length >= 18, true, '敌人模板总数应不少于 18 个');
  assert.equal(enemyEntries.length <= 24, true, '敌人模板总数应不超过 24 个，避免第一轮内容膨胀失控');

  const missingFields = enemyEntries
    .map(([enemyId, enemy]) => listMissingEnemyFields(enemyId, enemy))
    .filter(Boolean);
  assert.deepEqual(missingFields, [], '所有敌人模板都应补齐 race/class/tags/description/stats/bodyParts/skills/presentation');

  const missingSkillRefs = enemyEntries.flatMap(([enemyId, enemy]) => {
    return (Array.isArray(enemy.skills) ? enemy.skills : [])
      .filter(skillId => !enemySkillIds.has(skillId))
      .map(skillId => `${enemyId}.${skillId}`);
  });
  assert.deepEqual(missingSkillRefs, [], '敌人技能引用必须全部存在于 assets/data/skills_enemy_v1.json');

  const levelDocuments = await Promise.all(levelDocumentPaths.map(async relativePath => ({
    relativePath,
    document: await readJson(relativePath)
  })));
  const usedByRuntimeStory = collectStoryLevelEnemyIds(levelDocuments[0].document);
  const usedEnemyIds = new Set(usedByRuntimeStory.map(row => row.templateId));

  assert.equal(usedEnemyIds.size >= 15, true, '30 个正式关卡实际使用的敌人模板应不少于 15 个');

  for (const { relativePath, document } of levelDocuments) {
    assert.deepEqual(
      collectStoryLevelEnemyIds(document),
      usedByRuntimeStory,
      `${relativePath} 的 story 敌人池分布应与 current/story_pack_v1 保持一致`
    );
  }

  for (const chapter of [1, 2, 3]) {
    const chapterEnemyIds = new Set(usedByRuntimeStory
      .filter(row => row.chapter === chapter)
      .map(row => row.templateId));
    const chapterRoles = new Set([...chapterEnemyIds].flatMap(enemyId => enemies[enemyId]?.tags || []));

    assert.equal(chapterEnemyIds.size >= 6, true, `第 ${chapter} 章实际使用敌人应不少于 6 个`);
    for (const roleTag of requiredEnemyRoleTags) {
      assert.equal(chapterRoles.has(roleTag), true, `第 ${chapter} 章缺少敌人角色 ${roleTag}`);
    }
  }
});

test('DataManagerV2 能实例化 30 个正式关卡，并让路线变体节点保留自身进入目标', async () => {
  const levelsDocument = await readJson('assets/map_packs/current/story_pack_v1/levels.json');
  const mapDocument = await readJson('assets/map_packs/current/story_pack_v1/maps.json');
  const enemies = normalizeEnemies(await readJson('assets/data/enemies.json'));
  const { default: dm } = await importSourceModule('script/engine/DataManagerV2.js');

  dm.gameConfig = {
    enemies,
    levels: dm._expandLevelEnemyPools(levelsDocument),
    levelMapPack: mapDocument
  };
  dm.levelCatalog = null;
  dm.levelMapPack = null;
  dm.dataConfig.global = {
    progress: {
      unlockedLevels: ['level_1_1'],
      completedLevels: []
    }
  };

  for (const levelId of expectedStoryLevelIds) {
    const runtimeLevel = dm.instantiateLevel(levelId);
    assert.notEqual(runtimeLevel, null, `${levelId} 应能实例化`);
    assert.equal(runtimeLevel.enemies.length >= 1, true, `${levelId} 实例化后应至少有 1 个敌人`);
  }

  const model = dm.getLevelSelectMapModel();
  const variantNode = model.map.nodes.find(node => node.levelId === 'level_1_3_supply_route');
  assert.equal(variantNode?.selectLevelId, 'level_1_3_supply_route', '路线变体节点不应回退进入第一关');
  assert.equal(variantNode?.levelName, '南侧补给道', '路线变体节点应读取自身关卡详情');
  assert.equal(variantNode?.contentRole, 'route_variant', '运行时地图模型应保留路线变体分类');
});
