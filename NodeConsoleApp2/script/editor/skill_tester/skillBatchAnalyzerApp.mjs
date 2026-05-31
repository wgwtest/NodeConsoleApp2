import { analyzeBatchSummary } from './skillBatchAnalyzerModel.mjs';

const DEFAULT_BATCH_ROOT = 'DOC/CODEX_DOC/05_测试文档/05_Skill技能系统测试记录/2026-05-31-112110-30关技能测试批量记录';

function $(id) {
  return document.getElementById(id);
}

function text(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function toFetchPath(relativePath) {
  const raw = String(relativePath || '').trim().replace(/\\/gu, '/').replace(/^\/+/u, '');
  if (/^(?:https?:)?\/\//u.test(raw) || raw.startsWith('../')) return raw;
  return `../${raw}`;
}

function setStatus(message) {
  const status = $('analysisStatusLine');
  if (status) status.textContent = message;
}

async function fetchJson(relativePath) {
  const response = await fetch(toFetchPath(relativePath), { cache: 'no-store' });
  if (!response.ok) throw new Error(`读取失败：${response.status} ${response.statusText}`);
  return response.json();
}

function setRows(tableId, rows) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  tbody.replaceChildren(...rows);
}

function cell(value, className = '') {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text(value);
  return td;
}

function nameCell(primary, secondary = '') {
  const td = document.createElement('td');
  const name = document.createElement('b');
  name.textContent = text(primary);
  td.append(name);
  if (secondary && secondary !== primary) {
    const id = document.createElement('span');
    id.className = 'cell-subtext';
    id.textContent = secondary;
    td.append(id);
  }
  return td;
}

function formatSkillList(skillIds = [], analysis) {
  return skillIds.map(skillId => analysis.skillNames?.[skillId] || skillId).join(' / ') || '-';
}

function pill(label, kind) {
  const span = document.createElement('span');
  span.className = `pill ${kind}`;
  span.textContent = label;
  return span;
}

function statusLabel(status) {
  if (status === 'poor') return '问题';
  if (status === 'watch') return '观察';
  if (status === 'good') return '正常';
  return '待定';
}

function statusKind(status) {
  if (status === 'poor') return 'bad';
  if (status === 'watch') return 'warn';
  if (status === 'good') return 'ok';
  return 'neutral';
}

function renderOverview(analysis) {
  const grid = $('overviewGrid');
  if (!grid) return;
  const topSkill = analysis.monotony.coreSkills[0];
  const metrics = [
    ['关卡', analysis.overview.levelCount],
    ['覆盖敌人', analysis.overview.enemyCount],
    ['循环签名', analysis.monotony.loopSignatureCount],
    ['主导循环', `${analysis.monotony.dominantLoop.coverage}%`],
    ['主导构筑', `${analysis.monotony.dominantBuild.coverage}%`],
    ['最高核心技能', topSkill ? `${topSkill.loopCoverage}%` : '-']
  ];
  grid.replaceChildren(...metrics.map(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'metric';
    item.innerHTML = `<span>${label}</span><b>${value}</b>`;
    return item;
  }));
}

function renderMonotonyGrid(analysis) {
  const grid = $('monotonyGrid');
  if (!grid) return;
  const metrics = [
    ['平均循环相似度', analysis.monotony.averageLoopSimilarity],
    ['平均循环长度', analysis.complexity.averageLoopLength],
    ['单技能循环关卡', analysis.complexity.singleSkillLoopCount],
    ['短循环关卡', analysis.complexity.shortLoopCount],
    ['平均机制深度', analysis.complexity.averageMechanicDepth],
    ['重复敌人同循环', analysis.adaptation.sameLoopRepeatedEnemyCount]
  ];
  grid.replaceChildren(...metrics.map(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'metric';
    item.innerHTML = `<span>${label}</span><b>${value}</b>`;
    return item;
  }));
}

