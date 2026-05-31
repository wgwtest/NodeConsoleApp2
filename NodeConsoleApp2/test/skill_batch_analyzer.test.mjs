import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { analyzeBatchSummary } from '../script/editor/skill_tester/skillBatchAnalyzerModel.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pagePath = path.join(projectRoot, 'test', 'skill_batch_analyzer.html');
const appPath = path.join(projectRoot, 'script', 'editor', 'skill_tester', 'skillBatchAnalyzerApp.mjs');
const cssPath = path.join(projectRoot, 'script', 'editor', 'skill_tester', 'skill_batch_analyzer.css');

function makeSummary() {
  return {
    scenario: { maxBuilds: 80, maxCandidates: 10 },
    aggregates: { levelCount: 3, killedCount: 2, enemyCount: 2 },
    conclusions: ['样本结论'],
    levels: [
      {
        levelIndex: 1,
        nodeLabel: '1-1',
        enemyId: 'enemy_a',
        kpBudget: 8,
        buildCount: 20,
        candidateCount: 10,
        best: {
          score: 100,
          killed: true,
          turnsToKill: 2,
          kpUsed: 8,
          apUsed: 5,
          skillIds: ['skill_a', 'skill_b'],
          loopSkillIds: ['skill_a'],
          mechanics: { appliesBleed: true, readsBuffRemaining: false, consumesBuffRemaining: false, heals: false, controls: false }
        }
      },
      {
        levelIndex: 2,
        nodeLabel: '1-2',
        enemyId: 'enemy_b',
        kpBudget: 11,
        buildCount: 80,
        candidateCount: 10,
        best: {
          score: 70,
          killed: true,
          turnsToKill: 8,
          kpUsed: 6,
          apUsed: 5,
          skillIds: ['skill_b'],
          loopSkillIds: ['skill_b'],
          mechanics: { appliesBleed: false, readsBuffRemaining: false, consumesBuffRemaining: false, heals: false, controls: false }
        }
      },
      {
        levelIndex: 3,
        nodeLabel: '1-3',
        enemyId: 'enemy_b',
        kpBudget: 14,
        buildCount: 80,
        candidateCount: 0,
        best: {
          score: 0,
          killed: false,
          turnsToKill: null,
          kpUsed: 0,
          apUsed: 0,
          skillIds: [],
          loopSkillIds: [],
          mechanics: {}
        }
      }
    ]
  };
}

function makeSkillPack() {
  return {
    skills: [
      {
        id: 'skill_a',
        name: '破甲斩',
        semanticProfile: {
          profileVersion: 1,
          roleTags: { primary: 'Skill.Attack.BasicArmor', secondary: [] },
          mechanicTags: ['Damage.Armor.Basic'],
          relationProfile: {},
          decisionProfile: { preferredWhen: '需要基础破甲。', avoidWhen: '需要状态兑现。', differentiation: '基础输出。' }
        }
      },
      {
        id: 'skill_b',
        name: '血刃连击',
        semanticProfile: {
          profileVersion: 1,
          roleTags: { primary: 'Skill.Bleed.Apply', secondary: ['Skill.Attack.MultiHit'] },
          mechanicTags: ['Bleed.Window.Create'],
          relationProfile: {},
          decisionProfile: { preferredWhen: '需要建立流血窗口。', avoidWhen: '目标已有足够窗口。', differentiation: '建窗。' }
        }
      }
    ]
  };
}

test('analyzeBatchSummary derives monotony, complexity, adaptation, and trend views', () => {
  const analysis = analyzeBatchSummary(makeSummary(), { skillPack: makeSkillPack() });

  assert.equal(analysis.overview.levelCount, 3);
  assert.equal(analysis.overview.killedCount, 2);
  assert.equal(analysis.evaluation.grade, '勉强可接受');
  assert.equal(analysis.evaluation.tier, 'acceptable');
  assert.ok(analysis.evaluation.reasons.some(reason => reason.includes('1-2 技能短循环')));
  assert.ok(analysis.evaluation.evidence.some(item => item.title === '核心技能覆盖'));
  assert.equal(analysis.monotony.loopSignatureCount, 3);
  assert.equal(analysis.monotony.dominantLoop.coverage, 33.3);
  assert.equal(analysis.monotony.dominantLoop.displaySignature, '破甲斩');
  assert.equal(analysis.monotony.coreSkills[0].skillId, 'skill_b');
  assert.equal(analysis.monotony.coreSkills[0].skillName, '血刃连击');
  assert.equal(analysis.monotony.coreSkills[0].loopCoverage, 33.3);
  assert.deepEqual(analysis.monotony.coreSkills[0].loopNodes, ['1-2']);
  assert.equal(analysis.complexity.singleSkillLoopCount, 2);
  assert.equal(analysis.complexity.averageMechanicDepth, 0.33);
  assert.equal(analysis.semantic.profiledSkillCount, 2);
  assert.equal(analysis.semantic.roleMetrics.lowRoleLoopCount, 2);
  assert.equal(analysis.layeredIndicators.noBrain.status, 'poor');
  assert.ok(analysis.layeredIndicators.noBrain.items.some(item => item.id === 'short_loop_count'));
  assert.equal(analysis.adaptation.enemyLoopSummaries[0].enemyId, 'enemy_b');
  assert.equal(analysis.adaptation.enemyLoopSummaries[0].uniqueLoopCount, 2);
  assert.equal(analysis.riskLevels[0].nodeLabel, '1-3');
  assert.deepEqual(analysis.trendPoints.map(point => point.kpWaste), [0, 5, 14]);
});

test('skill batch analyzer page exposes reusable loader and analysis regions', async () => {
  const html = await fs.readFile(pagePath, 'utf8');

  for (const id of [
    'batchRootInput',
    'loadBatchBtn',
    'analysisStatusLine',
    'evaluationPanel',
    'evaluationGrade',
    'evaluationSummary',
    'evaluationEvidence',
    'evaluationReasons',
    'semanticGrid',
    'layeredIndicatorTable',
    'overviewGrid',
    'monotonyGrid',
    'trendSvg',
    'riskTable',
    'dominantLoopTable',
    'coreSkillTable',
    'adaptationTable',
    'complexityTable',
    'levelDetailPanel'
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `页面缺少 #${id}`);
  }

  assert.match(html, /skillBatchAnalyzerApp\.mjs/u);
  assert.match(html, /skill_batch_analyzer\.css/u);
  await fs.access(appPath);
  await fs.access(cssPath);
});
