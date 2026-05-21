import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');

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

function buildStoryLevel(id, order, name) {
  return {
    id,
    name,
    description: `${name} runtime description`,
    flow: {
      kind: 'story',
      order,
      chapterId: 'story_chapter_1',
      chapterLabel: '第一章',
      chapterTitle: '幽暗森林',
      nodeLabel: `1-${order}`
    },
    rewards: { exp: 100, gold: 50, kp: 1 }
  };
}

function buildFixtureMapPack() {
  return {
    $schemaVersion: 'level_map_pack_v1',
    meta: {
      id: 'runtime_story_map',
      title: 'Runtime Story Map'
    },
    assetLibrary: {
      backgrounds: [
        {
          id: 'bg_map_glade_01',
          label: '地图背景 01',
          src: '../source/map/image_w2752_h1536_map-bg-01.jpeg',
          thumbnailSrc: '../source/map/image_w2752_h1536_map-bg-01.jpeg',
          previewGradient: 'linear-gradient(180deg, #17324d, #3f9f84)'
        }
      ],
      nodeSkins: [
        { id: 'skin_story_battle', label: '战斗节点', shape: 'hex' },
        { id: 'skin_story_boss', label: '首领节点', shape: 'diamond' }
      ],
      nodeArts: [
        {
          id: 'node_icon_elf_archer',
          label: '精灵弓手节点图标',
          src: '../source/scene_icon/level-node-05-elf-archer_1000.png'
        },
        {
          id: 'node_icon_owlbear',
          label: '枭熊节点图标',
          src: '../source/scene_icon/level-node-07-owlbear_1000.png'
        }
      ],
      portraits: []
    },
    maps: [
      {
        id: 'chapter_1_runtime',
        name: '第一章运行时地图',
        chapterId: 'story_chapter_1',
        chapterLabel: '第一章',
        chapterTitle: '幽暗森林',
        space: { logicalWidth: 1600, logicalHeight: 900 },
        display: {
          viewportAspect: '16:9',
          backgroundFit: 'cover',
          nodeScale: 0.62,
          nodeAnchor: 'center',
          edgeAnchor: 'center',
          edgeLabelMode: 'midpoint'
        },
        backgroundRef: 'bg_map_glade_01',
        entryNodeId: 'node_edge',
        nodes: [
          {
            id: 'node_edge',
            levelId: 'level_1_1',
            label: '1-1',
            title: '幽暗森林边缘',
            kind: 'battle',
            nodeSkinRef: 'skin_story_battle',
            iconLabel: '入口',
            position: { x: 120, y: 240 },
            objectiveText: '建立第一波防线。',
            difficultyLabel: '标准',
            rewardPreview: ['KP +1'],
            artRefs: { nodeArt: 'node_icon_elf_archer' }
          },
          {
            id: 'node_scout',
            levelId: 'level_1_2_story',
            label: '1-2',
            title: '密林前哨',
            kind: 'battle',
            nodeSkinRef: 'skin_story_battle',
            iconLabel: '推进',
            position: { x: 480, y: 220 },
            objectiveText: '穿过前哨。',
            difficultyLabel: '进阶',
            rewardPreview: ['金币 80'],
            artRefs: { nodeArt: 'node_icon_elf_archer' }
          },
          {
            id: 'node_gate',
            levelId: 'level_1_3_story',
            label: '1-3',
            title: '废墟关隘',
            kind: 'boss',
            nodeSkinRef: 'skin_story_boss',
            iconLabel: '首领',
            position: { x: 860, y: 260 },
            objectiveText: '进入章节首领战。',
            difficultyLabel: '高压',
            rewardPreview: ['KP +2'],
            artRefs: { nodeArt: 'node_icon_owlbear' }
          }
        ],
        edges: [
          { id: 'edge_1', fromNodeId: 'node_edge', toNodeId: 'node_scout', type: 'main', branchLabel: '林间路线' },
          { id: 'edge_2', fromNodeId: 'node_scout', toNodeId: 'node_gate', type: 'main', branchLabel: '废墟入口' }
        ]
      }
    ]
  };
}

