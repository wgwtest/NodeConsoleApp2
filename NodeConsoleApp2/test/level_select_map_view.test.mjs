import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importSourceModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function installDomGlobals(dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.Event = dom.window.Event;
  global.MouseEvent = dom.window.MouseEvent;
}

function cleanupDomGlobals() {
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.Node;
  delete global.Event;
  delete global.MouseEvent;
}

function buildMapModel() {
  return {
    schemaVersion: 'level_map_pack_v1',
    assetLibrary: {
      backgrounds: [
        {
          id: 'bg_map_glade_01',
          src: '../source/map/image_w2752_h1536_map-bg-01.jpeg',
          previewGradient: 'linear-gradient(180deg, #17324d, #3f9f84)'
        }
      ],
      nodeSkins: [
        { id: 'skin_story_battle', label: '战斗节点', shape: 'hex' }
      ],
      nodeArts: [
        {
          id: 'node_icon_elf_archer',
          src: '../source/scene_icon/level-node-05-elf-archer_1000.png'
        }
      ],
      portraits: []
    },
    overview: {
      chapterLabel: '第一章',
      chapterTitle: '幽暗森林',
      completedCount: 1,
      totalCount: 3,
      unlockedCount: 2
    },
    selectedNodeId: 'node_scout',
    recommendedNodeId: 'node_scout',
    maps: [
      {
        id: 'chapter_1_runtime',
        chapterLabel: '第一章',
        chapterTitle: '幽暗森林',
        name: '第一章地图',
        backgroundRef: 'bg_map_glade_01',
        nodeCount: 3,
        unlockedNodeCount: 2,
        completedNodeCount: 1,
        isActive: true
      },
      {
        id: 'chapter_2_runtime',
        chapterLabel: '第二章',
        chapterTitle: '霜雾峡谷',
        name: '第二章地图',
        backgroundRef: 'bg_map_winter_02',
        nodeCount: 2,
        unlockedNodeCount: 0,
        completedNodeCount: 0,
        isActive: false
      },
      {
        id: 'chapter_3_runtime',
        chapterLabel: '第三章',
        chapterTitle: '暮色古道',
        name: '第三章地图',
        backgroundRef: 'bg_map_glade_03',
        nodeCount: 2,
        unlockedNodeCount: 0,
        completedNodeCount: 0,
        isActive: false
      }
    ],
    map: {
      id: 'chapter_1_runtime',
      chapterLabel: '第一章',
      chapterTitle: '幽暗森林',
      name: '第一章地图',
      backgroundRef: 'bg_map_glade_01',
      space: { logicalWidth: 1600, logicalHeight: 900 },
      display: {
        viewportAspect: '16:9',
        backgroundFit: 'cover',
        nodeScale: 0.62,
        nodeAnchor: 'center',
        edgeAnchor: 'center',
        edgeLabelMode: 'midpoint'
      },
      nodes: [
        {
          id: 'node_edge',
          levelId: 'level_1_1',
          label: '1-1',
          title: '幽暗森林边缘',
          levelName: '幽暗森林边缘',
          kind: 'battle',
          status: 'completed',
          statusLabel: '已完成',
          isUnlocked: true,
          position: { x: 120, y: 240 },
          objectiveText: '建立第一波防线。',
          rewardPreview: ['KP +1'],
          artRefs: { nodeArt: 'node_icon_elf_archer' }
        },
        {
          id: 'node_scout',
          levelId: 'level_1_2_story',
          label: '1-2',
          title: '密林前哨',
          levelName: '密林前哨',
          kind: 'battle',
          status: 'recommended',
          statusLabel: '当前推荐',
          isUnlocked: true,
          position: { x: 480, y: 220 },
          objectiveText: '穿过前哨。',
          rewardPreview: ['金币 80'],
          artRefs: { nodeArt: 'node_icon_elf_archer' }
        },
        {
          id: 'node_gate',
          levelId: 'level_1_3_story',
          label: '1-3',
          title: '废墟关隘',
          levelName: '废墟关隘',
          kind: 'boss',
          status: 'locked',
          statusLabel: '未解锁',
          isUnlocked: false,
          position: { x: 860, y: 260 },
          objectiveText: '进入章节首领战。',
          rewardPreview: ['KP +2'],
          artRefs: {}
        }
      ],
      edges: [
        { id: 'edge_1', fromNodeId: 'node_edge', toNodeId: 'node_scout', type: 'main', branchLabel: '林间路线' },
        { id: 'edge_2', fromNodeId: 'node_scout', toNodeId: 'node_gate', type: 'main', branchLabel: '废墟入口' }
      ]
    }
  };
}

