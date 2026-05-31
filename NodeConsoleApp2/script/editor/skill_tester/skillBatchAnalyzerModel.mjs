import {
  buildSemanticProfileIndex,
  summarizeLoopRoleMetrics,
  validateSemanticProfiles
} from './skillSemanticProfileModel.mjs';

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function average(values) {
  const nums = values.map(value => toFiniteNumber(value, null)).filter(value => value !== null);
  if (!nums.length) return 0;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2));
}

function percent(value, total) {
  const base = toFiniteNumber(total, 0);
  if (base <= 0) return 0;
  return Number(((toFiniteNumber(value, 0) / base) * 100).toFixed(1));
}

function getLevelTurns(level) {
  const turns = toFiniteNumber(level?.best?.turnsToKill, null);
  return turns === null || turns <= 0 ? null : turns;
}

function buildTrendPoint(level) {
  const kpBudget = toFiniteNumber(level.kpBudget, 0);
  const kpUsed = toFiniteNumber(level.best?.kpUsed, 0);
  return {
    levelIndex: level.levelIndex,
    nodeLabel: level.nodeLabel,
    enemyId: level.enemyId,
    kpBudget,
    kpUsed,
    kpWaste: Math.max(0, kpBudget - kpUsed),
    score: toFiniteNumber(level.best?.score, 0),
    turnsToKill: getLevelTurns(level),
    killed: level.best?.killed === true
  };
}

function normalizeSkillPack(skillPack) {
  if (Array.isArray(skillPack)) return skillPack;
  if (Array.isArray(skillPack?.skills)) return skillPack.skills;
  return [];
}

function createSkillLookup(skillPack) {
  return new Map(normalizeSkillPack(skillPack)
    .filter(skill => skill?.id)
    .map(skill => [String(skill.id), String(skill.name || skill.id)]));
}

function getSkillName(skillLookup, skillId) {
  return skillLookup.get(skillId) || skillId;
}

function displaySkillIds(skillIds = [], skillLookup = new Map()) {
  return skillIds.map(skillId => getSkillName(skillLookup, skillId)).join(' > ') || '(empty)';
}

function skillNamesObject(skillLookup) {
  return Object.fromEntries(skillLookup.entries());
}

function buildRiskLevel(level, scenario) {
  const score = toFiniteNumber(level.best?.score, 0);
  const turnsToKill = getLevelTurns(level);
  const killed = level.best?.killed === true;
  const buildCapHit = toFiniteNumber(level.buildCount, 0) >= toFiniteNumber(scenario.maxBuilds, Infinity);
  const candidateCapHit = toFiniteNumber(level.candidateCount, 0) >= toFiniteNumber(scenario.maxCandidates, Infinity);
  const kpBudget = toFiniteNumber(level.kpBudget, 0);
  const kpUsed = toFiniteNumber(level.best?.kpUsed, 0);
  const kpWaste = Math.max(0, kpBudget - kpUsed);
  const riskScore = (killed ? 0 : 1000)
    + (turnsToKill || 30) * 12
    + Math.max(0, 100 - score)
    + (buildCapHit ? 8 : 0)
    + (candidateCapHit ? 4 : 0)
    + Math.min(30, kpWaste);

  return {
    levelIndex: level.levelIndex,
    levelId: level.levelId,
    nodeLabel: level.nodeLabel,
    enemyId: level.enemyId,
    enemyName: level.enemyName || level.enemyId,
    kpBudget,
    kpUsed,
    kpWaste,
    score,
    turnsToKill,
    killed,
    buildCount: toFiniteNumber(level.buildCount, 0),
    candidateCount: toFiniteNumber(level.candidateCount, 0),
    buildCapHit,
    candidateCapHit,
    riskScore
  };
}

