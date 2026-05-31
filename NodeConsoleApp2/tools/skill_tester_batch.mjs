import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  analyzeSkillTestScenario,
  buildSkillTestRecord,
  formatSkillTestTimestamp,
  listEnemyOptions,
  listStoryLevelOptions
} from '../script/editor/skill_tester/skillTesterModel.mjs';

const BATCH_RECORD_ROOT = 'DOC/CODEX_DOC/05_测试文档/05_Skill技能系统测试记录';

export const DEFAULT_BATCH_SOURCES = Object.freeze({
  skillPackPath: 'assets/skill_packs/authoring/skills_melee_v4_5_sword_bleed_window_standard_v2_20260529_013420.json',
  buffPackPath: 'assets/data/buffs_v2_7.json',
  levelsPath: 'assets/data/levels.json',
  enemyPath: 'assets/data/enemies.json',
  playerPath: 'assets/data/player.json'
});

export const DEFAULT_BATCH_SCENARIO = Object.freeze({
  testType: 'result_optimization',
  kpMode: 'assumed_per_level',
  assumedInitialKp: 5,
  assumedKpPerLevel: 3,
  manualKp: 0,
  apBudget: 5,
  maxTurns: 12,
  focus: 'sword',
  maxBuilds: 80,
  maxCombosPerBuild: 16,
  maxCandidates: 10
});

function assertTimestamp(timestamp) {
  if (!/^\d{4}-\d{2}-\d{2}-\d{6}$/u.test(String(timestamp || ''))) {
    throw new Error('批量记录时间戳必须是 YYYY-MM-DD-HHmmss。');
  }
}

export function createSkillTesterBatchRoot(timestamp) {
  assertTimestamp(timestamp);
  return `${BATCH_RECORD_ROOT}/${timestamp}-30关技能测试批量记录`;
}

function sanitizePathSegment(value) {
  return String(value || 'unknown')
    .replace(/[\\/:*?"<>|]+/gu, '_')
    .replace(/\s+/gu, '_')
    .slice(0, 80);
}

async function readJson(projectRoot, relativePath) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), 'utf8'));
}

function getBestSummary(result) {
  const best = result.best;
  if (!best) {
    return {
      score: 0,
      killed: false,
      turnsToKill: null,
      kpUsed: 0,
      apUsed: 0,
      skillIds: [],
      loopSkillIds: [],
      finalHp: null,
      finalArmor: null,
      mechanics: {}
    };
  }
  return {
    score: best.score,
    killed: best.simulation?.killed === true,
    turnsToKill: best.simulation?.turnsToKill ?? null,
    kpUsed: best.build?.kpUsed ?? 0,
    apUsed: best.combo?.apUsed ?? 0,
    skillIds: best.build?.skillIds || [],
    loopSkillIds: best.combo?.skillIds || [],
    finalHp: best.simulation?.final?.enemy?.hp ?? null,
    finalArmor: best.simulation?.final?.enemy?.armorTotal ?? null,
    mechanics: best.build?.mechanics || {}
  };
}

function summarizeLevelResult({ option, result, enemyId, scenario }) {
  const best = getBestSummary(result);
  return {
    levelIndex: option.levelIndex,
    levelId: option.id,
    levelName: option.name,
    nodeLabel: option.nodeLabel,
    levelRewardKp: option.kp,
    enemyId: result.context?.enemyId || enemyId,
    enemyName: result.context?.enemyName || result.context?.enemyId || enemyId,
    kpMode: scenario.kpMode,
    kpBudget: result.context?.kpBudget,
    actualThroughCurrent: result.context?.actualThroughCurrent,
    actualBeforeCurrent: result.context?.actualBeforeCurrent,
    initialSkillPoints: result.context?.initialSkillPoints,
    buildCount: Array.isArray(result.builds) ? result.builds.length : 0,
    candidateCount: Array.isArray(result.candidates) ? result.candidates.length : 0,
    findingCount: Array.isArray(result.findings) ? result.findings.length : 0,
    best
  };
}

function firstLevelWhere(levels, predicate) {
  return levels.find(predicate) || null;
}