test('LevelSelectMapView 会渲染运行时地图并把可选节点点击回传给关卡选择', async () => {
  const dom = new JSDOM('<!DOCTYPE html><body><section id="host"></section></body>', {
    url: 'http://127.0.0.1:3101/mock_ui_v11.html'
  });
  installDomGlobals(dom);
  try {
    const { LevelSelectMapView } = await importSourceModule('script/ui/LevelSelectMapView.js');
    const clicked = [];
    const view = new LevelSelectMapView({
      document,
      onSelectNode(payload) {
        clicked.push(payload);
      }
    });

    view.render(document.getElementById('host'), buildMapModel());

    const root = document.querySelector('.level-select-runtime-map');
    const stage = document.querySelector('.level-select-runtime-map__stage');
    const selected = document.querySelector('.level-map-node[data-selected="true"]');
    const nodes = [...document.querySelectorAll('.level-map-node')];
    const lockedNode = document.querySelector('.level-map-node.is-locked');
    const edgeLabels = [...document.querySelectorAll('.level-map-edge-label')].map(node => node.textContent);

    assert.ok(root, '缺少运行时地图根节点');
    assert.match(stage?.style.backgroundImage || '', /image_w2752_h1536_map-bg-01/u);
    assert.equal(stage?.style.aspectRatio, '16 / 9');
    assert.equal(nodes.length, 3);
    assert.equal(selected?.dataset.nodeId, 'node_scout');
    assert.equal(lockedNode?.getAttribute('aria-disabled'), 'true');
    assert.deepEqual(edgeLabels, ['林间路线', '废墟入口']);

    selected?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    lockedNode?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    assert.deepEqual(clicked, [
      {
        mapId: 'chapter_1_runtime',
        nodeId: 'node_scout',
        levelId: 'level_1_2_story'
      }
    ]);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('LevelSelectMapView 会渲染三张地图切换入口并回传目标地图', async () => {
  const dom = new JSDOM('<!DOCTYPE html><body><section id="host"></section></body>', {
    url: 'http://127.0.0.1:3101/mock_ui_v11.html'
  });
  installDomGlobals(dom);
  try {
    const { LevelSelectMapView } = await importSourceModule('script/ui/LevelSelectMapView.js');
    const selectedMaps = [];
    const view = new LevelSelectMapView({
      document,
      onSelectMap(payload) {
        selectedMaps.push(payload);
      }
    });

    view.render(document.getElementById('host'), buildMapModel());

    const switcher = document.querySelector('.level-map-switcher');
    const buttons = [...document.querySelectorAll('.level-map-switcher__button')];
    assert.ok(switcher, '缺少地图切换控件');
    assert.equal(buttons.length, 3);
    assert.deepEqual(buttons.map(button => button.textContent.trim().replace(/\s+/g, ' ')), [
      '第一章 幽暗森林 2/3',
      '第二章 霜雾峡谷 0/2',
      '第三章 暮色古道 0/2'
    ]);
    assert.equal(buttons[0].getAttribute('aria-pressed'), 'true');

    buttons[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    assert.deepEqual(selectedMaps, [
      {
        mapId: 'chapter_2_runtime'
      }
    ]);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});