function summarizeEnemies(levels) {
  const grouped = new Map();
  for (const level of levels) {
    const enemyId = level.enemyId || 'unknown';
    if (!grouped.has(enemyId)) {
      grouped.set(enemyId, {
        enemyId,
        enemyName: level.enemyName || enemyId,
        levelCount: 0,
        killedCount: 0,
        turns: [],
        scores: [],
        nodes: []
      });
    }
    const row = grouped.get(enemyId);
    row.levelCount += 1;
    if (level.best?.killed) row.killedCount += 1;
    const turns = getLevelTurns(level);
    if (turns !== null) row.turns.push(turns);
    row.scores.push(toFiniteNumber(level.best?.score, 0));
    row.nodes.push(level.nodeLabel);
  }

  return [...grouped.values()]
    .map(row => ({
      enemyId: row.enemyId,
      enemyName: row.enemyName,
      levelCount: row.levelCount,
      killedCount: row.killedCount,
      killRate: percent(row.killedCount, row.levelCount),
      averageTurns: average(row.turns),
      maxTurns: row.turns.length ? Math.max(...row.turns) : null,
      minScore: row.scores.length ? Math.min(...row.scores) : 0,
      nodes: row.nodes
    }))
    .sort((a, b) => (b.maxTurns || 0) - (a.maxTurns || 0) || a.minScore - b.minScore || b.levelCount - a.levelCount);
}

function summarizeSkillUsage(levels) {
  const usage = new Map();
  function touch(skillId) {
    if (!usage.has(skillId)) usage.set(skillId, { skillId, buildCount: 0, loopCount: 0 });
    return usage.get(skillId);
  }

  for (const level of levels) {
    for (const skillId of new Set(level.best?.skillIds || [])) {
      touch(skillId).buildCount += 1;
    }
    for (const skillId of new Set(level.best?.loopSkillIds || [])) {
      touch(skillId).loopCount += 1;
    }
  }

  return [...usage.values()]
    .sort((a, b) => b.loopCount - a.loopCount || b.buildCount - a.buildCount || a.skillId.localeCompare(b.skillId));
}

function loopSignature(level) {
  return (level.best?.loopSkillIds || []).join(' > ') || '(empty)';
}

function loopSkillIdsFromSignature(signature) {
  return signature === '(empty)' ? [] : signature.split(' > ').filter(Boolean);
}

function buildSignature(level) {
  return [...(level.best?.skillIds || [])].sort().join(' > ') || '(empty)';
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (a[0] === '(empty)' && b[0] !== '(empty)') return 1;
    if (b[0] === '(empty)' && a[0] !== '(empty)') return -1;
    return a[0].localeCompare(b[0]);
  });
}

function coverage(count, total) {
  return percent(count, total);
}

function jaccard(left = [], right = []) {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  return intersection / union.size;
}

function buildSignatureLevelMap(levels, signatureFn) {
  const grouped = new Map();
  for (const level of levels) {
    const signature = signatureFn(level);
    if (!grouped.has(signature)) grouped.set(signature, []);
    grouped.get(signature).push(level);
  }
  return grouped;
}

function buildDominantEntry(entries, total, levelMap = new Map(), skillLookup = new Map()) {
  const [signature = '(empty)', count = 0] = entries[0] || [];
  const rows = levelMap.get(signature) || [];
  return {
    signature,
    displaySignature: displaySkillIds(loopSkillIdsFromSignature(signature), skillLookup),
    count,
    coverage: coverage(count, total),
    nodes: rows.map(level => level.nodeLabel).filter(Boolean)
  };
}

function buildCoreSkills(levels, skillLookup) {
  const rows = new Map();
  function ensure(skillId) {
    if (!rows.has(skillId)) rows.set(skillId, {
      skillId,
      skillName: getSkillName(skillLookup, skillId),
      buildCount: 0,
      loopCount: 0,
      buildNodes: [],
      loopNodes: []
    });
    return rows.get(skillId);
  }
  for (const level of levels) {
    for (const skillId of new Set(level.best?.skillIds || [])) {
      const row = ensure(skillId);
      row.buildCount += 1;
      row.buildNodes.push(level.nodeLabel);
    }
    for (const skillId of new Set(level.best?.loopSkillIds || [])) {
      const row = ensure(skillId);
      row.loopCount += 1;
      row.loopNodes.push(level.nodeLabel);
    }
  }
  return [...rows.values()]
    .map(row => ({
      ...row,
      buildCoverage: coverage(row.buildCount, levels.length),
      loopCoverage: coverage(row.loopCount, levels.length)
    }))
    .sort((a, b) => b.loopCount - a.loopCount || b.buildCount - a.buildCount || a.skillId.localeCompare(b.skillId));
}

