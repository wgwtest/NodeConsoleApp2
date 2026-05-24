import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const simulatorPath = path.join(projectRoot, 'tools', 'campaign_balance_simulator.mjs');

function balanceSignature(report) {
  return report.results
    .map(row => [
      row.levelId,
      row.buildId,
      row.victory ? 'Y' : 'N',
      row.turns,
      row.playerRemainingHp,
      row.enemyRemainingHp,
      row.failureReason,
      row.diagnosis
    ].join(':'))
    .join('\n');
}

test('campaign balance simulator covers 30 story levels with three player builds and writes report artifacts', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  assert.equal(typeof simulator.runCampaignBalanceSimulation, 'function');
  assert.equal(typeof simulator.writeCampaignBalanceReport, 'function');

  const report = await simulator.runCampaignBalanceSimulation({ projectRoot, maxTurns: 12 });

  assert.equal(report.meta.levelCount, 30);
  assert.deepEqual(report.meta.buildIds, ['basic', 'recommended', 'specialist']);
  assert.equal(report.results.length, 90);

  for (const row of report.results) {
    assert.match(row.levelId, /^level_[123]_\d+$/u);
    assert(['basic', 'recommended', 'specialist'].includes(row.buildId), `未知构筑 ${row.buildId}`);
    assert.equal(typeof row.victory, 'boolean');
    assert.equal(Number.isInteger(row.turns), true);
    assert.equal(typeof row.playerRemainingHp, 'number');
    assert.equal(typeof row.enemyRemainingHp, 'number');
    assert.equal(row.playerSkillUsage && typeof row.playerSkillUsage, 'object');
    assert.equal(row.enemySkillUsage && typeof row.enemySkillUsage, 'object');
    assert.equal(typeof row.failureReason, 'string');
    assert.equal(typeof row.diagnosis, 'string');
  }

  assert.equal(report.summary.byBuild.length, 3);
  assert.equal(report.summary.byChapter.length, 9);
  assert.equal(report.summary.diagnosisCounts && typeof report.summary.diagnosisCounts, 'object');
  assert.deepEqual(
    Object.keys(report.summary.diagnosisLegend).sort(),
    [
      'boss_too_easy',
      'enemy_numbers_too_high',
      'enemy_skill_pressure_high',
      'enemy_too_weak',
      'expected_basic_build_limit',
      'ok',
      'player_build_mismatch',
      'player_skill_tree_gap_candidate'
    ].sort()
  );
  assert.equal(report.summary.recommendations.length > 0, true);

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-balance-'));
  const reportPath = path.join(outputDir, 'campaign-balance-report.json');
  const written = await simulator.writeCampaignBalanceReport(report, { reportPath });

  assert.equal(written.reportPath, reportPath);
  assert.equal(written.summaryPath, path.join(outputDir, 'campaign-balance-report-summary.md'));

  const savedReport = JSON.parse(await fs.readFile(written.reportPath, 'utf8'));
  const savedSummary = await fs.readFile(written.summaryPath, 'utf8');

  assert.equal(savedReport.results.length, 90);
  assert.match(savedSummary, /# Campaign Balance Summary/u);
  assert.match(savedSummary, /level_1_1/u);
});

test('campaign balance simulator produces repeatable seeded reports', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const first = await simulator.runCampaignBalanceSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-repeatable-report'
  });
  const second = await simulator.runCampaignBalanceSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-repeatable-report'
  });

  assert.equal(first.meta.randomSeed, 'wbs-3.4.5-repeatable-report');
  assert.equal(second.meta.randomSeed, 'wbs-3.4.5-repeatable-report');
  assert.equal(balanceSignature(first), balanceSignature(second));
});

