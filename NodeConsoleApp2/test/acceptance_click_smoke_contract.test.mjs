import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function readProjectFile(relativePath) {
  return fs.readFile(path.join(projectRoot, relativePath), 'utf8');
}

test('自动点击验收脚本固定主流程与专项页面覆盖范围', async () => {
  const [toolSource, packageJson] = await Promise.all([
    readProjectFile('tools/acceptance_click_smoke.mjs'),
    readProjectFile('package.json')
  ]);

  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['test:acceptance-clicks'], 'node tools/acceptance_click_smoke.mjs');

  for (const requiredText of [
    'mock_ui_v11.html',
    'battle_presentation_probe.html',
    'battle_presentation_configurator.html',
    'http://127.0.0.1:3111',
    'http://127.0.0.1:9223',
    'http://127.0.0.1:3101',
    'http://127.0.0.1:9222',
    '新游戏',
    '关卡选择',
    'chapter_1_authoring_map',
    'chapter_2_authoring_map',
    'chapter_3_authoring_map',
    'level_1_10',
    'level_2_10',
    'level_3_10',
    'runLevelSelectMultiMapSmoke',
    'runSettlementRewardSmoke',
    'GameEngine.endBattle(true)',
    '战斗胜利',
    '本局奖励',
    '首次通关',
    '返回主菜单',
    'runPostSettlementProgressionSmoke',
    '前往下一关',
    'level_1_2',
    '前往技能树 / 构筑',
    '.ui-skilltree__nodeAction',
    '提交并关闭',
    '最近学习结果',
    'runLearnedSkillBattleExecutionSmoke',
    'learnedSkillBattleExecution',
    'skill_block',
    'newlyLearnedSkill',
    'executedLearnedSkill',
    '提交规划',
    '执行回合',
    '模板：未知类别（降级）',
    '保存到工作区',
    '导出 JSON'
  ]) {
    assert.match(toolSource, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});