function mechanicDepth(level) {
  return Object.values(level.best?.mechanics || {}).filter(Boolean).length;
}

function buildMonotony(levels, skillLookup) {
  const loopEntries = countBy(levels.map(loopSignature));
  const buildEntries = countBy(levels.map(buildSignature));
  const loopLevelMap = buildSignatureLevelMap(levels, loopSignature);
  const buildLevelMap = buildSignatureLevelMap(levels, buildSignature);
  const pairSimilarities = [];
  for (let left = 0; left < levels.length; left += 1) {
    for (let right = left + 1; right < levels.length; right += 1) {
      pairSimilarities.push(jaccard(levels[left].best?.loopSkillIds || [], levels[right].best?.loopSkillIds || []));
    }
  }
  return {
    loopSignatureCount: loopEntries.length,
    buildSignatureCount: buildEntries.length,
    dominantLoop: buildDominantEntry(loopEntries, levels.length, loopLevelMap, skillLookup),
    dominantBuild: buildDominantEntry(buildEntries, levels.length, buildLevelMap, skillLookup),
    averageLoopSimilarity: Number(average(pairSimilarities).toFixed(2)),
    loopSignatures: loopEntries.map(([signature, count]) => ({
      signature,
      displaySignature: displaySkillIds(loopSkillIdsFromSignature(signature), skillLookup),
      count,
      coverage: coverage(count, levels.length),
      nodes: (loopLevelMap.get(signature) || []).map(level => level.nodeLabel).filter(Boolean)
    })),
    buildSignatures: buildEntries.map(([signature, count]) => ({
      signature,
      displaySignature: displaySkillIds(loopSkillIdsFromSignature(signature), skillLookup),
      count,
      coverage: coverage(count, levels.length),
      nodes: (buildLevelMap.get(signature) || []).map(level => level.nodeLabel).filter(Boolean)
    })),
    coreSkills: buildCoreSkills(levels, skillLookup)
  };
}

function buildComplexity(levels) {
  const loopLengths = levels.map(level => (level.best?.loopSkillIds || []).length);
  const depths = levels.map(mechanicDepth);
  return {
    singleSkillLoopCount: levels.filter(level => (level.best?.loopSkillIds || []).length === 1).length,
    shortLoopCount: levels.filter(level => (level.best?.loopSkillIds || []).length > 0 && (level.best?.loopSkillIds || []).length <= 2).length,
    averageLoopLength: average(loopLengths),
    minLoopLength: loopLengths.length ? Math.min(...loopLengths) : 0,
    maxLoopLength: loopLengths.length ? Math.max(...loopLengths) : 0,
    averageMechanicDepth: average(depths),
    compoundMechanicLevelCount: depths.filter(depth => depth >= 2).length,
    zeroMechanicLevelCount: depths.filter(depth => depth === 0).length
  };
}

