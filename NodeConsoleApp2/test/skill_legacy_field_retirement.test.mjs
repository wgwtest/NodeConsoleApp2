import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const legacyFieldKeys = Object.freeze({
  field: ['ta', 'gs'].join(''),
  meta: ['ta', 'gMeta'].join(''),
  packField: ['skills[]', '.ta', 'gs'].join(''),
  packMeta: ['skills[]', '.ta', 'gMeta'].join('')
});
const legacySkillFieldToken = ['skill', legacyFieldKeys.field].join(' ');
const legacyPackFieldToken = [legacyFieldKeys.field, legacyFieldKeys.meta].join('/');
const legacyPropertyTokens = {
  skillField: ['skill', '.', legacyFieldKeys.field].join(''),
  skillLegacyMeta: ['skill', '.', legacyFieldKeys.meta].join(''),
  metaEnumLegacy: ['meta.enums', '.', legacyFieldKeys.field].join(''),
  packField: legacyFieldKeys.packField,
  packLegacyMeta: legacyFieldKeys.packMeta,
  scopeDrift: ['tag_', 'scope_mismatch'].join(''),
  unexpectedEffect: ['unexpected_', 'effect_tag'].join(''),
  missingEffect: ['missing_', 'effect_tag'].join(''),
  oldBatchTarget: ['batch_target', '_tags'].join(''),
  oldBatchEffect: ['batch_effect', '_tags'].join(''),
  editorPropField: ['prop', '-', legacyFieldKeys.field].join(''),
  editorPropLegacyMeta: ['prop', '-', legacyFieldKeys.meta].join(''),
  editorFieldSearch: [legacyFieldKeys.field, '-search'].join(''),
  editorFieldEditor: [legacyFieldKeys.field, '-editor'].join(''),
  toolFilterField: ['f', '-', legacyFieldKeys.field].join(''),
  toolSaveField: ['save', legacyFieldKeys.field[0].toUpperCase() + legacyFieldKeys.field.slice(1)].join('')
};

