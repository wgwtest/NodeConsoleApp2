#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const skillPackPath = path.join(projectRoot, 'assets', 'skill_packs', 'authoring', 'skills_melee_v4_5_sword_bleed_window_standard_v2_20260529_013420.json');
const buffPackPath = path.join(projectRoot, 'assets', 'data', 'buffs_v2_7.json');
const outputDir = path.join(projectRoot, 'DOC', 'CODEX_DOC', '08_原型与附图', '2026-05-29-剑系流血输出循环回放-v1');
const outputPath = path.join(outputDir, 'index.html');

async function importAsDataModule(filePath, rewrite = source => source) {
  const source = rewrite(await fs.readFile(filePath, 'utf8'));
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

async function importBuffRuntime() {
  const buffUrl = `data:text/javascript;base64,${Buffer.from(
    await fs.readFile(path.join(projectRoot, 'script', 'engine', 'buff', 'Buff.js'), 'utf8'),
    'utf8'
  ).toString('base64')}`;
  const registryModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'buff', 'BuffRegistry.js'));
  const managerModule = await importAsDataModule(
    path.join(projectRoot, 'script', 'engine', 'buff', 'BuffManager.js'),
    source => source.replace("import Buff from './Buff.js';", `import Buff from '${buffUrl}';`)
  );
  const systemModule = await importAsDataModule(path.join(projectRoot, 'script', 'engine', 'buff', 'BuffSystem.js'));
  return {
    BuffRegistry: registryModule.default,
    BuffManager: managerModule.default,
    BuffSystem: systemModule.default
  };
}

async function importCoreEngineClass() {
  return importAsDataModule(
    path.join(projectRoot, 'script', 'engine', 'CoreEngine.js'),
    source => source
      .replace(/^\uFEFF?import[^\n]*\n/gmu, '')
      .replace(/\/\/ 创建单例实例[\s\S]*?export \{ CoreEngine \};\s*$/u, 'export { CoreEngine };\n')
  );
}

class TestEventBus {
  constructor() {
    this.handlers = new Map();
    this.events = [];
  }

  on(name, fn) {
    const next = this.handlers.get(name) || [];
    next.push(fn);
    this.handlers.set(name, next);
    return () => {
      this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item !== fn));
    };
  }

  emit(name, payload) {
    this.events.push({ name, payload });
    for (const fn of this.handlers.get(name) || []) fn(payload);
  }
}

function createActor(id, overrides = {}) {
  const hp = overrides.hp ?? 100;
  const maxHp = overrides.maxHp ?? hp;
  return {
    id,
    name: overrides.name || id,
    stats: {
      hp,
      maxHp,
      ap: overrides.ap ?? 5,
      maxAp: overrides.maxAp ?? overrides.ap ?? 5,
      speed: overrides.speed ?? 10,
      atk: overrides.atk ?? 10
    },
    bodyParts: JSON.parse(JSON.stringify(overrides.bodyParts || {}))
  };
}

async function buildRuntime() {
  const rawBuffs = JSON.parse(await fs.readFile(buffPackPath, 'utf8'));
  const { BuffRegistry, BuffManager, BuffSystem } = await importBuffRuntime();
  const eventBus = new TestEventBus();
  const registry = new BuffRegistry(rawBuffs.buffs);
  const system = new BuffSystem(eventBus, registry);
  system.start();
  return { rawBuffs, BuffManager, eventBus, registry, system };
}

function attachBuffs(actor, runtime) {
  actor.buffs = new runtime.BuffManager(actor, runtime.registry, runtime.eventBus);
  runtime.system.registerManager(actor.buffs);
  return actor;
}

function getHp(actor) {
  return Number(actor?.stats?.hp ?? actor?.hp ?? 0) || 0;
}

function getArmorParts(actor) {
  return actor?.bodyParts || {};
}

function getArmorTotal(actor) {
  return Object.values(getArmorParts(actor)).reduce((sum, part) => sum + (Number(part?.current ?? 0) || 0), 0);
}

