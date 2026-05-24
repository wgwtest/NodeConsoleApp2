import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const simulatorPath = path.join(projectRoot, 'tools', 'campaign_balance_simulator.mjs');

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
