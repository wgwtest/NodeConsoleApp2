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
  assert.equal(written.summaryPath, path.join(outputDir, 'campaign-balance-summary.md'));

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
