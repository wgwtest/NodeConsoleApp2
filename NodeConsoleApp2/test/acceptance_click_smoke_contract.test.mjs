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
  assert.match(
    toolSource,
    /const targetLevelIds = \["level_1_1", "level_1_2", "level_1_3", "level_1_4", "level_1_5", "level_1_6", "level_1_7", "level_1_8", "level_1_9", "level_1_10"\];/u
  );
  assert.match(
    toolSource,
    /const targetLevelIds = \["level_2_1", "level_2_2", "level_2_3", "level_2_4", "level_2_5", "level_2_6", "level_2_7", "level_2_8", "level_2_9", "level_2_10"\];/u
  );
  assert.match(
    toolSource,
    /const targetLevelIds = \["level_3_1", "level_3_2", "level_3_3", "level_3_4", "level_3_5", "level_3_6", "level_3_7", "level_3_8", "level_3_9", "level_3_10"\];/u
  );
  assert.match(
    toolSource,
    /const targetChapterCount = 2;/u
  );
  assert.match(
    toolSource,
    /const naturalProgressionLevels = Array\.from\(\{ length: targetChapterCount \}, \(_, chapterIndex\) => Array\.from\(\{ length: 10 \}, \(_, levelIndex\) => `level_\$\{chapterIndex \+ 1\}_\$\{levelIndex \+ 1\}`\)\)\.flat\(\);/u
  );

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
    'runChapterOneProgressionSmoke',
    'chapterOneProgression',
    'runChapterTwoProgressionSmoke',
    'chapterTwoProgression',
    'runChapterThreeProgressionSmoke',
    'chapterThreeProgression',
    'runNaturalProgressiveCampaignSmoke',
    'naturalProgressiveCampaign',
    'naturalProgressionLevels',
    'naturalProgressiveSkillTreeSnapshots',
    'naturalProgressiveLearningSnapshots',
    'initialSkillPointsOverride',
    'skillTreeBeforeLearning',
    'skillTreeAfterLearning',
    'skillTreeAfterSettlement',
    'naturalProgressiveOutcome',
    'learnedThisLevel',
    'firstChapterNaturalProgression',
    'secondChapterNaturalProgression',
    'pickWeakestEnemyPart',
    'pickMostDamagedSelfPart',
    'summarizeNaturalProgressiveSkill',
    'scoreNaturalProgressiveSkill',
    'naturalProgressiveFinishWindow',
    'naturalProgressiveBossSurvivalFloor',
    'naturalProgressiveBossFinishSustainReserve',
    'naturalProgressiveBossSecondaryDamagePenalty',
    'naturalProgressiveFirstBossArmorBreakWindow',
    'installNaturalProgressiveFastTimeline',
    'getNaturalProgressiveMaxTurns',
    'naturalProgressiveHighPressureLevels',
    'skipSelfDamageSkillsForBoss',
    'selfDamageSkillIds',
    'skill_block',
    'skill_1771769351059',
    'skill_skull_cracker',
    'skill_regroup',
    'skill_shockwave_copy_1770042951717',
    'level_1_1',
    'level_1_2',
    'level_1_3',
    'level_1_4',
    'level_1_5',
    'level_1_6',
    'level_1_7',
    'level_1_8',
    'level_1_9',
    'level_1_10',
    'level_2_1',
    'level_2_2',
    'level_2_3',
    'level_2_4',
    'level_2_5',
    'level_2_6',
    'level_2_7',
    'level_2_8',
    'level_2_9',
    'level_2_10',
    'level_3_1',
    'runNaturalBattleAutoplaySmoke',
    'naturalBattleAutoplay',
    'naturalOutcome',
    'forcedSettlementUsed',
    'maxNaturalTurns',
    'naturalTurnSnapshots',
    'naturalCheckpointResults',
    'naturalCheckpointSummary',
    'naturalBalanceProbeBuild',
    'naturalLateGameProbeBuild',
    'skillLoadoutSource',
    'lateGameNaturalProbeBuild',
    'terminalBossNaturalOutcome',
    'terminalSurvivalFloor',
    'maintainTerminalBleedWindow',
    'terminalSustainRotation',
    'stopFillingTerminalPressureActions',
    'lethalFailureDiagnosis',
    'mutualKill',
    'playerHpBeforeFinalTurn',
    'enemyRemainingHpBeforeFinalTurn',
    'playerHpAfterFinalTurn',
    'enemyRemainingHpAfterFinalTurn',
    'diagnosisCode',
    'level_1_4',
    'level_1_10',
    'level_2_5',
    'level_2_10',
    'level_3_10',
    'skill_regroup',
    'skill_execute_copy_1770044052832',
    'mutual_kill_settlement_loss',
    'level_1_3',
    'level_1_4',
    'level_2_1',
    'level_2_9',
    'level_3_1',
    'level_3_9',
    'roundExecuted',
    'settlementSnapshots',
    '提交规划',
    '执行回合',
    '模板：未知类别（降级）',
    '保存到工作区',
    '导出 JSON'
  ]) {
    assert.match(toolSource, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});

test('终局压力自动战斗在残血窗口应优先收尾而不是继续纯续航', async () => {
  const toolSource = await readProjectFile('tools/acceptance_click_smoke.mjs');
  const pressureEnemyBranch = toolSource.match(
    /if \(checkpoint\.requirePressure\) \{\n\s+const playerBaseSpeed[\s\S]+?\n\s+return score;\n\s+\}/u
  )?.[0] || '';

  assert.match(pressureEnemyBranch, /terminalFinishWindow/u);
  assert.match(pressureEnemyBranch, /terminalDirectFinishBonus/u);
  assert.match(pressureEnemyBranch, /terminalNonDamageFinishPenalty/u);
  assert.match(
    pressureEnemyBranch,
    /terminalFinishWindow && summary\.damageHp <= 0 && summary\.damageArmor <= 0/u,
    '终局残血窗口应压低不造成直接伤害的续航技能，避免 Boss 剩余少量 HP 时继续拖回合'
  );
  assert.match(
    pressureEnemyBranch,
    /if \(terminalFinishWindow && summary\.damageHp >= getEntityHp\(target\)\) score \+= terminalDirectFinishBonus;/u,
    '终局残血窗口应给可直接击杀技能足够高的优先级'
  );
});
