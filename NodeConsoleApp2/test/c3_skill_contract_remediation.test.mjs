import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importDataManagerModule() {
  const filePath = path.join(projectRoot, 'script', 'engine', 'DataManagerV2.js');
  let source = await fs.readFile(filePath, 'utf8');
  source = source.replace(
    /^import\s+\{\s*buildContentPackOverrideKey,\s*getContentPackOverride\s*\}\s+from\s+'..\/tooling\/ContentPackOverrideStore\.js';\s*/u,
    'const buildContentPackOverrideKey = () => "";\nconst getContentPackOverride = () => null;\n'
  );
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

async function buildSkillContractManager() {
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

test('WBS-3.3.3 首批结构异常修复后不再报告选择数量越界', async () => {
  const manager = await buildSkillContractManager();
  for (const skillId of [
    'skill_block',
    'skill_aegis',
    'skill_hold_the_line_copy_1769790933469',
    'skill_shockwave_copy_1770041956468',
    'skill_bone_repair',
    'skill_escape'
  ]) {
    const issues = manager.getSkillContractIssues(skillId);
    assert.equal(
      issues.some(issue => issue.code === 'selection_count_exceeds_candidates'),
      false,
      `${skillId} 仍然存在 selection_count_exceeds_candidates`
    );
    assert.equal(
      issues.some(issue => issue.code === 'single_selection_count_invalid'),
      false,
      `${skillId} 仍然存在 single_selection_count_invalid`
    );
  }
});

test('WBS-3.3.3 会把技能异常汇总到正式修复批次', async () => {
  const manager = await buildSkillContractManager();
  assert.equal(typeof manager.getSkillContractRemediationBatches, 'function', '缺少 getSkillContractRemediationBatches()');
  const rollup = manager.getSkillContractRemediationBatches({ includeAliases: true });
  assert.equal(rollup?.ownerNode, 'WBS-3.3.3', 'ownerNode 应回写到 WBS-3.3.3');
  assert.ok(Array.isArray(rollup?.batches) && rollup.batches.length >= 3, '修复批次汇总数量不足');
  const structureBatch = rollup.batches.find(batch => batch.id === 'batch_structure_selection');
  assert.ok(structureBatch, '缺少结构选择批次');
  assert.equal(structureBatch.openIssueCount, 0, '结构选择批次应已完成首批收口');
  assert.ok(Array.isArray(structureBatch.issueCodes) && structureBatch.issueCodes.includes('selection_count_exceeds_candidates'), '结构选择批次未包含预期 issue code');
  assert.equal(structureBatch.closedAt, '2026-04-11 09:10:19 +0800', `结构选择批次应回写关闭时间，当前为 ${structureBatch.closedAt}`);
  assert.ok(Array.isArray(structureBatch.affectedSkills) && structureBatch.affectedSkills.some(skill => skill.skillId === 'skill_block'), '结构选择批次应保留已修复技能样本');
  const effectBatch = rollup.batches.find(batch => batch.id === 'batch_effect_tags');
  assert.ok(effectBatch && effectBatch.openIssueCount > 0, '效果标签批次应仍保留后续待修问题');
});

test('WBS-3.3.3 会生成面向人工验收的技能状态总表', async () => {
  const manager = await buildSkillContractManager();
  assert.equal(typeof manager.getSkillContractStatusBoard, 'function', '缺少 getSkillContractStatusBoard()');
  const board = manager.getSkillContractStatusBoard();
  assert.ok(Array.isArray(board?.rows) && board.rows.length > 0, '技能状态总表为空');

  const skillBlock = board.rows.find(row => row.skillId === 'skill_block');
  assert.ok(skillBlock, '技能状态总表缺少 skill_block');
  assert.equal(skillBlock.status, '已修复', `skill_block 应标记为已修复，当前为 ${skillBlock?.status}`);
  assert.equal(skillBlock.fixedAt, '2026-04-11 09:10:19 +0800', `skill_block 修复时间错误: ${skillBlock?.fixedAt}`);
  assert.match(skillBlock.reason, /selectCount|single/i, 'skill_block 原因说明不包含结构选择异常');
  assert.match(skillBlock.remediation, /single|candidateParts|selectCount/i, 'skill_block 修改方法未写明结构修复方式');

  const problematic = board.rows.find(row => row.status === '未修复');
  assert.ok(problematic, '技能状态总表至少应存在一个未修复技能');
  assert.ok(problematic.reason.length > 0, '未修复技能缺少原因说明');
  assert.ok(problematic.remediation.length > 0, '未修复技能缺少修改方法说明');

  const normal = board.rows.find(row => row.status === '正常');
  assert.ok(normal, '技能状态总表至少应存在一个正常技能');
  assert.equal(normal.fixedAt, '', '正常技能不应带修复时间');
});

test('skill_contract_probe 会解释 WBS-3.3.3 的异常分批闭环与去向', async () => {
  const filePath = path.join(projectRoot, 'test', 'skill_contract_probe.html');
  const html = await fs.readFile(filePath, 'utf8');
  for (const requiredText of [
    'WBS-3.3.3',
    '异常分批闭环',
    '当前节点负责的批次',
    '已关闭批次',
    '后续批次',
    'selection_count_exceeds_candidates',
    '非本节点'
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('codex_regression_runner 会提供 scope 过滤与非本节点失败说明', async () => {
  const filePath = path.join(projectRoot, 'test', 'codex_regression_runner.html');
  const html = await fs.readFile(filePath, 'utf8');
  for (const requiredText of [
    'scope=',
    '当前节点范围',
    '非本节点失败项',
    'WBS-3.3.3',
    '共享回归页',
    '只运行当前范围'
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('skill_contract_probe 会把技能状态总表作为主阅读入口', async () => {
  const filePath = path.join(projectRoot, 'test', 'skill_contract_probe.html');
  const html = await fs.readFile(filePath, 'utf8');
  for (const requiredText of [
    '技能状态总表',
    '状态（正常，已修复，未修复）',
    '修复时间',
    '问题原因',
    '修改方法'
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