function buildAdaptation(levels, skillLookup) {
  const grouped = new Map();
  for (const level of levels) {
    const enemyId = level.enemyId || 'unknown';
    if (!grouped.has(enemyId)) grouped.set(enemyId, []);
    grouped.get(enemyId).push(level);
  }
  const enemyLoopSummaries = [...grouped.entries()].map(([enemyId, rows]) => {
    const loopEntries = countBy(rows.map(loopSignature));
    const dominant = buildDominantEntry(loopEntries, rows.length, buildSignatureLevelMap(rows, loopSignature), skillLookup);
    return {
      enemyId,
      enemyName: rows[0]?.enemyName || enemyId,
      levelCount: rows.length,
      uniqueLoopCount: loopEntries.length,
      dominantLoop: dominant.signature,
      dominantLoopDisplay: dominant.displaySignature,
      dominantLoopCoverage: dominant.coverage,
      averageMechanicDepth: average(rows.map(mechanicDepth)),
      nodes: rows.map(row => row.nodeLabel)
    };
  }).sort((a, b) => b.levelCount - a.levelCount || a.uniqueLoopCount - b.uniqueLoopCount || a.enemyId.localeCompare(b.enemyId));
  const sameLoopRepeatedEnemies = enemyLoopSummaries
    .filter(row => row.levelCount > 1 && row.uniqueLoopCount === 1);
  return {
    enemyLoopSummaries,
    repeatedEnemyCount: enemyLoopSummaries.filter(row => row.levelCount > 1).length,
    sameLoopRepeatedEnemyCount: sameLoopRepeatedEnemies.length,
    sameLoopRepeatedEnemies
  };
}

function buildSemanticAnalysis(levels, skillPack) {
  const semanticIndex = buildSemanticProfileIndex(skillPack || {});
  return {
    skillCount: semanticIndex.skillCount,
    profiledSkillCount: semanticIndex.profiledSkillCount,
    unprofiledSkillCount: semanticIndex.unprofiledSkillCount,
    warnings: validateSemanticProfiles(skillPack || {}),
    roleMetrics: summarizeLoopRoleMetrics(levels, semanticIndex)
  };
}

function indicator(id, label, value, status, detail) {
  return { id, label, value, status, detail };
}

function buildNoBrainIndicators({ monotony, complexity, semantic, overview }) {
  const items = [
    indicator(
      'universal_core_coverage',
      '核心技能组覆盖',
      `${monotony.dominantLoop.coverage}%`,
      monotony.dominantLoop.coverage >= 70 ? 'poor' : monotony.dominantLoop.coverage >= 40 ? 'watch' : 'good',
      `${monotony.dominantLoop.displaySignature} 覆盖 ${monotony.dominantLoop.count}/${overview.levelCount} 关。`
    ),
    indicator(
      'short_loop_count',
      '短循环关卡',
      `${complexity.shortLoopCount}/${overview.levelCount}`,
      complexity.shortLoopCount > 0 ? 'poor' : 'good',
      `单技能循环 ${complexity.singleSkillLoopCount} 关，1-2 技能短循环 ${complexity.shortLoopCount} 关。`
    ),
    indicator(
      'low_role_loop_count',
      '低角色循环',
      `${semantic.roleMetrics.lowRoleLoopCount}/${semantic.roleMetrics.loopCount}`,
      semantic.roleMetrics.lowRoleLoopCount > 0 ? 'watch' : 'good',
      `平均主角色数 ${semantic.roleMetrics.averagePrimaryRoleCount}。`
    ),
    indicator(
      'unprofiled_loop_count',
      '未标注循环',
      `${semantic.roleMetrics.unprofiledLoopCount}/${semantic.roleMetrics.loopCount}`,
      semantic.roleMetrics.unprofiledLoopCount > 0 ? 'watch' : 'good',
      '未标注技能会降低角色链条结论可信度。'
    )
  ];
  const status = items.some(item => item.status === 'poor')
    ? 'poor'
    : items.some(item => item.status === 'watch') ? 'watch' : 'good';
  return { status, items };
}

function buildTagGuidedIndicators({ semantic }) {
  const items = [
    indicator(
      'semantic_profile_coverage',
      '语义画像覆盖',
      `${semantic.profiledSkillCount}/${semantic.skillCount}`,
      semantic.unprofiledSkillCount > 0 ? 'watch' : 'good',
      `未标注技能 ${semantic.unprofiledSkillCount} 个。`
    ),
    indicator(
      'semantic_profile_warnings',
      '语义画像警告',
      `${semantic.warnings.length}`,
      semantic.warnings.some(item => item.severity === 'error') ? 'poor' : semantic.warnings.length ? 'watch' : 'good',
      semantic.warnings.length
        ? semantic.warnings.slice(0, 5).map(item => `${item.skillId}:${item.code}`).join('、')
        : '没有发现结构或明显机制矛盾。'
    )
  ];
  const status = items.some(item => item.status === 'poor')
    ? 'poor'
    : items.some(item => item.status === 'watch') ? 'watch' : 'good';
  return { status, items };
}