function formatArmor(actor) {
  const labelByPart = {
    head: '头',
    chest: '胸',
    abdomen: '腹',
    arm: '臂',
    leg: '腿'
  };
  return Object.entries(getArmorParts(actor))
    .map(([key, part]) => `${labelByPart[key] || key}:${Math.round(Number(part?.current ?? 0) || 0)}/${Math.round(Number(part?.max ?? 0) || 0)}`)
    .join(' ');
}

function formatBuffs(actor) {
  const buffs = actor?.buffs?.getAll ? actor.buffs.getAll() : [];
  if (!buffs.length) return '无';
  return buffs
    .map(buff => {
      const name = buff.definition?.name || buff.name || buff.id;
      const remaining = Number(buff.remaining ?? 0) || 0;
      const stacks = Number(buff.stacks ?? 0) || 0;
      const stackText = stacks > 1 ? ` x${stacks}` : '';
      return `${name}(${remaining}回合${stackText})`;
    })
    .join('、');
}

function getBleedRemaining(actor) {
  return actor?.buffs?.getRemaining ? actor.buffs.getRemaining('buff_bleed') : 0;
}

function snapshot(enemy) {
  return {
    hp: getHp(enemy),
    armorTotal: getArmorTotal(enemy),
    armorText: formatArmor(enemy),
    bleed: getBleedRemaining(enemy),
    buffsText: formatBuffs(enemy)
  };
}

function deltaText(before, after) {
  const hpDelta = after.hp - before.hp;
  const armorDelta = after.armorTotal - before.armorTotal;
  const bleedDelta = after.bleed - before.bleed;
  return {
    hp: `${Math.round(before.hp)} -> ${Math.round(after.hp)} (${hpDelta <= 0 ? '' : '+'}${Math.round(hpDelta)})`,
    armor: `${Math.round(before.armorTotal)} -> ${Math.round(after.armorTotal)} (${armorDelta <= 0 ? '' : '+'}${Math.round(armorDelta)})`,
    bleed: `${Math.round(before.bleed)} -> ${Math.round(after.bleed)} (${bleedDelta <= 0 ? '' : '+'}${Math.round(bleedDelta)})`
  };
}

function humanizeReason(reason) {
  return String(reason || '执行失败')
    .replace(/requires buff_bleed remaining >= (\d+)/g, '需要流血 W >= $1')
    .replace(/requires target HP percent < ([0-9.]+)/g, '需要目标 HP 低于 $1')
    .replace(/Target .* not found\./g, '目标不存在');
}

function pickTargetPart(enemy, policy, roundIndex, actionIndex) {
  if (policy === 'chest') return 'chest';
  if (policy === 'round-robin') {
    const order = ['chest', 'abdomen', 'head', 'arm', 'leg'];
    return order[(roundIndex + actionIndex) % order.length];
  }
  const entries = Object.entries(getArmorParts(enemy))
    .filter(([, part]) => Number(part?.max ?? 0) > 0 || Number(part?.current ?? 0) > 0)
    .sort((a, b) => (Number(b[1]?.current ?? 0) || 0) - (Number(a[1]?.current ?? 0) || 0));
  return entries[0]?.[0] || 'chest';
}

function makeDriver({ CoreEngine, runtime, player, enemy, skills }) {
  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = runtime.eventBus;
  driver.data = {
    playerData: player,
    currentLevelData: { enemies: [enemy] },
    getSkillConfig: skillId => skills.find(skill => skill.id === skillId) || null
  };
  return driver;
}

function createEnemy() {
  return createActor('enemy_early_100', {
    name: '前期假人 100HP',
    hp: 100,
    maxHp: 100,
    bodyParts: {
      head: { current: 15, max: 15, weakness: 1 },
      chest: { current: 30, max: 30, weakness: 1 },
      abdomen: { current: 25, max: 25, weakness: 1 },
      arm: { current: 20, max: 20, weakness: 1 },
      leg: { current: 20, max: 20, weakness: 1 }
    }
  });
}

