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
  global.SVGElement = dom.window.SVGElement;
  global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
  if (dom.window.HTMLCanvasElement && !dom.window.HTMLCanvasElement.prototype.getContext) {
    dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  }
  if (dom.window.HTMLCanvasElement) {
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({
      save() {},
      restore() {},
      clearRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      closePath() {},
      translate() {},
      rotate() {},
      setLineDash(value) { this.__calls.push(['setLineDash', value]); },
      set strokeStyle(value) {},
      set fillStyle(value) {},
      set lineWidth(value) { this.__calls.push(['lineWidth', value]); },
      set lineCap(value) {},
      set lineJoin(value) {},
      __calls: []
    });
  }
}

function cleanupDomGlobals() {
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.Node;
  delete global.SVGElement;
  delete global.HTMLCanvasElement;
}

function createActivePackEngine(skillsList, skillsMap) {
  return {
    data: {
      playerData: {
        skills: {
          skillTreeId: 'melee_v4_5',
          skillPoints: 8,
          learned: []
        }
      },
      getSkillCatalog() {
        return { skillsList, skillsMap };
      }
    },
    eventBus: { emit() {} },
    saveGame() {}
  };
}

function buildSkill(id, name, x, y, options = {}) {
  return {
    id,
    name,
    description: options.description || `${name} 描述`,
    prerequisites: options.prerequisites || [],
    unlock: {
      cost: { kp: options.kp ?? 1 },
      exclusives: options.exclusives || []
    },
    editorMeta: {
      x,
      y,
      group: 'melee',
      ...(options.editorMeta || {})
    }
  };
}

function createSkillTreeEngine() {
  const skillsList = [
    buildSkill('skill_block', '修理护甲', 414, 314, { kp: 1 }),
    buildSkill('skill_iron_hand', '铁手', 414, 514, { kp: 1, prerequisites: ['skill_block'] }),
    buildSkill('skill_hold_the_line', '重拳', 414, 714, { kp: 3, prerequisites: ['skill_iron_hand'] }),
    buildSkill('skill_heavy_swing', '重锤', 1014, 314, { kp: 1 }),
    buildSkill('skill_skull_cracker', '裂颅一击', 1014, 514, { kp: 2, prerequisites: ['skill_heavy_swing'] }),
    buildSkill('skill_execute', '斩首', 1014, 714, { kp: 5, prerequisites: ['skill_skull_cracker'] }),
    buildSkill('skill_double_thrust', '剑砍', 1314, 314, { kp: 1 }),
    buildSkill('skill_tear', '锯齿斩', 1314, 514, { kp: 2, prerequisites: ['skill_double_thrust'] }),
    buildSkill('skill_bleed_burst', '撕裂伤口', 1314, 714, { kp: 3, prerequisites: ['skill_tear'] }),
    buildSkill('skill_runtime_hidden_demo', '单攻测试', 714, 314, {
      kp: 1,
      editorMeta: { hiddenInSkillTree: true }
    })
  ];
  const skillsMap = Object.fromEntries(skillsList.map(skill => [skill.id, skill]));
  return {
    data: {
      playerData: {
        skills: {
          skillTreeId: 'melee_v4_5',
          skillPoints: 4,
          learned: ['skill_block', 'skill_heavy_swing', 'skill_double_thrust']
        }
      },
      getSkillCatalog() {
        return { skillsList, skillsMap };
      }
    },
    eventBus: { emit() {} },
    saveGame() {}
  };
}

test('active melee skill pack hides runtime-only sample and acceptance nodes from the skill tree', async () => {
  const packPath = path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json');
  const pack = JSON.parse(await fs.readFile(packPath, 'utf8'));
  const byId = Object.fromEntries((pack.skills || []).map(skill => [skill.id, skill]));

  for (const skillId of [
    'skill_1771952067028',
    'skill_1771952147024',
    'skill_1771952209174',
    'skill_demo_hp_guard',
    'skill_demo_armor_guard',
    'skill_demo_on_hit_armor',
    'skill_demo_enemy_head_tap',
    'skill_demo_enemy_head_break',
    'skill_demo_wait'
  ]) {
    assert.equal(byId[skillId]?.editorMeta?.hiddenInSkillTree, true, `${skillId} should be hidden from runtime skill tree`);
  }
});