test('progressive campaign simulator follows level rewards and records skill tree state', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  assert.equal(typeof simulator.runProgressiveCampaignSimulation, 'function');

  const report = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-progressive-campaign'
  });

  assert.equal(report.meta.levelCount, 30);
  assert.equal(report.meta.mode, 'progressive');
  assert.equal(report.results.length, 30);
  assert.equal(report.results[0].levelId, 'level_1_1');
  assert.equal(report.results.at(-1).levelId, 'level_3_10');

  const first = report.results[0];
  assert.equal(first.skillTreeBefore && typeof first.skillTreeBefore, 'object');
  assert.equal(first.skillTreeAfter && typeof first.skillTreeAfter, 'object');
  assert.equal(Array.isArray(first.skillTreeBefore.learned), true);
  assert.equal(Array.isArray(first.skillTreeAfter.learned), true);
  assert.equal(Array.isArray(first.learnedThisLevel), true);
  assert.equal(first.rewards && typeof first.rewards.kp, 'number');
  assert.equal(first.skillTreeAfter.skillPoints >= 0, true);

  const anyLearning = report.results.some(row => row.learnedThisLevel.length > 0);
  assert.equal(anyLearning, true, '进度式模拟应在可用 KP 和前置满足时自动学习技能');
  assert.equal(report.summary && typeof report.summary.skillTreeGapCandidates, 'number');
  assert.equal(Array.isArray(report.summary.finalLearned), true);

  const safeFailures = report.results.filter(row => !row.victory && row.playerRemainingHp >= 60 && !row.levelClass?.isBoss);
  assert.equal(
    safeFailures.length <= 2,
    true,
    `进度构筑安全残血超时关卡过多：${safeFailures.map(row => `${row.levelId}:${row.enemyRemainingHp}`).join(', ')}`
  );
  assert.equal(
    safeFailures.every(row => row.diagnosis === 'enemy_numbers_too_high'),
    true,
    `进度构筑安全失败应归因为敌人数值拖死：${safeFailures.map(row => `${row.levelId}:${row.diagnosis}`).join(', ')}`
  );
  const chapterTwoBoss = report.results.find(row => row.levelId === 'level_2_10');
  assert.equal(
    Boolean(chapterTwoBoss?.victory && chapterTwoBoss.playerRemainingHp >= 100),
    false,
    '进度构筑不应满血通过第二章 Boss'
  );
});

test('progressive campaign report can be written with learning and reward details', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-progressive-report'
  });

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-progressive-'));
  const reportPath = path.join(outputDir, 'campaign-progressive-report.json');
  const written = await simulator.writeCampaignBalanceReport(report, { reportPath });
  const savedReport = JSON.parse(await fs.readFile(written.reportPath, 'utf8'));
  const savedSummary = await fs.readFile(written.summaryPath, 'utf8');

  assert.equal(written.summaryPath, path.join(outputDir, 'campaign-progressive-report-summary.md'));
  assert.equal(savedReport.meta.mode, 'progressive');
  assert.equal(savedReport.results.length, 30);
  assert.match(savedSummary, /# Campaign Balance Summary/u);
  assert.match(savedSummary, /Mode: progressive/u);
  assert.match(savedSummary, /## Progressive Learning Summary/u);
  assert.match(savedSummary, /Final learned skills/u);
  assert.match(savedSummary, /Learned this level/u);
  assert.match(savedSummary, /Rewards KP/u);
});

test('campaign runtime smoke enters all 30 story levels and executes the first combat round', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  assert.equal(typeof simulator.runCampaignRuntimeSmoke, 'function');

  const report = await simulator.runCampaignRuntimeSmoke({
    projectRoot,
    randomSeed: 'wbs-3.4.13-runtime-smoke'
  });

  assert.equal(report.meta.mode, 'runtime_smoke');
  assert.equal(report.meta.levelCount, 30);
  assert.equal(report.results.length, 30);
  assert.equal(report.results[0].levelId, 'level_1_1');
  assert.equal(report.results.at(-1).levelId, 'level_3_10');

  for (const row of report.results) {
    assert.equal(row.instantiatedEnemyCount >= 1, true, `${row.levelId} 应实例化至少 1 个敌人`);
    assert.equal(row.playerPlanCount >= 1, true, `${row.levelId} 应能生成首回合玩家规划`);
    assert.equal(row.enemyPlanCount >= 1, true, `${row.levelId} 应能生成首回合敌方计划`);
    assert.equal(row.timelineEntryCount >= row.playerPlanCount + row.enemyPlanCount, true, `${row.levelId} 时间轴应包含敌我行动`);
    assert.equal(row.turnResult.ok, true, `${row.levelId} 首回合执行失败：${row.turnResult.reason || 'unknown'}`);
    assert.equal(row.currentTurn >= 2 || row.settled === true, true, `${row.levelId} 首回合执行后应推进回合或进入结算`);
  }

  assert.deepEqual(report.summary.failedLevels, []);
  assert.equal(report.summary.coveredLevels, 30);
});