test('DataManagerV2 会把地图包转换为运行时关卡选择地图模型', async () => {
  const { default: dm } = await importSourceModule('script/engine/DataManagerV2.js');
  dm.gameConfig = {
    levels: {
      level_1_1: buildStoryLevel('level_1_1', 1, '幽暗森林边缘'),
      level_1_2_story: buildStoryLevel('level_1_2_story', 2, '密林前哨'),
      level_1_3_story: buildStoryLevel('level_1_3_story', 3, '废墟关隘')
    },
    levelMapPack: buildFixtureMapPack()
  };
  dm.dataConfig.global = {
    progress: {
      unlockedLevels: ['level_1_1', 'level_1_2_story'],
      completedLevels: ['level_1_1']
    }
  };

  assert.equal(typeof dm.getLevelSelectMapModel, 'function', '缺少 getLevelSelectMapModel()');

  const model = dm.getLevelSelectMapModel();

  assert.equal(model.schemaVersion, 'level_map_pack_v1');
  assert.equal(model.map.id, 'chapter_1_runtime');
  assert.equal(model.map.backgroundRef, 'bg_map_glade_01');
  assert.equal(model.map.display.viewportAspect, '16:9');
  assert.equal(model.assetLibrary.backgrounds[0].src, '../source/map/image_w2752_h1536_map-bg-01.jpeg');
  assert.deepEqual(model.map.edges.map(edge => edge.id), ['edge_1', 'edge_2']);
  assert.equal(model.recommendedNodeId, 'node_scout');
  assert.equal(model.selectedNodeId, 'node_scout');
  assert.deepEqual(model.map.nodes.map(node => [node.id, node.levelId, node.status]), [
    ['node_edge', 'level_1_1', 'completed'],
    ['node_scout', 'level_1_2_story', 'recommended'],
    ['node_gate', 'level_1_3_story', 'unlocked']
  ]);
  assert.equal(model.map.nodes[1].levelName, '密林前哨');
  assert.equal(model.map.nodes[1].unlockHint, '当前已解锁，建议优先推进章节主线。');
  assert.equal(model.map.nodes[1].levelDescription, '密林前哨 runtime description');
  assert.equal(model.map.nodes[2].isUnlocked, true);
  assert.equal(model.map.nodes[2].selectLevelId, 'level_1_3_story');
});

test('DataManagerV2 会临时开放全部故事关卡入口并保留原始进度标记', async () => {
  const { default: dm } = await importSourceModule('script/engine/DataManagerV2.js');
  dm.gameConfig = {
    levels: {
      level_1_1: buildStoryLevel('level_1_1', 1, '幽暗森林边缘'),
      level_1_2_story: buildStoryLevel('level_1_2_story', 2, '密林前哨'),
      level_1_3_story: buildStoryLevel('level_1_3_story', 3, '废墟关隘')
    }
  };
  dm.dataConfig.global = {
    progress: {
      unlockedLevels: ['level_1_1'],
      completedLevels: []
    }
  };

  const entries = dm.getLevelSelectEntries();

  assert.deepEqual(entries.map(entry => [entry.id, entry.isUnlocked, entry.progressUnlocked]), [
    ['level_1_1', true, true],
    ['level_1_2_story', true, false],
    ['level_1_3_story', true, false]
  ]);
});