test('UI_SkillTreeModal renders approved tactical layout and filters hidden nodes', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    assert.ok(document.querySelector('.ui-skilltree__topbar'), 'topbar should exist');
    assert.ok(document.querySelector('.ui-skilltree__routeRail'), 'route rail should exist');
    assert.ok(document.querySelector('.ui-skilltree__canvasViewport'), 'canvas viewport should exist');
    assert.ok(document.querySelector('.ui-skilltree__decisionPanel'), 'decision panel should exist');
    assert.equal(document.querySelector('[data-skill-id="skill_runtime_hidden_demo"]'), null, 'hidden sample node should not render');

    const text = document.getElementById('mount')?.textContent || '';
    assert.match(text, /学习状态/);
    assert.match(text, /全局结构态/);
    assert.match(text, /当前选择/);
    assert.match(text, /已学习 3/);
    assert.match(text, /可用 KP 4/);
    assert.doesNotMatch(text, /单攻测试/);
    assert.doesNotMatch(text, /构筑路线|稳固前线|破甲重击|流血连段|分支|影响路线/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal side rail uses real learning states instead of fictional route concepts', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    const railText = document.querySelector('.ui-skilltree__routeRail')?.textContent || '';
    assert.match(railText, /学习状态/);
    assert.match(railText, /已学/);
    assert.match(railText, /可学/);
    assert.match(railText, /待解锁/);
    assert.match(railText, /KP不足|资源不足/);
    assert.match(railText, /已学链路/);
    assert.doesNotMatch(railText, /构筑路线|路线|分支|选择后影响/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal focuses selected path and renders Chinese decision details', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    document.querySelector('[data-skill-id="skill_tear"]')?.click();

    const selected = document.querySelector('[data-skill-id="skill_tear"]');
    assert.ok(selected?.classList.contains('is-selected'), 'clicked node should be selected');
    assert.ok(selected?.classList.contains('is-path-focus'), 'selected node should be path focused');
    assert.ok(document.querySelector('[data-skill-id="skill_double_thrust"]')?.classList.contains('is-path-focus'), 'prerequisite should be path focused');
    assert.ok(document.querySelector('[data-skill-id="skill_bleed_burst"]')?.classList.contains('is-path-focus'), 'downstream node should be path focused');
    assert.ok(
      Number(document.querySelector('.ui-skilltree__connections')?.dataset.focusedEdgeCount || 0) > 0,
      'focused path canvas edges should exist'
    );

    const detailText = document.querySelector('.ui-skilltree__decisionPanel')?.textContent || '';
    assert.match(detailText, /锯齿斩/);
    assert.match(detailText, /可学习/);
    assert.match(detailText, /解锁后续/);
    assert.match(detailText, /撕裂伤口/);
    assert.match(detailText, /暂存学习：锯齿斩/);
    assert.doesNotMatch(detailText, /LEARNABLE|LOCKED|INSUFFICIENT_KP/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal renders square skill nodes with cost, status and direct learn affordance in overview', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    const learned = document.querySelector('[data-skill-id="skill_block"]');
    const learnable = document.querySelector('[data-skill-id="skill_tear"]');
    const locked = document.querySelector('[data-skill-id="skill_bleed_burst"]');

    assert.deepEqual(
      modal._getRenderedNodeSize(),
      { width: 72, height: 72 },
      'runtime skill tree should keep the editor square-node geometry'
    );

    for (const node of [learned, learnable, locked]) {
      assert.ok(node?.querySelector('.ui-skilltree__nodeTitle'), 'node should keep the skill name in a dedicated title area');
      assert.ok(node?.querySelector('.ui-skilltree__nodeCost'), 'node should expose KP cost directly on the card');
      assert.ok(node?.querySelector('.ui-skilltree__nodeStatus'), 'overview nodes should expose readable learning state directly on the card');
    }

    assert.equal(learned?.querySelector('.ui-skilltree__nodeCost')?.textContent, '1KP');
    assert.equal(learned?.querySelector('.ui-skilltree__nodeStatus')?.textContent, '已学');
    assert.equal(learned?.querySelector('.ui-skilltree__nodeAction'), null, 'learned nodes should not show a learn action affordance');

    assert.equal(learnable?.querySelector('.ui-skilltree__nodeCost')?.textContent, '2KP');
    assert.equal(learnable?.querySelector('.ui-skilltree__nodeStatus')?.textContent, '可学');
    assert.equal(learnable?.querySelector('.ui-skilltree__nodeAction')?.textContent, '+');

    assert.equal(locked?.querySelector('.ui-skilltree__nodeStatus')?.textContent, '前置');
    assert.equal(locked?.querySelector('.ui-skilltree__nodeAction'), null, 'locked nodes should not show the add affordance');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal lets learnable node plus affordance stage learning directly', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });
    modal._zoom = 0.9;
    modal._renderAll();

    const learnable = document.querySelector('[data-skill-id="skill_tear"]');
    const action = learnable?.querySelector('.ui-skilltree__nodeAction');
    assert.equal(learnable?.getAttribute('role'), 'button');
    assert.equal(learnable?.tagName, 'DIV');
    assert.equal(action?.tagName, 'BUTTON');
    assert.equal(action?.textContent, '+', 'learnable node should expose a direct plus action');

    action.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

    const staged = document.querySelector('[data-skill-id="skill_tear"]');
    assert.ok(staged?.classList.contains('ui-skilltree__node--pending'), 'plus action should stage the skill directly');
    assert.equal(staged?.querySelector('.ui-skilltree__nodeStatus')?.textContent, '待提交');
    assert.equal(staged?.querySelector('.ui-skilltree__nodeAction'), null, 'staged nodes should no longer show a plus action');
    assert.match(document.querySelector('.ui-skilltree__kp')?.textContent || '', /可用 KP 2/);
    assert.match(document.querySelector('.ui-skilltree__decisionPanel')?.textContent || '', /锯齿斩/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal keeps node state visible while switching structure and reading LOD labels', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    const root = document.querySelector('.ui-skilltree');
    const getSampleNode = () => document.querySelector('[data-skill-id="skill_block"]');
    const getLearnableNode = () => document.querySelector('[data-skill-id="skill_tear"]');

    assert.equal(root?.dataset.lod, 'structure', 'overview zoom should default to structure LOD');
    assert.ok(root?.classList.contains('ui-skilltree--structure'), 'root should expose structure mode class');
    assert.match(document.querySelector('.ui-skilltree__canvasMeta')?.textContent || '', /全局结构态/);
    assert.equal(getSampleNode()?.querySelector('.ui-skilltree__nodeStatus')?.textContent, '已学', 'structure LOD should keep learned state visible');
    assert.equal(getLearnableNode()?.querySelector('.ui-skilltree__nodeAction')?.textContent, '+', 'structure LOD should keep direct learn affordance visible');

    modal._zoom = 0.9;
    modal._renderAll();

    assert.equal(root?.dataset.lod, 'reading', 'zooming past the detail threshold should switch to reading LOD');
    assert.ok(root?.classList.contains('ui-skilltree--reading'), 'root should expose reading mode class');
    assert.match(document.querySelector('.ui-skilltree__canvasMeta')?.textContent || '', /局部阅读态/);
    assert.equal(getSampleNode()?.querySelector('.ui-skilltree__nodeStatus')?.textContent, '已学', 'reading LOD should keep node status visible');

    modal._zoom = 0.76;
    modal._renderAll();

    assert.equal(root?.dataset.lod, 'structure', 'zooming back below the compact threshold should restore structure LOD');
    assert.ok(root?.classList.contains('ui-skilltree--structure'), 'root should switch back to structure mode');
    assert.equal(getSampleNode()?.querySelector('.ui-skilltree__nodeStatus')?.textContent, '已学', 'structure LOD should keep node status visible after switching back');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal fits the editor coordinate tree into the runtime viewport by default', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    assert.notEqual(modal._zoom, 1, 'default zoom should be fitted from node bounds');
    assert.notDeepEqual(modal._pan, { x: 0, y: 0 }, 'default pan should center fitted tree');
    assert.match(
      document.querySelector('.ui-skilltree__transform')?.getAttribute('style') || '',
      /translate\([^)]+\) scale\(/
    );
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal normalizes active pack coordinates to readable runtime density', async () => {
  const packPath = path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json');
  const pack = JSON.parse(await fs.readFile(packPath, 'utf8'));
  const skillsList = pack.skills || [];
  const skillsMap = Object.fromEntries(skillsList.map(skill => [skill.id, skill]));
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createActivePackEngine(skillsList, skillsMap));
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    assert.ok(modal._zoom > 0.4, `default zoom should keep editor topology inspectable, got ${modal._zoom}`);
    assert.ok(modal._layout.maxX - modal._layout.minX >= 1400, 'runtime layout should preserve editor-authored x span');
    assert.ok(modal._layout.maxY - modal._layout.minY >= 850, 'runtime layout should preserve editor-authored y span');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal preserves editor-authored relative topology for the active skill pack', async () => {
  const packPath = path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json');
  const pack = JSON.parse(await fs.readFile(packPath, 'utf8'));
  const skillsList = pack.skills || [];
  const skillsMap = Object.fromEntries(skillsList.map(skill => [skill.id, skill]));
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createActivePackEngine(skillsList, skillsMap));
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    const nodes = new Map([...document.querySelectorAll('.ui-skilltree__node')].map(node => [
      node.dataset.skillId,
      {
        left: Number.parseFloat(node.style.left),
        top: Number.parseFloat(node.style.top)
      }
    ]));
    const raw = new Map(skillsList
      .filter(skill => skill?.editorMeta?.hiddenInSkillTree !== true)
      .map(skill => [skill.id, { x: skill.editorMeta.x, y: skill.editorMeta.y }]));
    const assertDelta = (fromId, toId) => {
      const actualFrom = nodes.get(fromId);
      const actualTo = nodes.get(toId);
      const rawFrom = raw.get(fromId);
      const rawTo = raw.get(toId);
      assert.ok(actualFrom && actualTo && rawFrom && rawTo, `missing topology sample ${fromId} -> ${toId}`);
      assert.equal(actualTo.left - actualFrom.left, rawTo.x - rawFrom.x, `x delta should preserve editorMeta for ${fromId} -> ${toId}`);
      assert.equal(actualTo.top - actualFrom.top, rawTo.y - rawFrom.y, `y delta should preserve editorMeta for ${fromId} -> ${toId}`);
    };

    assertDelta('skill_block', 'skill_heal');
    assertDelta('skill_artery_slice_copy_1769789197982', 'skill_savage_charge');
    assertDelta('skill_fortify_copy_1769873501141', 'skill_hold_the_line_copy_1769956923405');
    assertDelta('skill_execute_copy_1770043820577', 'skill_execute_copy_1770044052832');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal renders connections on a canvas layer shared with DOM nodes', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    assert.ok(document.querySelector('canvas.ui-skilltree__connections'), 'connections should render on canvas');
    assert.equal(document.querySelector('svg.ui-skilltree__connections'), null, 'runtime skill tree should not use SVG as the connection layer');
    assert.match(document.querySelector('.ui-skilltree__connections')?.getAttribute('data-edge-count') || '', /^\d+$/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal highlights learned prerequisite links even when they are outside the selected focus path', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  const calls = [];
  installDomGlobals(dom);
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    save() {},
    restore() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    closePath() {},
    translate() {},
    rotate() {},
    setLineDash(value) { calls.push(['setLineDash', value]); },
    set strokeStyle(value) { calls.push(['strokeStyle', value]); },
    set fillStyle(value) { calls.push(['fillStyle', value]); },
    set lineWidth(value) { calls.push(['lineWidth', value]); },
    set lineCap(value) {},
    set lineJoin(value) {}
  });
  try {
    const engine = createSkillTreeEngine();
    engine.data.playerData.skills.learned = ['skill_block', 'skill_iron_hand', 'skill_heavy_swing', 'skill_double_thrust'];
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(engine);
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });
    document.querySelector('[data-skill-id="skill_tear"]')?.click();

    const canvas = document.querySelector('.ui-skilltree__connections');
    assert.ok(Number(canvas?.dataset.learnedEdgeCount || 0) >= 1, 'learned parent-child links should be counted separately');
    assert.ok(
      calls.some(([kind, value]) => kind === 'lineWidth' && value >= 4),
      'learned links should use the same strong line weight as highlighted focus links'
    );
    assert.equal(
      calls.some(([kind, value]) => kind === 'setLineDash' && Array.isArray(value) && value.length > 0),
      true,
      'non-learned dimmed links may still use dashed rendering'
    );
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal exposes a visible direct close action in the redesigned topbar', async () => {
  const dom = new JSDOM('<!doctype html><body><main id="mount"></main></body>');
  installDomGlobals(dom);
  try {
    let closeCount = 0;
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(createSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), {
      title: '技能树 / 构筑',
      onClose: () => { closeCount += 1; }
    });

    const closeBtn = document.querySelector('.ui-skilltree__topBtn--close');
    assert.ok(closeBtn, 'direct close button should exist in topbar');
    assert.equal(closeBtn.textContent, '直接关闭');
    closeBtn.click();
    assert.equal(closeCount, 1, 'direct close button should call onClose');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('mock_ui_v11.css includes approved skill tree visual layout classes', async () => {
  const css = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.css'), 'utf8');
  for (const selector of [
    '.ui-skilltree__topbar',
    '.ui-skilltree__routeRail',
    '.ui-skilltree__canvasViewport',
    '.ui-skilltree__decisionPanel',
    '.ui-skilltree__connections'
  ]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(css, /routeCard--blood|legendRow i\.blood/, 'skill tree CSS should not encode fictional route or branch legends');
});

test('mock_ui_v11.css keeps decision panel actions from covering the path list', async () => {
  const css = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.css'), 'utf8');
  assert.match(
    css,
    /\.ui-skilltree__decisionPanel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    'decision panel should use a vertical layout'
  );
  assert.match(
    css,
    /\.ui-skilltree__chain\s*\{[^}]*overflow:\s*auto;/s,
    'path chain should scroll instead of being covered by actions'
  );
  assert.match(
    css,
    /\.ui-skilltree__actions\s*\{[^}]*position:\s*static;/s,
    'actions should stay in layout flow instead of overlaying path rows'
  );
});

test('mock_ui_v11.css follows the approved square-node prototype layout budget', async () => {
  const css = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.css'), 'utf8');
  assert.match(
    css,
    /\.ui-skilltree__content\s*\{[^}]*grid-template-columns:\s*210px\s+minmax\(0,\s*1fr\)\s+282px;/s,
    'v3 prototype keeps side rails compact so the canvas stays dominant'
  );
  assert.match(
    css,
    /\.ui-skilltree__topbar\s*\{[^}]*height:\s*72px;[^}]*flex:\s*0\s+0\s+72px;/s,
    'v3 prototype uses a compact 72px topbar'
  );
  assert.match(
    css,
    /\.ui-skilltree__node\s*\{[^}]*width:\s*72px;[^}]*height:\s*72px;/s,
    'skill nodes should use editor-compatible 72px square geometry'
  );
  assert.match(
    css,
    /\.ui-skilltree__nodeStatus\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*0;[^}]*height:\s*16px;/s,
    'state label should be rendered by the runtime node status element'
  );
  assert.doesNotMatch(
    css,
    /\.ui-skilltree__node::after\s*\{[^}]*content:\s*attr\(data-state-label\);/s,
    'state label should not be duplicated through a pseudo element'
  );
});