function buildMechanicFirstLevels(levels) {
  const mechanicIds = ['appliesBleed', 'readsBuffRemaining', 'consumesBuffRemaining', 'heals', 'controls'];
  return Object.fromEntries(mechanicIds.map(id => {
    const row = firstLevelWhere(levels, level => level.best?.mechanics?.[id]);
    return [id, row ? { levelIndex: row.levelIndex, levelId: row.levelId, nodeLabel: row.nodeLabel } : null];
  }));
}

function buildConclusions(levels, scenario) {
  const conclusions = [];
  const targetLabel = scenario.enemyIdOverride ? '当前固定敌人' : '各关卡原始敌人';
  const killed = levels.filter(level => level.best?.killed);
  const noCandidate = levels.filter(level => level.candidateCount === 0);
  const notKilled = levels.filter(level => !level.best?.killed);
  const maxBuildsReached = levels.filter(level => Number(level.buildCount || 0) >= Number(scenario.maxBuilds || 0));
  const maxCandidatesReached = levels.filter(level => Number(level.candidateCount || 0) >= Number(scenario.maxCandidates || 0));
  const underusedAp = levels.filter(level => Number(level.best?.apUsed || 0) <= Math.max(0, Number(scenario.apBudget || 0) - 2));
  const firstKill = firstLevelWhere(levels, level => level.best?.killed);

  if (levels.length && killed.length === levels.length) {
    conclusions.push(`全部 ${levels.length} 个关卡的最佳候选都能击杀${targetLabel}。`);
  } else if (killed.length) {
    conclusions.push(`${killed.length}/${levels.length} 个关卡的最佳候选能击杀${targetLabel}。`);
  }

  if (firstKill) {
    conclusions.push(`第 ${firstKill.levelIndex} 关开始出现可击杀目标敌人的候选循环。`);
  } else {
    conclusions.push('30 个 KP 关卡内没有出现可击杀目标敌人的候选循环。');
  }

  if (noCandidate.length) {
    conclusions.push(`${noCandidate.length} 个关卡没有生成候选循环：${noCandidate.map(level => level.nodeLabel).join('、')}。`);
  }
  if (notKilled.length) {
    conclusions.push(`${notKilled.length} 个关卡的最佳候选未击杀目标：${notKilled.map(level => level.nodeLabel).join('、')}。`);
  }
  if (underusedAp.length) {
    conclusions.push(`${underusedAp.length} 个关卡的最佳循环 AP 使用偏低，可能存在 AP 消耗不足或循环单调问题。`);
  }
  if (maxBuildsReached.length) {
    conclusions.push(`${maxBuildsReached.length} 个关卡达到 maxBuilds=${scenario.maxBuilds} 的构筑枚举检查阈值，最早从 ${maxBuildsReached[0].nodeLabel} 开始；这些关卡需要谨慎区分“当前采样最佳”和“全量空间最佳”。`);
  }
  if (maxCandidatesReached.length) {
    conclusions.push(`${maxCandidatesReached.length} 个关卡达到 maxCandidates=${scenario.maxCandidates} 的候选输出上限，候选表只保留评分靠前的循环。`);
  }

  const killedTurns = levels
    .filter(level => level.best?.killed && Number.isFinite(Number(level.best?.turnsToKill)))
    .map(level => ({ level, turns: Number(level.best.turnsToKill) }));
  if (killedTurns.length) {
    const minTurns = Math.min(...killedTurns.map(item => item.turns));
    const maxTurns = Math.max(...killedTurns.map(item => item.turns));
    if (minTurns === maxTurns) {
      conclusions.push(`击杀回合稳定为 ${minTurns} 回合。`);
    } else {
      const firstSlowdown = killedTurns.find(item => item.turns > minTurns);
      conclusions.push(`击杀回合范围为 ${minTurns}-${maxTurns} 回合，首次慢于最快回合出现在 ${firstSlowdown?.level.nodeLabel || '未知关卡'}。`);
    }
  }

  if (levels.length >= 2) {
    const firstScore = Number(levels[0].best?.score || 0);
    const lastScore = Number(levels.at(-1).best?.score || 0);
    if (lastScore > firstScore) {
      conclusions.push(`最佳评分从第 1 关的 ${firstScore} 上升到第 ${levels.at(-1).levelIndex} 关的 ${lastScore}。`);
    } else if (lastScore < firstScore) {
      conclusions.push(`最佳评分从第 1 关的 ${firstScore} 下降到第 ${levels.at(-1).levelIndex} 关的 ${lastScore}，说明当前评分排序未必只反映 KP 增长带来的强度提升。`);
    }
  }

  const scoreJumps = [];
  for (let index = 1; index < levels.length; index += 1) {
    const prev = Number(levels[index - 1].best?.score || 0);
    const current = Number(levels[index].best?.score || 0);
    const delta = current - prev;
    if (delta >= 15) scoreJumps.push({ ...levels[index], delta });
  }
  if (scoreJumps.length) {
    conclusions.push(`检测到 ${scoreJumps.length} 个评分跃迁点：${scoreJumps.map(level => `${level.nodeLabel}(+${level.delta})`).join('、')}。`);
  }

  return conclusions;
}

