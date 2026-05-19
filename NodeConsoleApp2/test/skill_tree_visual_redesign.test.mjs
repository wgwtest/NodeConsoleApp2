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
}

function cleanupDomGlobals() {
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.Node;
  delete global.SVGElement;
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
    assert.ok(document.querySelector('.ui-skilltree__routeCard.is-active'), 'active route card should exist');
    assert.ok(document.querySelector('.ui-skilltree__node--route-guard'), 'guard route node should exist');
    assert.ok(document.querySelector('.ui-skilltree__node--route-blood'), 'blood route node should exist');
    assert.equal(document.querySelector('[data-skill-id="skill_runtime_hidden_demo"]'), null, 'hidden sample node should not render');

    const text = document.getElementById('mount')?.textContent || '';
    assert.match(text, /构筑路线/);
    assert.match(text, /拖拽平移/);
    assert.match(text, /当前选择/);
    assert.match(text, /已学习 3/);
    assert.match(text, /可用 KP 4/);
    assert.doesNotMatch(text, /单攻测试/);
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
    assert.ok(document.querySelector('.ui-skilltree__line.is-path-focus'), 'focused path line should exist');

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
    modal.init({
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
    });
    modal.mountTo(document.getElementById('mount'), { title: '技能树 / 构筑' });

    assert.ok(modal._zoom >= 0.72, `default zoom should keep active pack readable, got ${modal._zoom}`);
    assert.ok(modal._layout.maxX - modal._layout.minX <= 1060, 'runtime layout should compress wide editor coordinates');
    assert.ok(modal._layout.maxY - modal._layout.minY <= 680, 'runtime layout should compress tall editor coordinates');
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
    '.ui-skilltree__node--route-guard',
    '.ui-skilltree__node--route-blood',
    '.ui-skilltree__line.is-path-focus'
  ]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
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