function renderEvaluation(analysis) {
  const panel = $('evaluationPanel');
  const grade = $('evaluationGrade');
  const summary = $('evaluationSummary');
  const evidence = $('evaluationEvidence');
  const reasons = $('evaluationReasons');
  if (!panel || !grade || !summary || !evidence || !reasons) return;

  panel.dataset.tier = analysis.evaluation.tier;
  grade.textContent = analysis.evaluation.grade;
  summary.textContent = analysis.evaluation.summary;
  evidence.replaceChildren(...analysis.evaluation.evidence.map(item => {
    const card = document.createElement('div');
    card.className = 'evidence-card';
    const title = document.createElement('span');
    title.textContent = item.title;
    const value = document.createElement('b');
    value.textContent = item.value;
    const detail = document.createElement('p');
    detail.textContent = item.detail;
    card.append(title, value, detail);
    return card;
  }));
  reasons.replaceChildren(...analysis.evaluation.reasons.map(reason => {
    const li = document.createElement('li');
    li.textContent = reason;
    return li;
  }));
}

function renderSemanticGrid(analysis) {
  const grid = $('semanticGrid');
  if (!grid) return;
  const semantic = analysis.semantic || {};
  const roleMetrics = semantic.roleMetrics || {};
  const metrics = [
    ['已标注技能', `${semantic.profiledSkillCount || 0}/${semantic.skillCount || 0}`],
    ['未标注技能', semantic.unprofiledSkillCount || 0],
    ['语义警告', semantic.warnings?.length || 0],
    ['平均主角色数', roleMetrics.averagePrimaryRoleCount || 0],
    ['低角色循环', `${roleMetrics.lowRoleLoopCount || 0}/${roleMetrics.loopCount || 0}`],
    ['未标注循环', `${roleMetrics.unprofiledLoopCount || 0}/${roleMetrics.loopCount || 0}`]
  ];
  grid.replaceChildren(...metrics.map(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'metric';
    item.innerHTML = `<span>${label}</span><b>${value}</b>`;
    return item;
  }));
}

function renderLayeredIndicators(analysis) {
  const layerNames = {
    noBrain: '无脑排查',
    tagGuided: '标签探索',
    codexDecision: 'Codex 决策'
  };
  const rows = [];
  for (const [layerId, layer] of Object.entries(analysis.layeredIndicators || {})) {
    for (const item of layer.items || []) {
      const tr = document.createElement('tr');
      const status = document.createElement('td');
      status.append(pill(statusLabel(item.status), statusKind(item.status)));
      tr.append(
        cell(layerNames[layerId] || layerId),
        cell(item.label),
        status,
        cell(item.value),
        cell(item.detail)
      );
      rows.push(tr);
    }
  }
  setRows('layeredIndicatorTable', rows);
}

function renderConclusions(analysis) {
  const list = $('conclusionList');
  if (!list) return;
  list.replaceChildren(...analysis.interestFindings.map(item => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  }));
}

function scale(value, min, max, height, pad) {
  if (max <= min) return height / 2;
  return height - pad - ((Number(value) - min) / (max - min)) * (height - pad * 2);
}