test('progressive campaign diagnoses boss and elite lethal failures as enemy pressure, not skill tree gaps', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-progressive-pressure-diagnosis'
  });

  const lethalBossOrEliteFailures = report.results.filter(row => (
    !row.victory
    && row.playerRemainingHp < 60
    && (row.levelClass?.isBoss || row.levelClass?.isElite)
  ));
  assert.deepEqual(
    lethalBossOrEliteFailures.map(row => `${row.levelId}:${row.diagnosis}`),
    lethalBossOrEliteFailures.map(row => `${row.levelId}:enemy_skill_pressure_high`)
  );
  assert.equal(
    report.summary.skillTreeGapCandidates,
    report.results.filter(row => row.diagnosis === 'player_skill_tree_gap_candidate').length,
    '技能树缺口候选数量应只统计被逐关诊断为玩家技能树缺口的失败'
  );
});

test('progressive campaign uses learned late defensive and sustain skills in pressure fights', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.8-progressive-late-skill-usage'
  });

  const pressureRows = report.results.filter(row => ['level_2_10', 'level_3_9', 'level_3_10'].includes(row.levelId));
  assert.equal(pressureRows.length, 3);
  assert.equal(
    pressureRows.every(row => row.skillTreeBefore.learned.includes('skill_regroup')),
    true,
    '后期压力关前应已经学会受击备甲'
  );
  assert.equal(
    pressureRows.every(row => row.skillTreeBefore.learned.includes('skill_execute_copy_1770044052832')),
    true,
    '后期压力关前应已经学会吸血'
  );
  assert.equal(
    pressureRows.some(row => (row.playerSkillUsage.skill_regroup || 0) > 0),
    true,
    `后期压力关应实际使用受击备甲：${pressureRows.map(row => `${row.levelId}:${row.playerSkillUsage.skill_regroup || 0}`).join(', ')}`
  );
  assert.equal(
    pressureRows.some(row => (row.playerSkillUsage.skill_execute_copy_1770044052832 || 0) > 0),
    true,
    `后期压力关应实际使用吸血：${pressureRows.map(row => `${row.levelId}:${row.playerSkillUsage.skill_execute_copy_1770044052832 || 0}`).join(', ')}`
  );
});

test('progressive late skill plan keeps basic heal and direct damage available', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.8-progressive-plan-keeps-foundation'
  });

  const firstBoss = report.results.find(row => row.levelId === 'level_1_10');
  assert(firstBoss, '缺少第一章 Boss 结果');
  assert.equal(firstBoss.victory, true, '补入后期技能后不应让第一章 Boss 从可通关退化为失败');
  assert.equal(
    (firstBoss.playerSkillUsage.skill_heal || 0) > 0,
    true,
    `第一章 Boss 压力战仍应能使用基础治疗：${JSON.stringify(firstBoss.playerSkillUsage)}`
  );
  assert.equal(
    (firstBoss.playerSkillUsage.skill_heavy_swing || 0) > 0,
    true,
    `第一章 Boss 压力战仍应保留基础直伤：${JSON.stringify(firstBoss.playerSkillUsage)}`
  );
});

test('progressive campaign final boss remains a pressure fight after late sustain tuning', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.8-final-boss-pressure'
  });

  const finalBoss = report.results.find(row => row.levelId === 'level_3_10');
  assert(finalBoss, '缺少第三章 Boss 结果');
  assert.equal(finalBoss.victory, true, '进度式构筑应能通关第三章 Boss');
  assert.equal(
    finalBoss.playerRemainingHp < finalBoss.playerMaxHp * 0.75,
    true,
    `第三章 Boss 不应被高血量通过：${finalBoss.playerRemainingHp}/${finalBoss.playerMaxHp}`
  );
  assert.equal(
    (finalBoss.playerSkillUsage.skill_execute_copy_1770044052832 || 0) > 0,
    true,
    `第三章 Boss 应促使玩家实际使用后期吸血：${JSON.stringify(finalBoss.playerSkillUsage)}`
  );
});

