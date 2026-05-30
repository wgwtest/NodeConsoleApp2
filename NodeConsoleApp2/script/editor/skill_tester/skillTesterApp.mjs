import {
  analyzeSkillTestScenario,
  buildSkillTestRecord,
  createSkillTestRecordPath,
  formatSkillTestTimestamp
} from './skillTesterModel.mjs';

const dom = {};
let lastResult = null;
let selectedCandidateIndex = 0;
let lastSources = null;

function $(id) {
  return document.getElementById(id);
}

function bindDom() {
  [
    'levelIndexInput',
    'kpModeSelect',
    'initialKpInput',
    'perLevelKpInput',
    'manualKpInput',
    'apBudgetInput',
    'turnLimitInput',
    'skillFocusSelect',
    'runSkillTestBtn',
    'saveSkillTestRecordBtn',
    'skillPackPathInput',
    'buffPackPathInput',
    'levelsPathInput',
    'enemyPathInput',
    'playerPathInput',
    'contextPanel',
    'candidateCountBadge',
    'candidateList',
    'selectedCandidateBadge',
    'turnReplayTable',
    'findingList',
    'statusLine'
  ].forEach(id => {
    dom[id] = $(id);
  });
}

function html(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function readNumber(id, fallback) {
  const value = Number(dom[id]?.value);
  return Number.isFinite(value) ? value : fallback;
}

function readScenario() {
  return {
    levelIndex: readNumber('levelIndexInput', 5),
    kpMode: dom.kpModeSelect.value,
    assumedInitialKp: readNumber('initialKpInput', 5),
    assumedKpPerLevel: readNumber('perLevelKpInput', 3),
    manualKp: readNumber('manualKpInput', 15),
    apBudget: readNumber('apBudgetInput', 5),
    maxTurns: readNumber('turnLimitInput', 12),
    focus: dom.skillFocusSelect.value
  };
}

function readSources() {
  return {
    skillPackPath: dom.skillPackPathInput.value.trim(),
    buffPackPath: dom.buffPackPathInput.value.trim(),
    levelsPath: dom.levelsPathInput.value.trim(),
    enemyPath: dom.enemyPathInput.value.trim(),
    playerPath: dom.playerPathInput.value.trim()
  };
}

function setStatus(text, kind = '') {
  dom.statusLine.textContent = text;
  dom.statusLine.className = `status-line ${kind}`.trim();
}

async function fetchJson(projectPath) {
  const path = String(projectPath || '').replace(/^\/+/u, '');
  const response = await fetch(`/${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`读取失败：${path} (${response.status})`);
  }
  return response.json();
}

function formatDelta(value, unit = '') {
  const number = Number(value) || 0;
  const cls = number < 0 ? 'negative' : number > 0 ? 'positive' : '';
  const sign = number > 0 ? '+' : '';
  return `<span class="${cls}">${sign}${Math.round(number)}${unit}</span>`;
}

function formatBuffWindow(turn) {
  const before = turn.before?.buffs?.buff_bleed?.remaining || 0;
  const after = turn.after?.buffs?.buff_bleed?.remaining || 0;
  return `${before} -> ${after}`;
}

function summarizeEvents(turn) {
  const items = [];
  for (const event of turn.events || []) {
    if (event.type === 'buff_apply') {
      items.push(`施加 ${event.buffId}(${event.remaining})`);
    } else if (event.type === 'buff_consume') {
      items.push(`消耗 ${event.buffId} ${event.consumed || 0}`);
    } else if (event.type === 'buff_tick') {
      items.push(`${event.buffId} 结算 HP-${event.hpDamage || 0}`);
    } else if (event.type === 'buff_trigger') {
      items.push(`${event.buffId} 触发 ${event.appliedBuffId}(${event.remaining})`);
    } else if (event.type === 'unsupported_effect') {
      items.push(`未支持效果 ${event.effectType}`);
    }
  }
  for (const skipped of turn.skipped || []) {
    items.push(`${skipped.name} 跳过：${skipped.reason}`);
  }
  return items.length
    ? `<div class="event-list">${items.slice(0, 6).map(item => `<span>${html(item)}</span>`).join('')}</div>`
    : '无';
}

function renderContext(result, sources) {
  const context = result.context;
  const levelName = context.level?.name || context.level?.title || context.level?.id;
  dom.contextPanel.innerHTML = `
    <div class="panel-title">
      <h2>测试上下文</h2>
      <span class="badge neutral">${html(context.level?.flow?.nodeLabel || `第 ${context.levelIndex} 关`)}</span>
    </div>
    <div class="metric-grid">
      <div class="metric"><b>${html(levelName)}</b><span>关卡</span></div>
      <div class="metric"><b>${context.kpBudget}</b><span>KP 预算</span></div>
      <div class="metric"><b>${context.assumedInitialKp}</b><span>模型初始 KP</span></div>
      <div class="metric"><b>${context.assumedKpPerLevel}</b><span>模型每关 KP</span></div>
      <div class="metric"><b>${context.initialSkillPoints}</b><span>玩家初始 KP</span></div>
      <div class="metric"><b>${context.actualThroughCurrent}</b><span>实际累计 KP</span></div>
      <div class="metric"><b>${html(context.enemyName)}</b><span>敌人</span></div>
      <div class="metric"><b>${context.enemy.hp}/${context.enemy.maxHp}</b><span>敌人 HP</span></div>
      <div class="metric"><b>${context.enemy.armorTotal}</b><span>敌人护甲</span></div>
      <div class="metric"><b>${result.focusedSkillCount}/${result.allSkillCount}</b><span>技能范围</span></div>
      <div class="metric"><b>${result.builds.length}</b><span>合法构筑</span></div>
    </div>
    <div class="source-list">
      <div><b>技能包</b> ${html(sources.skillPackPath)}</div>
      <div><b>Buff</b> ${html(sources.buffPackPath)}</div>
      <div><b>关卡</b> ${html(sources.levelsPath)}</div>
      <div><b>敌人</b> ${html(sources.enemyPath)}</div>
      <div><b>玩家</b> ${html(sources.playerPath)}</div>
    </div>
  `;
}

function renderCandidates(result) {
  dom.candidateCountBadge.textContent = String(result.candidates.length);
  if (!result.candidates.length) {
    dom.candidateList.innerHTML = '<div class="empty-state">没有找到满足 KP 与前置关系的候选构筑。</div>';
    return;
  }

  dom.candidateList.innerHTML = result.candidates.slice(0, 24).map((candidate, index) => {
    const skillNames = candidate.build.skills.map(skill => skill.name || skill.id).join('、');
    const loopNames = candidate.combo.skills.map(skill => skill.name || skill.id).join(' + ');
    const warningCount = candidate.simulation.findings.filter(item => item.level === 'warning').length;
    const killText = candidate.simulation.killed
      ? `${candidate.simulation.turnsToKill} 回合击败`
      : `剩 ${candidate.simulation.final.enemy.hp} HP`;
    return `
      <button class="candidate ${index === selectedCandidateIndex ? 'is-selected' : ''}" type="button" data-candidate-index="${index}">
        <span class="candidate-head">
          <strong>方案 ${index + 1}</strong>
          <span class="candidate-score">${candidate.score}</span>
        </span>
        <span class="candidate-meta">
          <span class="chip">KP ${candidate.build.kpUsed}/${result.context.kpBudget}</span>
          <span class="chip">AP ${candidate.combo.apUsed}</span>
          <span class="chip ${candidate.simulation.killed ? 'good' : 'warn'}">${killText}</span>
          <span class="chip ${warningCount ? 'warn' : 'good'}">问题 ${warningCount}</span>
        </span>
        <span class="candidate-skills">${html(skillNames)}</span>
        <span class="candidate-loop">循环：${html(loopNames)}</span>
      </button>
    `;
  }).join('');

  dom.candidateList.querySelectorAll('[data-candidate-index]').forEach(button => {
    button.addEventListener('click', () => {
      selectedCandidateIndex = Number(button.dataset.candidateIndex) || 0;
      renderAll(lastResult, lastSources);
    });
  });
}

function renderReplay(result) {
  const candidate = result.candidates[selectedCandidateIndex] || result.best;
  const tbody = dom.turnReplayTable.querySelector('tbody');
  if (!candidate) {
    dom.selectedCandidateBadge.textContent = '未选择';
    tbody.innerHTML = '<tr><td colspan="7">暂无回放。</td></tr>';
    renderFindings(result.findings || []);
    return;
  }

  dom.selectedCandidateBadge.textContent = `方案 ${selectedCandidateIndex + 1}`;
  tbody.innerHTML = candidate.simulation.turns.map(turn => `
    <tr>
      <td>${turn.turn}</td>
      <td>${turn.usedSkillNames.length ? html(turn.usedSkillNames.join(' + ')) : '无'}</td>
      <td>${turn.apUsed}/${readNumber('apBudgetInput', 5)}</td>
      <td>${turn.before.hp} -> ${turn.after.hp} (${formatDelta(turn.delta.hp)})</td>
      <td>${turn.before.armorTotal} -> ${turn.after.armorTotal} (${formatDelta(turn.delta.armor)})</td>
      <td>${html(formatBuffWindow(turn))}</td>
      <td>${summarizeEvents(turn)}</td>
    </tr>
  `).join('');

  renderFindings([...(result.findings || []), ...(candidate.simulation.findings || [])]);
}

function renderFindings(findings) {
  const seen = new Set();
  const unique = (findings || []).filter(item => {
    const key = `${item.id}:${item.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) {
    dom.findingList.innerHTML = '<li>暂未发现明显问题。</li>';
    return;
  }
  dom.findingList.innerHTML = unique.map(item => `
    <li class="${html(item.level || 'info')}">
      <strong>${html(item.id || 'finding')}</strong>：${html(item.text || '')}
    </li>
  `).join('');
}

function renderAll(result, sources) {
  renderContext(result, sources);
  renderCandidates(result);
  renderReplay(result);
}

async function runSkillTest() {
  const scenario = readScenario();
  const sources = readSources();
  setStatus('正在读取技能、Buff、关卡和敌人数据...');
  const [skillPack, buffPack, levelsDocument, enemiesDocument, playerDocument] = await Promise.all([
    fetchJson(sources.skillPackPath),
    fetchJson(sources.buffPackPath),
    fetchJson(sources.levelsPath),
    fetchJson(sources.enemyPath),
    fetchJson(sources.playerPath)
  ]);

  selectedCandidateIndex = 0;
  lastSources = sources;
  lastResult = analyzeSkillTestScenario({
    ...scenario,
    skillPack,
    buffPack,
    levelsDocument,
    enemyDocuments: [enemiesDocument],
    playerDocument
  });
  renderAll(lastResult, sources);
  setStatus(`测试完成：生成 ${lastResult.candidates.length} 个候选循环。`, 'ok');
}

async function saveSkillTestRecord() {
  if (!lastResult) {
    await runSkillTest();
  }
  const timestamp = formatSkillTestTimestamp();
  const path = createSkillTestRecordPath(timestamp);
  const record = buildSkillTestRecord({
    timestamp,
    sources: lastSources,
    scenario: readScenario(),
    result: lastResult
  });
  const response = await fetch('/__skill_editor_file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      content: JSON.stringify(record, null, 2)
    })
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    throw new Error(body?.error || `保存失败 (${response.status})`);
  }
  setStatus(`已保存测试记录：${body.path}`, 'ok');
}

function bindEvents() {
  const syncKpInputs = () => {
    const mode = dom.kpModeSelect.value;
    dom.initialKpInput.disabled = mode !== 'assumed_per_level';
    dom.perLevelKpInput.disabled = mode !== 'assumed_per_level';
    dom.manualKpInput.disabled = mode !== 'manual';
  };
  dom.kpModeSelect.addEventListener('change', syncKpInputs);
  syncKpInputs();

  dom.runSkillTestBtn.addEventListener('click', () => {
    runSkillTest().catch(error => setStatus(error?.message || String(error), 'error'));
  });
  dom.saveSkillTestRecordBtn.addEventListener('click', () => {
    saveSkillTestRecord().catch(error => setStatus(error?.message || String(error), 'error'));
  });
}

export function bootstrapSkillTester() {
  bindDom();
  bindEvents();
  runSkillTest().catch(error => setStatus(error?.message || String(error), 'error'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapSkillTester);
} else {
  bootstrapSkillTester();
}