function renderTrend(analysis) {
  const svg = $('trendSvg');
  if (!svg) return;
  const points = analysis.trendPoints;
  const width = 880;
  const height = 280;
  const pad = 34;
  if (!points.length) {
    svg.replaceChildren();
    return;
  }
  const xFor = index => pad + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - pad * 2));
  const scoreMax = Math.max(100, ...points.map(point => point.score));
  const turnMax = Math.max(12, ...points.map(point => point.turnsToKill || 0));
  const kpMax = Math.max(1, ...points.map(point => point.kpBudget));
  const scoreLine = points.map((point, index) => `${xFor(index)},${scale(point.score, 0, scoreMax, height, pad)}`).join(' ');
  const turnLine = points.map((point, index) => `${xFor(index)},${scale(point.turnsToKill || turnMax, 0, turnMax, height, pad)}`).join(' ');
  const kpLine = points.map((point, index) => `${xFor(index)},${scale(point.kpUsed, 0, kpMax, height, pad)}`).join(' ');
  const budgetLine = points.map((point, index) => `${xFor(index)},${scale(point.kpBudget, 0, kpMax, height, pad)}`).join(' ');

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fffdf8"></rect>
    <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#d7d0c4"></line>
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#d7d0c4"></line>
    <polyline points="${budgetLine}" fill="none" stroke="#a9a096" stroke-width="2" stroke-dasharray="6 5"></polyline>
    <polyline points="${kpLine}" fill="none" stroke="#315f9d" stroke-width="3"></polyline>
    <polyline points="${scoreLine}" fill="none" stroke="#126c66" stroke-width="3"></polyline>
    <polyline points="${turnLine}" fill="none" stroke="#b23b2a" stroke-width="3"></polyline>
    <text x="${pad}" y="22" fill="#126c66" font-size="12">评分</text>
    <text x="${pad + 54}" y="22" fill="#b23b2a" font-size="12">击杀回合</text>
    <text x="${pad + 132}" y="22" fill="#315f9d" font-size="12">KP 使用</text>
    <text x="${pad + 204}" y="22" fill="#69716d" font-size="12">KP 预算</text>
    ${points
      .map((point, index) => ({ point, index }))
      .filter(item => item.index % 3 === 0 || item.index === points.length - 1)
      .map(item => `<text x="${xFor(item.index) - 8}" y="${height - 10}" fill="#69716d" font-size="10">${item.point.nodeLabel}</text>`)
      .join('')}
  `;
}

function renderRiskTable(analysis, summary) {
  const rows = analysis.riskLevels.map(level => {
    const tr = document.createElement('tr');
    const rawLevel = summary.levels.find(item => item.levelIndex === level.levelIndex);
    tr.append(
      cell(level.nodeLabel),
      nameCell(level.enemyName, level.enemyId),
      (() => {
        const td = document.createElement('td');
        td.append(level.killed ? pill('是', 'ok') : pill('否', 'bad'));
        return td;
      })(),
      cell(level.turnsToKill),
      cell(level.score),
      cell(`${level.kpUsed}/${level.kpBudget}`),
      cell([level.buildCapHit ? '构筑' : '', level.candidateCapHit ? '候选' : ''].filter(Boolean).join(' / ') || '-')
    );
    tr.addEventListener('click', () => selectLevel(rawLevel, analysis));
    return tr;
  });
  setRows('riskTable', rows);
}

function renderDominantLoopTable(analysis) {
  setRows('dominantLoopTable', analysis.monotony.loopSignatures.slice(0, 12).map(loop => {
    const tr = document.createElement('tr');
    tr.append(
      nameCell(loop.displaySignature, loop.signature),
      cell(loop.count),
      cell(`${loop.coverage}%`),
      cell(loop.nodes.join('、') || '-')
    );
    return tr;
  }));
}

function renderCoreSkillTable(analysis) {
  setRows('coreSkillTable', analysis.monotony.coreSkills.slice(0, 16).map(skill => {
    const tr = document.createElement('tr');
    tr.append(
      nameCell(skill.skillName, skill.skillId),
      cell(`${skill.loopCount} / ${analysis.overview.levelCount}`),
      cell(`${skill.loopCoverage}%`),
      cell(`${skill.buildCount} / ${analysis.overview.levelCount}`),
      cell(skill.loopNodes.join('、') || '-')
    );
    return tr;
  }));
}

function renderAdaptationTable(analysis) {
  setRows('adaptationTable', analysis.adaptation.enemyLoopSummaries.map(enemy => {
    const tr = document.createElement('tr');
    tr.append(
      nameCell(enemy.enemyName, enemy.enemyId),
      cell(enemy.levelCount),
      cell(enemy.uniqueLoopCount),
      cell(`${enemy.dominantLoopCoverage}%`),
      cell(enemy.averageMechanicDepth),
      cell(enemy.dominantLoopDisplay),
      cell(enemy.nodes.join('、') || '-')
    );
    return tr;
  }));
}

function renderComplexityTable(analysis) {
  const rows = [
    ['单技能循环关卡', analysis.complexity.singleSkillLoopCount, '最直接的无脑单调风险'],
    ['短循环关卡', analysis.complexity.shortLoopCount, '1-2 个技能解决的关卡数量'],
    ['循环长度范围', `${analysis.complexity.minLoopLength}-${analysis.complexity.maxLoopLength}`, '只看技能数量，不代表机制复合'],
    ['平均机制深度', analysis.complexity.averageMechanicDepth, '流血、读取、消耗、治疗、控制等机制数量均值'],
    ['复合机制关卡', analysis.complexity.compoundMechanicLevelCount, '机制深度 >= 2 的关卡'],
    ['零机制关卡', analysis.complexity.zeroMechanicLevelCount, '最佳循环没有明显机制复合的关卡']
  ];
  setRows('complexityTable', rows.map(row => {
    const tr = document.createElement('tr');
    tr.append(cell(row[0]), cell(row[1]), cell(row[2]));
    return tr;
  }));
}

function renderLevelSummary(level, record = null, analysis = null) {
  const badge = $('selectedLevelBadge');
  if (badge) badge.textContent = level ? `${level.nodeLabel} / ${level.enemyId}` : '未选择';
  const body = $('levelDetailBody');
  if (!body || !level) return;
  const best = level.best || {};
  const replay = record?.result?.best?.simulation?.turns || record?.result?.candidates?.[0]?.simulation?.turns || [];
  body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><span>敌人</span><b>${text(level.enemyName || level.enemyId)}</b></div>
      <div class="detail-item"><span>击杀回合</span><b>${text(best.turnsToKill)}</b></div>
      <div class="detail-item"><span>评分</span><b>${text(best.score)}</b></div>
      <div class="detail-item"><span>KP 使用</span><b>${text(best.kpUsed)}/${text(level.kpBudget)}</b></div>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><span>构筑技能</span><b>${analysis ? formatSkillList(best.skillIds || [], analysis) : (best.skillIds || []).join(' / ') || '-'}</b></div>
      <div class="detail-item"><span>循环技能</span><b>${analysis ? formatSkillList(best.loopSkillIds || [], analysis) : (best.loopSkillIds || []).join(' / ') || '-'}</b></div>
      <div class="detail-item"><span>终局 HP</span><b>${text(best.finalHp)}</b></div>
      <div class="detail-item"><span>原始记录</span><b>${text(level.recordPath)}</b></div>
    </div>
    <pre>${JSON.stringify(replay.slice(0, 8), null, 2)}</pre>
  `;
}

