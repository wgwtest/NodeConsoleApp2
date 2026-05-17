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
    ['node_gate', 'level_1_3_story', 'locked']
  ]);
  assert.equal(model.map.nodes[1].levelName, '密林前哨');
  assert.equal(model.map.nodes[2].isUnlocked, false);
});

test('生产关卡地图包是可解析的运行时 JSON 并压缩为主线节点', async () => {
  const raw = await fs.readFile(path.join(projectRoot, 'assets/data/level_map_pack_v1.json'), 'utf8');
  const pack = JSON.parse(raw);
  const map = pack.maps?.[0];

  assert.equal(pack.$schemaVersion, 'level_map_pack_v1');
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