function buildAggregates(levels, scenario) {
  const killed = levels.filter(level => level.best?.killed);
  const enemyIds = [...new Set(levels.map(level => level.enemyId).filter(Boolean))];
  return {
    levelCount: levels.length,
    enemyMode: scenario.enemyIdOverride ? 'fixed_override' : 'level_primary',
    enemyId: scenario.enemyIdOverride || null,
    enemyIds,
    enemyCount: enemyIds.length,
    kpMode: scenario.kpMode,
    apBudget: scenario.apBudget,
    killedCount: killed.length,
    notKilledCount: levels.length - killed.length,
    noCandidateCount: levels.filter(level => level.candidateCount === 0).length,
    averageBestScore: levels.length
      ? Number((levels.reduce((sum, level) => sum + Number(level.best?.score || 0), 0) / levels.length).toFixed(2))
      : 0,
    mechanicFirstLevels: buildMechanicFirstLevels(levels)
  };
}

export function buildBatchSkillTestReport({
  timestamp = formatSkillTestTimestamp(),
  sources = DEFAULT_BATCH_SOURCES,
  scenario = DEFAULT_BATCH_SCENARIO,
  skillPack,
  buffPack,
  levelsDocument,
  enemyDocuments,
  playerDocument,
  enemyId = null
} = {}) {
  const batchRoot = createSkillTesterBatchRoot(timestamp);
  const storyLevels = listStoryLevelOptions(levelsDocument);
  const enemies = listEnemyOptions(enemyDocuments);
  if (!enemies.length) throw new Error('敌人包中没有可用于批量测试的敌人。');

  const normalizedScenario = { ...DEFAULT_BATCH_SCENARIO, ...scenario };
  const fixedEnemyId = String(enemyId || normalizedScenario.enemyIdOverride || '').trim();
  if (fixedEnemyId) {
    normalizedScenario.enemyIdOverride = fixedEnemyId;
  } else {
    delete normalizedScenario.enemyIdOverride;
  }
  const records = [];
  const levels = [];

  for (const option of storyLevels) {
    const result = analyzeSkillTestScenario({
      ...normalizedScenario,
      skillPack,
      buffPack,
      levelsDocument,
      enemyDocuments,
      playerDocument,
      levelIndex: option.levelIndex
    });
    const scenarioForRecord = {
      ...normalizedScenario,
      levelIndex: option.levelIndex,
      levelId: option.id
    };
    const record = buildSkillTestRecord({
      timestamp,
      sources,
      scenario: scenarioForRecord,
      result
    });
    const levelDir = `${String(option.levelIndex).padStart(2, '0')}-${sanitizePathSegment(option.id)}`;
    const recordPath = `${batchRoot}/levels/${levelDir}/report.json`;
    records.push({ path: recordPath, record });
    levels.push(summarizeLevelResult({
      option,
      result,
      scenario: normalizedScenario
    }));
  }

  const summary = {
    meta: {
      artifactKind: 'skill_tester_batch_summary',
      timestamp,
      createdBy: 'skill_tester_batch'
    },
    sources,
    scenario: normalizedScenario,
    aggregates: buildAggregates(levels, normalizedScenario),
    conclusions: buildConclusions(levels, normalizedScenario),
    levels: levels.map((level, index) => ({
      ...level,
      recordPath: records[index].path
    }))
  };

  return {
    batchRoot,
    summaryPath: `${batchRoot}/batch_summary.json`,
    markdownPath: `${batchRoot}/batch_summary.md`,
    summary,
    records
  };
}