async function selectLevel(level, analysis = null) {
  if (!level) return;
  renderLevelSummary(level, null, analysis);
  if (!level.recordPath) return;
  try {
    const record = await fetchJson(level.recordPath);
    renderLevelSummary(level, record, analysis);
  } catch (error) {
    setStatus(`单关记录读取失败：${error.message}`);
  }
}

function renderAnalysis(summary, batchRoot, skillPack = null) {
  const analysis = analyzeBatchSummary(summary, { skillPack });
  renderOverview(analysis);
  renderMonotonyGrid(analysis);
  renderEvaluation(analysis);
  renderSemanticGrid(analysis);
  renderLayeredIndicators(analysis);
  renderConclusions(analysis);
  renderTrend(analysis);
  renderDominantLoopTable(analysis);
  renderCoreSkillTable(analysis);
  renderAdaptationTable(analysis);
  renderComplexityTable(analysis);
  renderRiskTable(analysis, summary);
  if (summary.levels?.length) renderLevelSummary(summary.levels[0], null, analysis);
  setStatus(`已加载 ${analysis.overview.levelCount} 个关卡；主导循环覆盖 ${analysis.monotony.dominantLoop.coverage}%，平均循环相似度 ${analysis.monotony.averageLoopSimilarity}。`);
}

async function loadBatch() {
  const input = $('batchRootInput');
  const batchRoot = (input?.value || DEFAULT_BATCH_ROOT).trim().replace(/\\/gu, '/').replace(/\/$/u, '');
  if (input) input.value = batchRoot;
  setStatus('正在读取批量记录...');
  try {
    const summary = await fetchJson(`${batchRoot}/batch_summary.json`);
    const skillPack = summary.sources?.skillPackPath ? await fetchJson(summary.sources.skillPackPath) : null;
    renderAnalysis(summary, batchRoot, skillPack);
  } catch (error) {
    setStatus(error.message);
  }
}

function init() {
  const input = $('batchRootInput');
  if (input && !input.value) input.value = DEFAULT_BATCH_ROOT;
  $('loadBatchBtn')?.addEventListener('click', loadBatch);
  loadBatch();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