test('progressive campaign chapter two boss is passable but still dangerous', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.9-chapter-two-boss-pressure'
  });

  const chapterTwoBoss = report.results.find(row => row.levelId === 'level_2_10');
  assert(chapterTwoBoss, '缺少第二章 Boss 结果');
  assert.equal(chapterTwoBoss.victory, true, '进度式构筑应能通过第二章 Boss，避免主线卡死');
  assert.equal(
    chapterTwoBoss.playerRemainingHp > 0 && chapterTwoBoss.playerRemainingHp < chapterTwoBoss.playerMaxHp * 0.55,
    true,
    `第二章 Boss 应低血量通过而不是满血或失败：${chapterTwoBoss.playerRemainingHp}/${chapterTwoBoss.playerMaxHp}`
  );
  assert.equal(
    (chapterTwoBoss.playerSkillUsage.skill_execute_copy_1770044052832 || 0) > 0,
    true,
    `第二章 Boss 应触发后期吸血作为反制：${JSON.stringify(chapterTwoBoss.playerSkillUsage)}`
  );
});

test('campaign balance first tuning pass keeps recommended build viable without letting specialist outperform it', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runCampaignBalanceSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-balance-gate'
  });

  const recommended = report.summary.byBuild.find(row => row.buildId === 'recommended');
  const specialist = report.summary.byBuild.find(row => row.buildId === 'specialist');
  const recommendedRows = report.results.filter(row => row.buildId === 'recommended');
  const recommendedNumberFailures = recommendedRows.filter(row => (
    row.diagnosis === 'enemy_numbers_too_high'
    && !row.levelClass?.isBoss
  ));
  const recommendedBossRows = recommendedRows.filter(row => row.levelClass?.isBoss);
  const recommendedBossWins = recommendedBossRows.filter(row => row.victory);
  const recommendedBossTooEasy = recommendedBossRows.filter(row => row.diagnosis === 'boss_too_easy');

  assert(recommended, '缺少 recommended 构筑统计');
  assert(specialist, '缺少 specialist 构筑统计');
  assert.equal(recommended.attempts, 30);
  assert.equal(specialist.attempts, 30);
  assert.equal(recommended.winRate >= 0.8, true, `recommended 胜率过低：${recommended.wins}/30`);
  assert.equal(recommended.winRate <= 0.9, true, `recommended 胜率过高：${recommended.wins}/30`);
  assert.equal(specialist.wins <= recommended.wins, true, `specialist 不应比 recommended 胜场更高：${specialist.wins} vs ${recommended.wins}`);
  assert.equal(
    specialist.averagePlayerRemainingHp <= recommended.averagePlayerRemainingHp - 20,
    true,
    `specialist 应在通关质量上明显吃亏：${specialist.averagePlayerRemainingHp.toFixed(1)} vs ${recommended.averagePlayerRemainingHp.toFixed(1)}`
  );
  assert.equal(
    report.summary.recommendations.some(item => item.includes('偏科构筑没有明显吃亏')),
    false,
    '当偏科构筑胜率相同但剩余 HP 明显更低时，报告不应提示偏科没有明显吃亏'
  );
  assert.equal(recommendedNumberFailures.length <= 2, true, `recommended 数值拖死关卡过多：${recommendedNumberFailures.map(row => row.levelId).join(', ')}`);
  assert.equal(recommendedBossWins.length >= 1, true, 'recommended 至少应能打过 1 个 Boss');
  assert.equal(recommendedBossWins.length <= 2, true, 'recommended 不应稳定打过全部 Boss');
  assert.equal(recommendedBossTooEasy.length, 0, `Boss 过弱数量过多：${recommendedBossTooEasy.map(row => row.levelId).join(', ')}`);
});