export function renderBatchSummaryMarkdown(summary) {
  const rows = summary.levels.map(level => [
    level.levelIndex,
    level.nodeLabel,
    level.enemyId,
    level.kpBudget,
    level.buildCount,
    level.candidateCount,
    level.best?.score ?? 0,
    level.best?.killed ? '是' : '否',
    level.best?.turnsToKill ?? '-',
    level.best?.finalHp ?? '-',
    level.best?.apUsed ?? '-'
  ]);

  return [
    '# 30 关技能测试批量记录',
    '',
    `- 时间戳：${summary.meta.timestamp}`,
    `- 敌人选择：${summary.aggregates.enemyMode === 'fixed_override' ? `固定敌人 ${summary.aggregates.enemyId}` : '每关使用关卡原始敌人'}`,
    `- 覆盖敌人：${summary.aggregates.enemyCount} 种`,
    `- KP 模式：${summary.aggregates.kpMode}`,
    `- AP 预算：${summary.aggregates.apBudget}`,
    `- 击杀关卡：${summary.aggregates.killedCount}/${summary.aggregates.levelCount}`,
    `- 平均最佳评分：${summary.aggregates.averageBestScore}`,
    `- 构筑枚举上限：${summary.scenario.maxBuilds}`,
    `- 候选输出上限：${summary.scenario.maxCandidates}`,
    '',
    '## 结论',
    '',
    ...summary.conclusions.map(item => `- ${item}`),
    '',
    '## 关卡总表',
    '',
    '| 关卡 | 节点 | 敌人 | KP | 构筑数 | 候选数 | 最佳评分 | 击杀 | 击杀回合 | 终局 HP | AP |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## 原始数据',
    '',
    '每关的原始 JSON 记录保存在 `levels/*/report.json`，包含候选构筑、循环组合、逐回合回放和发现项。'
  ].join('\n');
}

async function writeJson(projectRoot, relativePath, value) {
  const target = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(projectRoot, relativePath, value) {
  const target = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

export async function writeBatchSkillTestReport(projectRoot, batch) {
  await writeJson(projectRoot, batch.summaryPath, batch.summary);
  await writeText(projectRoot, batch.markdownPath, renderBatchSummaryMarkdown(batch.summary));
  for (const item of batch.records) {
    await writeJson(projectRoot, item.path, item.record);
  }
  return {
    batchRoot: batch.batchRoot,
    summaryPath: batch.summaryPath,
    markdownPath: batch.markdownPath,
    recordCount: batch.records.length
  };
}

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/u.exec(arg);
    if (match) options[match[1]] = match[2];
  }
  return options;
}

async function main() {
  const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const args = parseArgs(process.argv.slice(2));
  const timestamp = args.timestamp || formatSkillTestTimestamp();
  const sources = {
    ...DEFAULT_BATCH_SOURCES,
    ...(args.skillPack ? { skillPackPath: args.skillPack } : {}),
    ...(args.buffPack ? { buffPackPath: args.buffPack } : {}),
    ...(args.levels ? { levelsPath: args.levels } : {}),
    ...(args.enemies ? { enemyPath: args.enemies } : {}),
    ...(args.player ? { playerPath: args.player } : {})
  };
  const scenario = {
    ...DEFAULT_BATCH_SCENARIO,
    ...(args.testType ? { testType: args.testType } : {}),
    ...(args.kpMode ? { kpMode: args.kpMode } : {}),
    ...(args.focus ? { focus: args.focus } : {}),
    ...(args.apBudget ? { apBudget: Number(args.apBudget) } : {}),
    ...(args.maxTurns ? { maxTurns: Number(args.maxTurns) } : {}),
    ...(args.maxBuilds ? { maxBuilds: Number(args.maxBuilds) } : {})
  };

  const [skillPack, buffPack, levelsDocument, enemiesDocument, playerDocument] = await Promise.all([
    readJson(projectRoot, sources.skillPackPath),
    readJson(projectRoot, sources.buffPackPath),
    readJson(projectRoot, sources.levelsPath),
    readJson(projectRoot, sources.enemyPath),
    readJson(projectRoot, sources.playerPath)
  ]);

  const batch = buildBatchSkillTestReport({
    timestamp,
    sources,
    scenario,
    skillPack,
    buffPack,
    levelsDocument,
    enemyDocuments: [enemiesDocument],
    playerDocument,
    enemyId: args.enemyId || null
  });
  const output = await writeBatchSkillTestReport(projectRoot, batch);
  console.log(JSON.stringify(output, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