function createPlayer() {
  return createActor('player_1', {
    name: '玩家测试体',
    hp: 100,
    maxHp: 100,
    ap: 5,
    maxAp: 5,
    bodyParts: {
      head: { current: 20, max: 20, weakness: 1 },
      chest: { current: 30, max: 30, weakness: 1 },
      abdomen: { current: 24, max: 24, weakness: 1 },
      arm: { current: 24, max: 24, weakness: 1 },
      leg: { current: 24, max: 24, weakness: 1 }
    }
  });
}

function resolveRoundCombo(scenario, roundIndex, state) {
  if (typeof scenario.comboForRound === 'function') return scenario.comboForRound(roundIndex, state);
  return scenario.combo;
}

async function simulateScenario({ scenario, skillPack, CoreEngine }) {
  const runtime = await buildRuntime();
  const player = attachBuffs(createPlayer(), runtime);
  const enemy = attachBuffs(createEnemy(), runtime);
  const skillsByName = new Map(skillPack.skills.map(skill => [skill.name, skill]));
  const driver = makeDriver({ CoreEngine, runtime, player, enemy, skills: skillPack.skills });
  const rows = [];
  const state = { usedFinisher: false };

  for (let round = 1; round <= scenario.maxRounds; round++) {
    if (getHp(enemy) <= 0) break;
    player.stats.ap = scenario.apBudget;
    player.stats.maxAp = scenario.apBudget;
    const before = snapshot(enemy);
    const comboNames = resolveRoundCombo(scenario, round, state);
    const notes = [];
    let spentAp = 0;
    const usedNames = [];

    for (let i = 0; i < comboNames.length; i++) {
      const skillName = comboNames[i];
      const skill = skillsByName.get(skillName);
      if (!skill) {
        notes.push(`缺少技能：${skillName}`);
        continue;
      }
      const ap = Number(skill.costs?.ap ?? 0) || 0;
      if (spentAp + ap > scenario.apBudget) {
        notes.push(`跳过 ${skillName}：AP ${spentAp + ap}/${scenario.apBudget} 超预算`);
        continue;
      }
      if (usedNames.includes(skillName)) {
        notes.push(`跳过 ${skillName}：同一回合不重复释放同一技能`);
        continue;
      }
      const bodyPart = pickTargetPart(enemy, scenario.targetPolicy, round - 1, i);
      const result = driver.executePlayerSkill({
        source: 'PLAYER',
        sourceId: player.id,
        skillId: skill.id,
        targetId: enemy.id,
        bodyPart,
        cost: ap
      });
      if (!result?.ok) {
        notes.push(`${skillName} 未释放：${humanizeReason(result?.reason)}`);
        continue;
      }
      spentAp += ap;
      usedNames.push(skillName);
      if (skillName === '断脉一剑' || skillName === '猩红收割') state.usedFinisher = true;
      if (getHp(enemy) <= 0) break;
    }

    const afterActions = snapshot(enemy);
    runtime.eventBus.emit('TURN_END', { turn: round });
    const afterTurnEnd = snapshot(enemy);
    state.lastHpPercent = afterTurnEnd.hp / Math.max(1, Number(enemy.stats?.maxHp ?? 100) || 100);
    const delta = deltaText(before, afterTurnEnd);
    rows.push({
      round,
      combo: usedNames.length ? usedNames.join(' + ') : '无有效释放',
      ap: `${spentAp}/${scenario.apBudget}`,
      before,
      afterActions,
      afterTurnEnd,
      delta,
      notes: notes.join('；') || '无'
    });
  }

  const last = snapshot(enemy);
  return {
    scenario,
    rows,
    result: {
      killed: last.hp <= 0,
      rounds: rows.length,
      hp: last.hp,
      armorTotal: last.armorTotal,
      bleed: last.bleed,
      armorText: last.armorText,
      buffsText: last.buffsText
    }
  };
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderScenario(result) {
  const { scenario, rows } = result;
  const outcome = result.result.killed
    ? `${result.result.rounds} 轮击败`
    : `${result.result.rounds} 轮后未击败`;
  return `
    <section class="scenario">
      <div class="scenario-head">
        <div>
          <p class="eyebrow">${htmlEscape(scenario.kind)}</p>
          <h2>${htmlEscape(scenario.name)}</h2>
          <p>${htmlEscape(scenario.summary)}</p>
        </div>
        <dl class="score">
          <div><dt>结果</dt><dd>${htmlEscape(outcome)}</dd></div>
          <div><dt>HP</dt><dd>${Math.round(result.result.hp)}</dd></div>
          <div><dt>护甲总量</dt><dd>${Math.round(result.result.armorTotal)}</dd></div>
          <div><dt>流血 W</dt><dd>${Math.round(result.result.bleed)}</dd></div>
        </dl>
      </div>
      <table>
        <thead>
          <tr>
            <th>轮次</th>
            <th>本轮组合</th>
            <th>AP</th>
            <th>HP 变化</th>
            <th>护甲变化</th>
            <th>流血 W</th>
            <th>回合结束后状态</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td class="round">${row.round}</td>
              <td class="combo">${htmlEscape(row.combo)}</td>
              <td>${htmlEscape(row.ap)}</td>
              <td>${htmlEscape(row.delta.hp)}</td>
              <td>${htmlEscape(row.delta.armor)}</td>
              <td>${htmlEscape(row.delta.bleed)}</td>
              <td>
                <div class="state-line">护甲：${htmlEscape(row.afterTurnEnd.armorText)}</div>
                <div class="state-line">Buff：${htmlEscape(row.afterTurnEnd.buffsText)}</div>
              </td>
              <td class="note">${htmlEscape(row.notes)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderHtml({ generatedAt, skillPack, results }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>剑系流血输出循环回放</title>
  <style>
    :root {
      --paper: #f6f2ea;
      --ink: #221f1a;
      --muted: #6f685d;
      --line: #d7cfc2;
      --panel: #fffaf1;
      --accent: #a83b28;
      --accent-2: #1f6f68;
      --accent-3: #7a5b13;
      --soft-red: #f5ddd8;
      --soft-green: #dff0e8;
      --soft-yellow: #f3e7c6;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif;
      line-height: 1.55;
    }

    main {
      width: min(1780px, calc(100% - 48px));
      margin: 0 auto;
      padding: 34px 0 56px;
    }

    header {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(420px, 0.7fr);
      gap: 28px;
      align-items: end;
      border-bottom: 2px solid var(--ink);
      padding-bottom: 22px;
      margin-bottom: 26px;
    }

    h1, h2 { margin: 0; line-height: 1.12; letter-spacing: 0; }
    h1 { font-size: 36px; }
    h2 { font-size: 24px; }
    p { margin: 10px 0 0; color: var(--muted); }

    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .meta div, .score div {
      border: 1px solid var(--line);
      background: var(--panel);
      padding: 10px 12px;
    }

    dt {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 3px;
    }

    dd {
      margin: 0;
      font-weight: 700;
    }

    .notice {
      border: 1px solid #caa99d;
      background: var(--soft-red);
      padding: 14px 16px;
      margin: 0 0 22px;
    }

    .scenario {
      margin-top: 28px;
      border: 1px solid var(--line);
      background: rgba(255, 250, 241, 0.68);
    }

    .scenario-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 540px;
      gap: 22px;
      padding: 18px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }

    .eyebrow {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
    }

    .score {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 14px;
    }

    th {
      text-align: left;
      color: #fff;
      background: var(--ink);
      padding: 10px;
      font-weight: 700;
    }

    td {
      vertical-align: top;
      padding: 11px 10px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.34);
    }

    tr:nth-child(even) td { background: rgba(255, 250, 241, 0.95); }
    th:nth-child(1), td:nth-child(1) { width: 62px; }
    th:nth-child(2), td:nth-child(2) { width: 250px; }
    th:nth-child(3), td:nth-child(3) { width: 70px; }
    th:nth-child(4), td:nth-child(4) { width: 140px; }
    th:nth-child(5), td:nth-child(5) { width: 150px; }
    th:nth-child(6), td:nth-child(6) { width: 120px; }
    th:nth-child(8), td:nth-child(8) { width: 240px; }

    .round {
      font-weight: 800;
      color: var(--accent);
    }

    .combo {
      font-weight: 700;
      color: var(--accent-2);
    }

    .state-line + .state-line {
      margin-top: 4px;
      color: var(--muted);
    }

    .note {
      color: var(--accent-3);
    }

    @media (max-width: 1100px) {
      main { width: calc(100% - 24px); }
      header, .scenario-head { grid-template-columns: 1fr; }
      .score, .meta { grid-template-columns: 1fr 1fr; }
      table { min-width: 1180px; }
      .scenario { overflow-x: auto; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>剑系流血输出循环回放</h1>
        <p>这个文件不是理论说明，而是用当前候选技能包和 CoreEngine 跑出的逐轮账本。每一行只看本轮组合造成的整体状态变化。</p>
      </div>
      <dl class="meta">
        <div><dt>生成时间</dt><dd>${htmlEscape(generatedAt)}</dd></div>
        <div><dt>敌人模型</dt><dd>100 HP / 110 总护甲</dd></div>
        <div><dt>玩家 AP</dt><dd>每轮 5 AP</dd></div>
        <div><dt>技能包</dt><dd>${htmlEscape(skillPack.meta?.variantId || skillPack.meta?.title || 'unknown')}</dd></div>
      </dl>
    </header>

    <div class="notice">
      当前引擎中 <strong>DMG_ARMOR 会先扣指定部位护甲，护甲不足部分溢出为 HP 伤害</strong>；流血仍按回合结束结算为固定 HP 伤害。这个 HTML 用来暴露真实释放过程，而不是替技能设计找理由。
    </div>

    ${results.map(renderScenario).join('\n')}
  </main>
</body>
</html>`;
}

async function main() {
  const skillPack = JSON.parse(await fs.readFile(skillPackPath, 'utf8'));
  const { CoreEngine } = await importCoreEngineClass();
  const scenarios = [
    {
      kind: '前期可用循环',
      name: '基础破甲 + 轻流血',
      summary: '每轮重复 剑击 + 浅割 + 锯齿斩。目标是看低 KP 组合能否形成清晰的 HP 与流血变化。',
      combo: ['剑击', '浅割', '锯齿斩'],
      apBudget: 5,
      maxRounds: 24,
      targetPolicy: 'highest-armor'
    },
    {
      kind: '前期末循环',
      name: '连续建窗循环',
      summary: '每轮重复 浅割 + 锯齿斩 + 深切。它会更快建立 W，并在破甲后通过普通伤害产生 HP 溢出。',
      combo: ['浅割', '锯齿斩', '深切'],
      apBudget: 5,
      maxRounds: 24,
      targetPolicy: 'highest-armor'
    },
    {
      kind: '中阶预览循环',
      name: '建窗后读窗循环',
      summary: '第 1 轮建窗，之后重复 血涌斩 + 饮血斩 + 反手割裂。用于观察读窗技能在 100HP 假人上的真实循环，不代表前期一定已学会。',
      apBudget: 5,
      maxRounds: 24,
      targetPolicy: 'highest-armor',
      comboForRound(round, state) {
        if (round === 1) return ['浅割', '锯齿斩', '深切'];
        const hpPercent = state?.lastHpPercent;
        if (!state.usedFinisher && Number.isFinite(hpPercent) && hpPercent < 0.35) return ['断脉一剑', '血涌斩'];
        return ['血涌斩', '饮血斩', '反手割裂'];
      }
    }
  ];

  const results = [];
  for (const scenario of scenarios) {
    const result = await simulateScenario({ scenario, skillPack, CoreEngine });
    results.push(result);
  }
  const generatedAt = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });

  await fs.mkdir(outputDir, { recursive: true });
  const html = renderHtml({ generatedAt, skillPack, results }).replace(/[ \t]+$/gmu, '');
  await fs.writeFile(outputPath, html, 'utf8');
  console.log(path.relative(projectRoot, outputPath));
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