async function importSourceModule(filePath, replacements = []) {
  let source = await fs.readFile(filePath, 'utf8');
  replacements.forEach(({ from, to }) => {
    source = source.replace(from, to);
  });
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

async function importSkillTreeModalModule() {
  const filePath = path.join(projectRoot, 'script', 'ui', 'UI_SkillTreeModal.js');
  return importSourceModule(filePath);
}

async function importSkillPanelModule() {
  const filePath = path.join(projectRoot, 'script', 'ui', 'UI_SkillPanel.js');
  return importSourceModule(filePath, [
    {
      from: /^﻿?import EventBus from '\.\.\/engine\/EventBus\.js';\s*/u,
      to: 'const EventBus = {};\n'
    }
  ]);
}

async function importDataManagerModule() {
  const filePath = path.join(projectRoot, 'script', 'engine', 'DataManagerV2.js');
  return importSourceModule(filePath, [
    {
      from: /^import\s+\{\s*buildContentPackOverrideKey,\s*getContentPackOverride\s*\}\s+from\s+'..\/tooling\/ContentPackOverrideStore\.js';\s*/u,
      to: 'const buildContentPackOverrideKey = () => "";\nconst getContentPackOverride = () => null;\n'
    }
  ]);
}

async function buildPackBackedManager() {
  const skillsPackPath = path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json');
  const rawPack = JSON.parse(await fs.readFile(skillsPackPath, 'utf8'));
  const skillsMap = Object.fromEntries((rawPack.skills || []).map(skill => [skill.id, skill]));
  const mod = await importDataManagerModule();
  const manager = mod.default;
  manager.gameConfig = {
    skills: skillsMap,
    player: {
      default: {
        skills: {
          skillTreeId: 'melee_v4_5'
        }
      }
    }
  };
  manager.contentPacks = {
    skills: {
      selectedTreeId: 'melee_v4_5',
      schemaVersion: rawPack.$schemaVersion || null,
      meta: rawPack.meta || null
    }
  };
  manager.skillCatalog = null;
  return manager;
}

test('UI_SkillTreeModal 只以正式字段决定技能树节点可见性', async () => {
  const { UI_SkillTreeModal } = await importSkillTreeModalModule();
  const modal = new UI_SkillTreeModal();

  assert.equal(
    modal._shouldRenderSkillNode({
      id: 'skill_hidden',
      editorMeta: { hiddenInSkillTree: true }
    }),
    false,
    'hiddenInSkillTree=true 的技能必须被隐藏'
  );

  assert.equal(
    modal._shouldRenderSkillNode({
      id: 'skill_demo_only',
      [legacyFieldKeys.field]: ['DEMO'],
      editorMeta: {}
    }),
    true,
    '技能树过滤不应再依赖 DEMO tag'
  );
});

test('UI_SkillPanel 从正式字段派生技能类型与图标，不再读取旧附加字段', async () => {
  const mod = await importSkillPanelModule();
  const UI_SkillPanel = mod.default;
  const panel = Object.create(UI_SkillPanel.prototype);
  panel._skillIconCache = new Map();

  assert.equal(
    panel.getSkillTypeLabel({
      id: 'skill_heal_no_tags',
      actions: [{ effect: { effectType: 'HEAL' } }]
    }),
    'HEAL',
    '治疗技能应从 actions 派生 HEAL 类型'
  );

  assert.equal(
    panel.getSkillTypeLabel({
      id: 'skill_damage_no_tags',
      actions: [{ effect: { effectType: 'DMG_ARMOR' } }]
    }),
    'DAMAGE',
    '伤害技能应从 actions 派生 DAMAGE 类型'
  );

  assert.equal(
    panel.getSkillTypeLabel({
      id: 'skill_buff_no_tags',
      buffRefs: { apply: [{ buffId: 'buff_guard_up' }] }
    }),
    'BUFF',
    'buff 技能应从 buffRefs 派生 BUFF 类型'
  );

  assert.equal(
    panel._pickSkillIcon({
      id: 'skill_heal_icon',
      name: '应急方案',
      description: '一个不包含显式关键词的技能',
      actions: [{ effect: { effectType: 'HEAL' } }]
    }),
    '✨',
    '图标选择应能依赖派生类型，而不是旧附加字段'
  );
});

test('DataManagerV2 不再把旧附加字段作为契约摘要与问题码来源', async () => {
  const manager = await buildPackBackedManager();

  const summary = manager.getSkillContractSummary('skill_block');
  assert.ok(summary && typeof summary === 'object', 'skill_block 契约摘要未返回对象');
  assert.equal(
    Object.prototype.hasOwnProperty.call(summary, 'tags'),
    false,
    '契约摘要不应继续暴露旧附加字段'
  );

  const blockIssues = manager.getSkillContractIssues('skill_block');
  const shockwaveIssues = manager.getSkillContractIssues('skill_shockwave');
  const regroupIssues = manager.getSkillContractIssues('skill_regroup');

  assert.equal(
    blockIssues.some(issue => issue.code === 'tag_subject_mismatch' || issue.code === legacyPropertyTokens.scopeDrift),
    false,
    '契约问题码不应继续产出旧附加字段漂移'
  );
  assert.equal(
    shockwaveIssues.some(issue => issue.code === legacyPropertyTokens.unexpectedEffect || issue.code === legacyPropertyTokens.missingEffect),
    false,
    '契约问题码不应继续产出效果漂移'
  );
  assert.equal(
    regroupIssues.some(issue => issue.code === legacyPropertyTokens.unexpectedEffect || issue.code === legacyPropertyTokens.missingEffect),
    false,
    '纯 buff 驱动技能不应继续依赖旧附加字段校验'
  );

  const rollup = manager.getSkillContractRemediationBatches({ includeAliases: true });
  const batchIds = Array.isArray(rollup?.batches) ? rollup.batches.map(batch => batch.id) : [];
  assert.equal(batchIds.includes(legacyPropertyTokens.oldBatchTarget), false, '修复批次不应继续包含旧目标批次');
  assert.equal(batchIds.includes(legacyPropertyTokens.oldBatchEffect), false, '修复批次不应继续包含旧效果批次');
});

test('技能编辑器不再暴露或保存旧技能附加字段', async () => {
  const htmlPath = path.join(projectRoot, 'test', 'skill_editor_test_v3.html');
  const jsPath = path.join(projectRoot, 'script', 'editor', 'skill', 'skillEditor.js');
  const [html, js] = await Promise.all([
    fs.readFile(htmlPath, 'utf8'),
    fs.readFile(jsPath, 'utf8')
  ]);

  for (const forbiddenText of [
    legacyPropertyTokens.editorPropField,
    legacyPropertyTokens.editorPropLegacyMeta,
    legacyPropertyTokens.editorFieldSearch,
    legacyPropertyTokens.editorFieldEditor,
    legacyPropertyTokens.metaEnumLegacy,
    legacyPropertyTokens.skillField,
    legacyPropertyTokens.skillLegacyMeta
  ]) {
    assert.equal(html.includes(forbiddenText) || js.includes(forbiddenText), false, `技能编辑链仍引用 ${forbiddenText}`);
  }
});

test('技能分析工具与共享回归页不再依赖旧技能附加字段', async () => {
  const balancePath = path.join(projectRoot, 'test', 'skill_balance_tool.html');
  const probePath = path.join(projectRoot, 'test', 'skill_contract_probe.html');
  const runnerPath = path.join(projectRoot, 'test', 'codex_regression_runner.html');
  const [balanceHtml, probeHtml, runnerHtml] = await Promise.all([
    fs.readFile(balancePath, 'utf8'),
    fs.readFile(probePath, 'utf8'),
    fs.readFile(runnerPath, 'utf8')
  ]);

  for (const forbiddenText of [
    legacyPropertyTokens.toolFilterField,
    legacyPropertyTokens.toolSaveField,
    legacyPropertyTokens.skillField,
    legacyPropertyTokens.scopeDrift,
    legacyPropertyTokens.unexpectedEffect,
    legacyPropertyTokens.missingEffect,
    legacyPropertyTokens.metaEnumLegacy
  ]) {
    assert.equal(
      balanceHtml.includes(forbiddenText) || probeHtml.includes(forbiddenText) || runnerHtml.includes(forbiddenText),
      false,
      `工具页或回归页仍引用 ${forbiddenText}`
    );
  }

  assert.equal(runnerHtml.includes('hiddenInSkillTree'), true, '共享回归页应改用 hiddenInSkillTree 验证技能树隐藏规则');
});

test('活动技能包与正式设计文档不再把旧技能附加字段作为活动 schema', async () => {
  const packPath = path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json');
  const designPaths = [
    path.join(projectRoot, 'DOC', 'CODEX_DOC', '02_设计说明', '03-技能系统(skill_design)-设计说明.md'),
    path.join(projectRoot, 'DOC', 'CODEX_DOC', '02_设计说明', '04-技能编辑器(skill_editor_design)-设计说明.md'),
    path.join(projectRoot, 'DOC', 'CODEX_DOC', '02_设计说明', '06-技能平衡(skill_balance_design)-设计说明.md')
  ];

  const rawPack = JSON.parse(await fs.readFile(packPath, 'utf8'));
  assert.equal(Boolean(rawPack?.meta?.enums?.[legacyFieldKeys.field]), false, '活动技能包不应继续定义旧枚举字段');
  for (const skill of rawPack.skills || []) {
    assert.equal(Object.prototype.hasOwnProperty.call(skill, legacyFieldKeys.field), false, `${skill.id} 不应继续保留旧附加字段`);
    assert.equal(Object.prototype.hasOwnProperty.call(skill, legacyFieldKeys.meta), false, `${skill.id} 不应继续保留旧附加参数字段`);
  }

  const designDocs = await Promise.all(designPaths.map(filePath => fs.readFile(filePath, 'utf8')));
  for (const doc of designDocs) {
    for (const forbiddenText of [legacyPackFieldToken, legacyPropertyTokens.metaEnumLegacy, legacySkillFieldToken]) {
      assert.equal(doc.includes(forbiddenText), false, `正式设计文档仍保留旧口径: ${forbiddenText}`);
    }
  }
});

test('高风险路径不再保留旧技能附加字段残留', async () => {
  const checkedFiles = [
    path.join(projectRoot, 'assets', 'data', 'skills_melee_v3.json'),
    path.join(projectRoot, 'assets', 'data', 'skills_melee_v4.json'),
    path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_4.json'),
    path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json'),
    path.join(projectRoot, 'DOC', 'CODEX_DOC', '02_设计说明', '01-核心引擎(core_engine)-设计说明.md'),
    path.join(projectRoot, 'DOC', 'CODEX_DOC', '02_设计说明', '03-技能系统(skill_design)-设计说明.md'),
    path.join(projectRoot, 'DOC', 'CODEX_DOC', '02_设计说明', '04-技能编辑器(skill_editor_design)-设计说明.md'),
    path.join(projectRoot, 'DOC', 'CODEX_DOC', '02_设计说明', '06-技能平衡(skill_balance_design)-设计说明.md'),
    path.join(projectRoot, 'script', 'editor', 'skill', 'skillEditor.js'),
    path.join(projectRoot, 'script', 'engine', 'DataManagerV2.js'),
    path.join(projectRoot, 'script', 'ui', 'UI_SkillPanel.js'),
    path.join(projectRoot, 'script', 'ui', 'UI_SkillTreeModal.js'),
    path.join(projectRoot, 'test', 'codex_regression_runner.html'),
    path.join(projectRoot, 'test', 'skill_balance_tool.html'),
    path.join(projectRoot, 'test', 'skill_contract_probe.html'),
    path.join(projectRoot, 'test', 'skill_editor_test_v3.html')
  ];
  const forbiddenTextList = [
    legacyPropertyTokens.skillField,
    legacyPropertyTokens.skillLegacyMeta,
    legacyPropertyTokens.metaEnumLegacy,
    legacyPropertyTokens.packField,
    legacyPropertyTokens.packLegacyMeta,
    legacyPropertyTokens.scopeDrift,
    legacyPropertyTokens.unexpectedEffect,
    legacyPropertyTokens.missingEffect
  ];

  for (const filePath of checkedFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    for (const forbiddenText of forbiddenTextList) {
      assert.equal(content.includes(forbiddenText), false, `${path.basename(filePath)} 仍保留残留口径: ${forbiddenText}`);
    }
  }

  for (const removedFile of [
    path.join(projectRoot, 'test', 'skill_editor_test_v2.html'),
    path.join(projectRoot, 'script', 'editor', 'skill', '_legacy_skillEditor_v2_extracted.js')
  ]) {
    assert.equal(fsSync.existsSync(removedFile), false, `${path.basename(removedFile)} 应从高风险路径中移除`);
  }
});