test('DataManagerV2 会暴露全部运行时地图供关卡选择切换', async () => {
  const { default: dm } = await importSourceModule('script/engine/DataManagerV2.js');
  const pack = buildFixtureMapPack();
  pack.assetLibrary.backgrounds.push(
    {
      id: 'bg_map_winter_02',
      label: '地图背景 02',
      src: '../source/map/image_w2752_h1536_map-bg-02-winter.jpeg',
      thumbnailSrc: '../source/map/image_w2752_h1536_map-bg-02-winter.jpeg',
      previewGradient: 'linear-gradient(180deg, #13324e, #d8e6f4)'
    },
    {
      id: 'bg_map_glade_03',
      label: '地图背景 03',
      src: '../source/map/image_w2752_h1536_map-bg-03.jpeg',
      thumbnailSrc: '../source/map/image_w2752_h1536_map-bg-03.jpeg',
      previewGradient: 'linear-gradient(180deg, #2f2330, #d59b63)'
    }
  );
  pack.maps.push(
    {
      ...pack.maps[0],
      id: 'chapter_2_runtime',
      name: '第二章运行时地图',
      chapterId: 'story_chapter_2',
      chapterLabel: '第二章',
      chapterTitle: '霜雾峡谷',
      backgroundRef: 'bg_map_winter_02',
      nodes: [
        {
          ...pack.maps[0].nodes[0],
          id: 'node_frost_entry',
          levelId: 'level_future_2_1',
          label: '2-1',
          title: '霜雾入口',
          position: { x: 220, y: 420 }
        }
      ],
      edges: []
    },
    {
      ...pack.maps[0],
      id: 'chapter_3_runtime',
      name: '第三章运行时地图',
      chapterId: 'story_chapter_3',
      chapterLabel: '第三章',
      chapterTitle: '暮色古道',
      backgroundRef: 'bg_map_glade_03',
      nodes: [
        {
          ...pack.maps[0].nodes[0],
          id: 'node_dusk_entry',
          levelId: 'level_future_3_1',
          label: '3-1',
          title: '暮色入口',
          position: { x: 260, y: 460 }
        }
      ],
      edges: []
    }
  );
  dm.gameConfig = {
    levels: {
      level_1_1: buildStoryLevel('level_1_1', 1, '幽暗森林边缘'),
      level_1_2_story: buildStoryLevel('level_1_2_story', 2, '密林前哨'),
      level_1_3_story: buildStoryLevel('level_1_3_story', 3, '废墟关隘')
    },
    levelMapPack: pack
  };
  dm.dataConfig.global = {
    progress: {
      unlockedLevels: ['level_1_1'],
      completedLevels: []
    }
  };

  const model = dm.getLevelSelectMapModel();

  assert.equal(model.map.id, 'chapter_1_runtime');
  assert.deepEqual(model.maps.map(map => [map.id, map.chapterLabel, map.chapterTitle, map.backgroundRef]), [
    ['chapter_1_runtime', '第一章', '幽暗森林', 'bg_map_glade_01'],
    ['chapter_2_runtime', '第二章', '霜雾峡谷', 'bg_map_winter_02'],
    ['chapter_3_runtime', '第三章', '暮色古道', 'bg_map_glade_03']
  ]);
  assert.deepEqual(model.maps.map(map => [map.id, map.nodeCount, map.unlockedNodeCount]), [
    ['chapter_1_runtime', 3, 3],
    ['chapter_2_runtime', 1, 1],
    ['chapter_3_runtime', 1, 1]
  ]);
  assert.deepEqual(model.mapPackMaps.map(map => map.nodes.map(node => [node.levelId, node.selectLevelId, node.isUnlocked])), [
    [
      ['level_1_1', 'level_1_1', true],
      ['level_1_2_story', 'level_1_2_story', true],
      ['level_1_3_story', 'level_1_3_story', true]
    ],
    [
      ['level_future_2_1', 'level_1_1', true]
    ],
    [
      ['level_future_3_1', 'level_1_1', true]
    ]
  ]);
});

