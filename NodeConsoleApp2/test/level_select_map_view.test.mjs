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
          selectLevelId: 'level_1_1',
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

test('LevelSelectMapView 会把节点选择、进入确认和视图缩放拆开', async () => {
  const dom = new JSDOM('<!DOCTYPE html><body><section id="host"></section></body>', {
    url: 'http://127.0.0.1:3101/mock_ui_v11.html'
  });
  installDomGlobals(dom);
  try {
    const { LevelSelectMapView } = await importSourceModule('script/ui/LevelSelectMapView.js');
    const selected = [];
    const confirmed = [];
    const view = new LevelSelectMapView({
      document,
      onSelectNode(payload) {
        selected.push(payload);
      },
      onConfirmNode(payload) {
        confirmed.push(payload);
      }
    });

    view.render(document.getElementById('host'), buildMapModel());

    const root = document.querySelector('.level-select-runtime-map');
    const controls = [...document.querySelectorAll('[data-action]')];
    const stage = document.querySelector('.level-select-runtime-map__stage');
    const selectedNode = document.querySelector('.level-map-node[data-selected="true"]');
    const nodes = [...document.querySelectorAll('.level-map-node')];
    const lockedNode = document.querySelector('.level-map-node.is-locked');
    const edgeLabels = [...document.querySelectorAll('.level-map-edge-label')].map(node => node.textContent);
    const detail = document.querySelector('.level-select-runtime-map__drawer');
    const enterBtn = document.querySelector('[data-action="enter-level"]');
    const zoomInBtn = document.querySelector('[data-action="zoom-in"]');
    const zoomOutBtn = document.querySelector('[data-action="zoom-out"]');
    const fitBtn = document.querySelector('[data-action="fit-viewport"]');

    assert.ok(root, '缺少运行时地图根节点');
    assert.ok(detail, '缺少关卡详情抽屉');
    assert.ok(enterBtn, '缺少进入按钮');
    assert.equal(controls.length >= 4, true, '缺少地图缩放控制');
    assert.equal(nodes.every(node => node.querySelector('.level-map-node__pin')), true, '地图节点应使用地标 pin 视觉层');
    assert.deepEqual(controls.map(item => item.getAttribute('aria-label')), ['缩小地图', '适配视图', '放大地图', '进入关卡']);
    assert.match(stage?.style.backgroundImage || '', /image_w2752_h1536_map-bg-01/u);
    assert.equal(stage?.style.aspectRatio, '16 / 9');
    assert.equal(nodes.length, 3);
    assert.equal(selectedNode?.dataset.nodeId, 'node_scout');
    assert.equal(lockedNode?.getAttribute('aria-disabled'), null);
    assert.deepEqual(edgeLabels, ['林间路线', '废墟入口']);
    assert.match(root?.dataset.zoom || '', /^1(?:\.0+)?$/);
    assert.match(detail?.textContent || '', /密林前哨/);

    selectedNode?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.deepEqual(selected, [
      {
        mapId: 'chapter_1_runtime',
        nodeId: 'node_scout',
        levelId: 'level_1_2_story',
        sourceLevelId: 'level_1_2_story'
      }
    ]);
    assert.deepEqual(confirmed, []);
    assert.match(detail?.textContent || '', /密林前哨/);

    zoomInBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(root?.dataset.zoom, '1.10');
    zoomOutBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(root?.dataset.zoom, '1.00');
    zoomOutBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(root?.dataset.zoom, '0.90');
    fitBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(root?.dataset.zoom, '1.00');

    lockedNode?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.deepEqual(selected.at(-1), {
      mapId: 'chapter_1_runtime',
      nodeId: 'node_gate',
      levelId: 'level_1_1',
      sourceLevelId: 'level_1_3_story'
    });
    assert.match(detail?.textContent || '', /废墟关隘/);
    assert.equal(enterBtn?.getAttribute('aria-disabled'), null);

    document.querySelector('[data-action="enter-level"]')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    assert.deepEqual(confirmed, [
      {
        mapId: 'chapter_1_runtime',
        nodeId: 'node_gate',
        levelId: 'level_1_1',
        sourceLevelId: 'level_1_3_story'
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
    assert.equal(switcher.getAttribute('role'), 'tablist');
    assert.equal(buttons.length, 3);
    assert.equal(buttons.every(button => button.getAttribute('role') === 'tab'), true);
    assert.equal(buttons.every(button => button.querySelector('.level-map-switcher__progress')), true);
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