function buildLayeredIndicators({ monotony, complexity, semantic, overview }) {
  return {
    noBrain: buildNoBrainIndicators({ monotony, complexity, semantic, overview }),
    tagGuided: buildTagGuidedIndicators({ semantic }),
    codexDecision: {
      status: 'pending',
      items: [
        indicator('codex_conclusion_required', 'Codex 逐关结论', '待补充', 'watch', '前两层收敛后再进入逐关人工或 Codex 决策。')
      ]
    }
  };
}

function summarizeNodes(nodes = [], limit = 8) {
  const list = nodes.filter(Boolean);
  if (list.length <= limit) return list.join('、') || '-';
  return `${list.slice(0, limit).join('、')} 等 ${list.length} 关`;
}

function buildEvaluationEvidence({ monotony, complexity, adaptation, overview }) {
  const topSkill = monotony.coreSkills[0] || null;
  const dominantLoop = monotony.dominantLoop;
  return [
    {
      title: '主导循环覆盖',
      value: `${dominantLoop.count}/${overview.levelCount}`,
      detail: dominantLoop.count
        ? `${dominantLoop.displaySignature} 覆盖 ${dominantLoop.coverage}%，出现于 ${summarizeNodes(dominantLoop.nodes)}。`
        : '没有可用循环记录。'
    },
    {
      title: '核心技能覆盖',
      value: topSkill ? `${topSkill.loopCount}/${overview.levelCount}` : '-',
      detail: topSkill
        ? `${topSkill.skillName} 出现在 ${topSkill.loopCoverage}% 的最佳循环里，涉及 ${summarizeNodes(topSkill.loopNodes)}。`
        : '没有可用技能记录。'
    },
    {
      title: '敌人适配变化',
      value: `${adaptation.sameLoopRepeatedEnemyCount}/${adaptation.repeatedEnemyCount}`,
      detail: adaptation.sameLoopRepeatedEnemyCount
        ? `${adaptation.sameLoopRepeatedEnemies.map(enemy => enemy.enemyName).slice(0, 5).join('、')} 等重复敌人没有换出不同循环。`
        : '重复敌人都有不同循环变化。'
    },
    {
      title: '短循环与复合度',
      value: `${complexity.shortLoopCount}/${overview.levelCount}`,
      detail: `单技能循环 ${complexity.singleSkillLoopCount} 关，1-2 技能短循环 ${complexity.shortLoopCount} 关，平均机制深度 ${complexity.averageMechanicDepth}。`
    }
  ];
}