test('campaign balance second tuning pass removes safe timeout failures from non-boss story levels', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const fixedReport = await simulator.runCampaignBalanceSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-safe-timeout-gate'
  });
  const progressiveReport = await simulator.runProgressiveCampaignSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.5-safe-timeout-gate'
  });

  const recommendedSafeTimeouts = fixedReport.results.filter(row => (
    row.buildId === 'recommended'
    && !row.levelClass?.isBoss
    && !row.victory
    && row.failureReason === 'turn_limit'
    && row.playerRemainingHp >= 60
  ));
  const progressiveSafeTimeouts = progressiveReport.results.filter(row => (
    !row.levelClass?.isBoss
    && !row.victory
    && row.failureReason === 'turn_limit'
    && row.playerRemainingHp >= 60
  ));
  const recommendedBossRows = fixedReport.results.filter(row => row.buildId === 'recommended' && row.levelClass?.isBoss);
  const recommendedBossWins = recommendedBossRows.filter(row => row.victory);

  assert.deepEqual(
    recommendedSafeTimeouts.map(row => row.levelId),
    [],
    `recommended 非 Boss 关不应安全超时：${recommendedSafeTimeouts.map(row => `${row.levelId}:${row.enemyRemainingHp}`).join(', ')}`
  );
  assert.deepEqual(
    progressiveSafeTimeouts.map(row => row.levelId),
    [],
    `progressive 非 Boss 关不应安全超时：${progressiveSafeTimeouts.map(row => `${row.levelId}:${row.enemyRemainingHp}`).join(', ')}`
  );
  assert.equal(recommendedBossWins.length >= 1, true, 'recommended 至少应能打过 1 个 Boss');
  assert.equal(recommendedBossWins.length <= 2, true, 'recommended 不应稳定打过全部 Boss');
});

test('campaign balance midgame armor repair and status levels create real attrition', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runCampaignBalanceSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.10-midgame-attrition'
  });

  const targetLevels = new Set(['level_2_5', 'level_2_6', 'level_2_7', 'level_3_5', 'level_3_6']);
  const rows = report.results.filter(row => targetLevels.has(row.levelId));
  assert.equal(rows.length, targetLevels.size * 3, '应覆盖 5 个中段压力关的 3 套固定构筑结果');

  const weakRows = rows.filter(row => row.diagnosis === 'enemy_too_weak');
  assert.equal(
    weakRows.length <= 4,
    true,
    `中段护甲/修复/状态关不应继续大面积满血碾压：${weakRows.map(row => `${row.levelId}:${row.buildId}`).join(', ')}`
  );

  const recommendedRows = rows.filter(row => row.buildId === 'recommended');
  assert.equal(
    recommendedRows.every(row => row.victory && row.playerRemainingHp < row.playerMaxHp),
    true,
    `推荐构筑应可通关但产生损耗：${recommendedRows.map(row => `${row.levelId}:${row.playerRemainingHp}/${row.playerMaxHp}:${row.diagnosis}`).join(', ')}`
  );
});

test('campaign balance remaining weak rows are not concentrated on repair or plague enemies', async () => {
  const simulator = await import(pathToFileURL(simulatorPath));
  const report = await simulator.runCampaignBalanceSimulation({
    projectRoot,
    maxTurns: 12,
    randomSeed: 'wbs-3.4.11-remaining-weak-concentration'
  });

  const weakRows = report.results.filter(row => row.diagnosis === 'enemy_too_weak');
  assert.equal(
    weakRows.length <= 4,
    true,
    `剩余 enemy_too_weak 不应继续超过 4 条：${weakRows.map(row => `${row.levelId}:${row.buildId}`).join(', ')}`
  );

  const repeatedWeakRows = weakRows.filter(row => (
    ['level_2_5', 'level_3_6', 'level_3_2', 'level_3_8'].includes(row.levelId)
  ));
  assert.equal(
    repeatedWeakRows.length <= 2,
    true,
    `残甲骷髅卫士/疫雾召唤者不应继续构成主要偏弱来源：${repeatedWeakRows.map(row => `${row.levelId}:${row.buildId}`).join(', ')}`
  );

  const recommendedWeakRows = weakRows.filter(row => row.buildId === 'recommended');
  assert.deepEqual(
    recommendedWeakRows.map(row => row.levelId),
    [],
    `推荐构筑不能继续在剩余弱关中无压通过：${recommendedWeakRows.map(row => `${row.levelId}:${row.playerRemainingHp}/${row.playerMaxHp}`).join(', ')}`
  );
});