test('DataManagerV2 支持从目录式地图包 package.json 加载 maps.json', async () => {
  const { default: dm } = await importSourceModule('script/engine/DataManagerV2.js');
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const fetchedUrls = [];
  const mapPack = buildFixtureMapPack();
  mapPack.stories = [
    {
      id: 'story_default',
      title: '默认故事',
      entryChapterId: 'story_chapter_1',
      chapterIds: ['story_chapter_1']
    }
  ];
  mapPack.chapters = [
    {
      id: 'story_chapter_1',
      storyId: 'story_default',
      title: '幽暗森林',
      order: 1,
      entryMapId: 'chapter_1_runtime',
      mapIds: ['chapter_1_runtime']
    }
  ];

  const responseByUrl = new Map([
    ['/assets/data/config.package-map-test.json', {
      version: 'data_sources_test_package',
      basePath: './assets/data/',
      contentRegistry: {
        player: { kind: 'player', path: 'player.json' },
        items: { kind: 'items', path: 'items.json' },
        skills: {
          kind: 'skills',
          path: 'skills_melee_v4_5.json',
          schemaVersion: 'skills_melee_v3',
          rootKey: 'skills',
          byTree: {
            melee_v4_5: {
              path: 'skills_melee_v4_5.json',
              schemaVersion: 'skills_melee_v3'
            }
          }
        },
        enemies: { kind: 'enemies', path: 'enemies.json' },
        levels: {
          kind: 'levels',
          path: 'levels.json',
          schemaVersion: 'levels_v1_wrapped',
          rootKey: 'levels'
        },
        levelMapPack: {
          kind: 'levelMapPack',
          packagePath: '../assets/map_packs/current/story_pack_v1/package.json',
          schemaVersion: 'level_map_pack_v1',
          rootKey: 'maps'
        },
        buffs: {
          kind: 'buffs',
          path: 'buffs_v2_7.json',
          schemaVersion: 'buffs_v2_1_wrapped',
          rootKey: 'buffs'
        },
        slotLayouts: { kind: 'slotLayouts', path: 'slot_layouts.json', required: false }
      }
    }],
    ['http://127.0.0.1:3101/assets/data/player.json', {
      default: {
        id: 'player_default',
        stats: { hp: 100, maxHp: 100, ap: 4, maxAp: 6, speed: 1 },
        skills: { skillTreeId: 'melee_v4_5', skillPoints: 0, learned: [] },
        resources: { exp: 0, gold: 0 },
        equipment: {},
        inventory: []
      }
    }],
    ['http://127.0.0.1:3101/assets/data/items.json', {}],
    ['http://127.0.0.1:3101/assets/data/enemies.json', {}],
    ['http://127.0.0.1:3101/assets/data/levels.json', {
      $schemaVersion: 'levels_v1_wrapped',
      enemyPools: {},
      levels: {
        level_1_1: buildStoryLevel('level_1_1', 1, '幽暗森林边缘'),
        level_1_2_story: buildStoryLevel('level_1_2_story', 2, '密林前哨'),
        level_1_3_story: buildStoryLevel('level_1_3_story', 3, '废墟关隘')
      }
    }],
    ['http://127.0.0.1:3101/assets/data/buffs_v2_7.json', {
      $schemaVersion: 'buffs_v2_1_wrapped',
      buffs: {}
    }],
    ['http://127.0.0.1:3101/assets/data/skills_melee_v4_5.json', {
      $schemaVersion: 'skills_melee_v3',
      skills: []
    }],
    ['http://127.0.0.1:3101/assets/data/slot_layouts.json', {}],
    ['../assets/map_packs/current/story_pack_v1/package.json', {
      $schemaVersion: 'level_map_package_v1',
      packageId: 'story_pack_v1',
      title: '故事地图包 v1',
      entryStoryId: 'story_default',
      files: { maps: 'maps.json' },
      assets: { basePath: 'assets/', manifest: 'asset-manifest.json' },
      stories: [{ id: 'story_default', title: '默认故事', entryChapterId: 'story_chapter_1', chapterIds: ['story_chapter_1'] }]
    }],
    ['../assets/map_packs/current/story_pack_v1/maps.json', mapPack]
  ]);

  globalThis.window = {
    DATA_CONFIG_URL: '/assets/data/config.package-map-test.json',
    location: {
      href: 'http://127.0.0.1:3101/mock_ui_v11.html',
      origin: 'http://127.0.0.1:3101'
    }
  };
  globalThis.fetch = async (url) => {
    fetchedUrls.push(String(url));
    if (!responseByUrl.has(String(url))) {
      return {
        ok: false,
        status: 404,
        async json() {
          return {};
        }
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return JSON.parse(JSON.stringify(responseByUrl.get(String(url))));
      }
    };
  };

  try {
    await dm.loadConfigs();

    assert.equal(fetchedUrls.includes('../assets/map_packs/current/story_pack_v1/package.json'), true);
    assert.equal(fetchedUrls.includes('../assets/map_packs/current/story_pack_v1/maps.json'), true);
    assert.equal(dm.gameConfig.levelMapPack.schemaVersion, 'level_map_pack_v1');
    assert.deepEqual(dm.gameConfig.levelMapPack.stories.map(story => story.id), ['story_default']);
    assert.deepEqual(dm.gameConfig.levelMapPack.chapters.map(chapter => chapter.id), ['story_chapter_1']);
    assert.equal(dm.getLevelMapPackMeta().packagePath, '../assets/map_packs/current/story_pack_v1/package.json');
    assert.equal(dm.getLevelMapPackMeta().packageId, 'story_pack_v1');
    assert.equal(dm.getLevelSelectMapModel().map.id, 'chapter_1_runtime');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test('生产关卡地图包是可解析的运行时 JSON 并开放三张地图', async () => {
  const raw = await fs.readFile(path.join(projectRoot, 'assets/data/level_map_pack_v1.json'), 'utf8');
  const pack = JSON.parse(raw);
  const map = pack.maps?.[0];

  assert.equal(pack.$schemaVersion, 'level_map_pack_v1');
  assert.equal(pack.maps.length, 3);
  assert.deepEqual(pack.maps.map(item => [item.id, item.chapterLabel, item.backgroundRef]), [
    ['chapter_1_story_map', '第一章', 'bg_map_glade_01'],
    ['chapter_2_story_map', '第二章', 'bg_map_winter_02'],
    ['chapter_3_story_map', '第三章', 'bg_map_glade_03']
  ]);
  assert.equal(map.id, 'chapter_1_story_map');
  assert.equal(map.display.edgeLabelMode, 'none');
  assert.deepEqual(map.nodes.map(node => [node.id, node.levelId]), [
    ['node_edge', 'level_1_1'],
    ['node_scout_route', 'level_1_2_story'],
    ['node_gate_boss', 'level_1_3_story']
  ]);
  assert.deepEqual(map.edges.map(edge => [edge.fromNodeId, edge.toNodeId]), [
    ['node_edge', 'node_scout_route'],
    ['node_edge', 'node_gate_boss'],
    ['node_scout_route', 'node_gate_boss']
  ]);
});

test('目录式地图包样例提供 package.json、maps.json 与 asset-manifest.json', async () => {
  const packageRoot = path.join(projectRoot, 'assets/map_packs/current/story_pack_v1');
  const packageJson = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const mapsJson = JSON.parse(await fs.readFile(path.join(packageRoot, 'maps.json'), 'utf8'));
  const assetManifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'asset-manifest.json'), 'utf8'));

  assert.equal(packageJson.$schemaVersion, 'level_map_package_v1');
  assert.equal(packageJson.packageId, 'story_pack_v1');
  assert.equal(packageJson.files.maps, 'maps.json');
  assert.equal(packageJson.assets.manifest, 'asset-manifest.json');
  assert.equal(mapsJson.$schemaVersion, 'level_map_pack_v1');
  assert.equal(Array.isArray(mapsJson.stories), true);
  assert.equal(Array.isArray(mapsJson.chapters), true);
  assert.equal(mapsJson.maps.length >= 3, true);
  assert.equal(assetManifest.backgrounds.length >= 1, true);
  assert.equal(assetManifest.nodeArts.length >= 1, true);
  assert.equal(assetManifest.portraits.length >= 1, true);
  assert.equal(assetManifest.backgrounds[0].packagePath.startsWith('assets/backgrounds/'), true);
});

test('默认数据配置让主流程读取 current 目录式地图包入口', async () => {
  const config = JSON.parse(await fs.readFile(path.join(projectRoot, 'assets/data/config.json'), 'utf8'));

  assert.equal(
    config.contentRegistry.levelMapPack.packagePath,
    '../assets/map_packs/current/story_pack_v1/package.json'
  );
  assert.equal(config.contentRegistry.levelMapPack.path, undefined);
  assert.equal(config.sources.levelMapPack, '../assets/map_packs/current/story_pack_v1/package.json');
});