function buildInterestFindings({ monotony, complexity, adaptation, overview }) {
  const findings = [];
  const topSkill = monotony.coreSkills[0];
  if (monotony.dominantLoop.coverage >= 70) {
    findings.push(`主导循环覆盖 ${monotony.dominantLoop.coverage}%，已经接近同一循环通解，属于最差风险。`);
  } else if (monotony.dominantLoop.coverage >= 40) {
    findings.push(`主导循环覆盖 ${monotony.dominantLoop.coverage}%，存在明显通解倾向，需要检查这套循环为什么能跨敌人生效。`);
  } else {
    findings.push(`主导循环覆盖 ${monotony.dominantLoop.coverage}%，暂未出现同一完整循环打穿多数关卡。`);
  }

  if (topSkill?.loopCoverage >= 90) {
    findings.push(`核心技能 ${topSkill.skillName} 出现在 ${topSkill.loopCoverage}% 的最佳循环里，技能层单调性风险很高。`);
  } else if (topSkill) {
    findings.push(`最高频循环技能 ${topSkill.skillName} 覆盖 ${topSkill.loopCoverage}%，需要结合敌人类型检查是否合理。`);
  }

  if (monotony.averageLoopSimilarity >= 0.65) {
    findings.push(`平均循环相似度 ${monotony.averageLoopSimilarity}，不同关卡之间的最佳循环过于接近。`);
  } else if (monotony.averageLoopSimilarity >= 0.5) {
    findings.push(`平均循环相似度 ${monotony.averageLoopSimilarity}，循环有变化，但共享核心偏强。`);
  } else {
    findings.push(`平均循环相似度 ${monotony.averageLoopSimilarity}，循环差异度相对健康。`);
  }

  if (complexity.singleSkillLoopCount > 0 || complexity.shortLoopCount > 0) {
    findings.push(`${complexity.shortLoopCount} 个关卡可由 1-2 技能短循环解决，其中单技能循环 ${complexity.singleSkillLoopCount} 个。`);
  } else {
    findings.push('当前最佳循环没有出现单技能或 1-2 技能短循环通关。');
  }

  if (adaptation.sameLoopRepeatedEnemyCount > 0) {
    findings.push(`${adaptation.sameLoopRepeatedEnemyCount} 个重复出现的敌人始终使用同一最佳循环，敌人适配度需要继续拆看。`);
  }

  if (overview.buildCapHitCount > 0 || overview.candidateCapHitCount > 0) {
    findings.push(`有 ${overview.buildCapHitCount} 个关卡触达构筑枚举上限、${overview.candidateCapHitCount} 个关卡触达候选上限；单调性结论仍受采样上限影响。`);
  }
  return findings;
}

function buildInterestEvaluation({ monotony, complexity, adaptation, overview }) {
  const topSkill = monotony.coreSkills[0] || null;
  const topSkillCoverage = topSkill?.loopCoverage || 0;
  const repeatedEnemyRatio = adaptation.repeatedEnemyCount
    ? adaptation.sameLoopRepeatedEnemyCount / adaptation.repeatedEnemyCount
    : 0;
  const reasons = [];

  if (monotony.dominantLoop.coverage >= 70) {
    reasons.push(`同一完整循环覆盖 ${monotony.dominantLoop.coverage}%，已经接近通解。`);
  }
  if (monotony.dominantBuild.coverage >= 75) {
    reasons.push(`同一构筑覆盖 ${monotony.dominantBuild.coverage}%，构筑层面存在通解风险。`);
  }
  if (topSkillCoverage >= 90) {
    reasons.push(`核心技能 ${topSkill.skillName} 覆盖 ${topSkillCoverage}%，说明技能层高度集中。`);
  }
  if (monotony.averageLoopSimilarity >= 0.65) {
    reasons.push(`平均循环相似度 ${monotony.averageLoopSimilarity}，不同关卡的循环结构过于接近。`);
  }
  if (complexity.shortLoopCount > 0) {
    reasons.push(`${complexity.shortLoopCount} 个关卡存在 1-2 技能短循环，需要确认是否只是低压关卡。`);
  }
  if (adaptation.sameLoopRepeatedEnemyCount > 0) {
    reasons.push(`${adaptation.sameLoopRepeatedEnemyCount} 个重复敌人没有产生循环变化。`);
  }
  if (!reasons.length) {
    reasons.push('未发现明显的完整循环通解、核心技能通解或短循环通解。');
  }

  const isWorst = monotony.dominantLoop.coverage >= 70
    || monotony.dominantBuild.coverage >= 75
    || (topSkillCoverage >= 95 && monotony.averageLoopSimilarity >= 0.7);
  if (isWorst) {
    return {
      tier: 'worst',
      grade: '最差',
      summary: '几乎同一套循环或构筑可以打穿大量关卡，输出循环已经退化成通解。',
      reasons,
      evidence: buildEvaluationEvidence({ monotony, complexity, adaptation, overview })
    };
  }

  const isWeak = topSkillCoverage >= 90
    || monotony.averageLoopSimilarity >= 0.65
    || monotony.dominantLoop.coverage >= 40
    || monotony.dominantBuild.coverage >= 50
    || repeatedEnemyRatio >= 0.5;
  if (isWeak) {
    return {
      tier: 'weak',
      grade: '较差',
      summary: '完整循环还没有统一，但核心技能或循环结构共享过强，存在退化成单调通解的趋势。',
      reasons,
      evidence: buildEvaluationEvidence({ monotony, complexity, adaptation, overview })
    };
  }

  const isIdeal = complexity.singleSkillLoopCount === 0
    && complexity.shortLoopCount === 0
    && complexity.averageMechanicDepth >= 2
    && monotony.dominantLoop.coverage < 35
    && topSkillCoverage < 70
    && monotony.averageLoopSimilarity < 0.5;
  if (isIdeal) {
    return {
      tier: 'ideal',
      grade: '理想',
      summary: '单调技能和短循环无法覆盖关卡，最佳循环在敌人与关卡之间保持了差异。',
      reasons,
      evidence: buildEvaluationEvidence({ monotony, complexity, adaptation, overview })
    };
  }

  return {
    tier: 'acceptable',
    grade: '勉强可接受',
    summary: '不同关卡可以用相对简单的循环解决，但尚未表现为同一套技能无差别打穿。',
    reasons,
    evidence: buildEvaluationEvidence({ monotony, complexity, adaptation, overview })
  };
}

export function analyzeBatchSummary(summary = {}, { skillPack = null } = {}) {
  const levels = Array.isArray(summary.levels) ? summary.levels : [];
  const scenario = summary.scenario || {};
  const skillLookup = createSkillLookup(skillPack);
  const riskLevels = levels.map(level => buildRiskLevel(level, scenario))
    .sort((a, b) => b.riskScore - a.riskScore || (b.turnsToKill || 0) - (a.turnsToKill || 0) || a.score - b.score);
  const trendPoints = levels.map(buildTrendPoint);
  const killedCount = levels.filter(level => level.best?.killed).length;
  const buildCapHitCount = levels.filter(level => toFiniteNumber(level.buildCount, 0) >= toFiniteNumber(scenario.maxBuilds, Infinity)).length;
  const candidateCapHitCount = levels.filter(level => toFiniteNumber(level.candidateCount, 0) >= toFiniteNumber(scenario.maxCandidates, Infinity)).length;

  const overview = {
      levelCount: levels.length,
      killedCount,
      killRate: percent(killedCount, levels.length),
      enemyCount: summary.aggregates?.enemyCount ?? new Set(levels.map(level => level.enemyId).filter(Boolean)).size,
      averageScore: average(levels.map(level => level.best?.score)),
      averageTurns: average(levels.map(getLevelTurns)),
      maxTurns: Math.max(0, ...levels.map(level => getLevelTurns(level) || 0)),
      buildCapHitCount,
      candidateCapHitCount
    };
  const monotony = buildMonotony(levels, skillLookup);
  const complexity = buildComplexity(levels);
  const adaptation = buildAdaptation(levels, skillLookup);
  const semantic = buildSemanticAnalysis(levels, skillPack);
  const evaluation = buildInterestEvaluation({ monotony, complexity, adaptation, overview });
  const layeredIndicators = buildLayeredIndicators({ monotony, complexity, semantic, overview });

  return {
    overview,
    skillNames: skillNamesObject(skillLookup),
    conclusions: Array.isArray(summary.conclusions) ? summary.conclusions : [],
    evaluation,
    semantic,
    layeredIndicators,
    interestFindings: buildInterestFindings({ monotony, complexity, adaptation, overview }),
    monotony,
    complexity,
    adaptation,
    riskLevels,
    enemySummaries: summarizeEnemies(levels),
    skillUsage: summarizeSkillUsage(levels),
    trendPoints
  };
}
