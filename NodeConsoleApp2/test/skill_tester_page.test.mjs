import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pagePath = path.join(projectRoot, 'test', 'skill_tester.html');
const appPath = path.join(projectRoot, 'script', 'editor', 'skill_tester', 'skillTesterApp.mjs');
const cssPath = path.join(projectRoot, 'script', 'editor', 'skill_tester', 'skill_tester.css');

test('skill tester page exposes the required workbench controls', async () => {
  const html = await fs.readFile(pagePath, 'utf8');

  for (const id of [
    'levelIndexInput',
    'levelSelect',
    'enemySelect',
    'enemyLockBtn',
    'kpModeSelect',
    'initialKpInput',
    'perLevelKpInput',
    'manualKpInput',
    'apBudgetInput',
    'turnLimitInput',
    'skillFocusSelect',
    'runSkillTestBtn',
    'saveSkillTestRecordBtn',
    'enemySkillPathInput',
    'levelContextStrip',
    'levelSummaryPanel',
    'enemySummaryPanel',
    'contextPanel',
    'candidateList',
    'turnReplayTable',
    'findingList'
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `页面缺少 #${id}`);
  }

  assert.match(html, /skillTesterApp\.mjs/u);
  assert.match(html, /skill_tester\.css/u);
  assert.match(html, /初始 5KP \+ 3KP\/关/u);
  assert.match(html, /id=["']playerPathInput["']/u);
  assert.match(html, /assets\/data\/skills_enemy_v1\.json/u);
  assert.match(html, /assets\/enemy_packs\/current\/enemies\.json/u);
  assert.match(html, /<th>敌方行动<\/th>/u);
  assert.match(html, /data-lock-label/u);
  assert.match(html, /data-unlock-label/u);
});

test('skill tester page orders package selection before KP and enemy context controls', async () => {
  const html = await fs.readFile(pagePath, 'utf8');
  const sourceIndex = html.indexOf('class="source-strip"');
  const contextIndex = html.indexOf('id="levelContextStrip"');
  const controlIndex = html.indexOf('class="control-strip"');

  assert.notEqual(sourceIndex, -1);
  assert.notEqual(contextIndex, -1);
  assert.notEqual(controlIndex, -1);
  assert.equal(sourceIndex < contextIndex, true);
  assert.equal(contextIndex < controlIndex, true);
});

test('skill tester places context summary as a horizontal strip above status and keeps workbench two-column', async () => {
  const html = await fs.readFile(pagePath, 'utf8');
  const controlIndex = html.indexOf('class="control-strip"');
  const contextPanelIndex = html.indexOf('id="contextPanel"');
  const statusIndex = html.indexOf('id="statusLine"');
  const workbenchIndex = html.indexOf('class="workbench"');
  const nextContextPanelIndex = html.indexOf('id="contextPanel"', workbenchIndex);
  const candidateIndex = html.indexOf('candidate-panel', workbenchIndex);
  const replayIndex = html.indexOf('replay-panel', workbenchIndex);

  assert.notEqual(controlIndex, -1);
  assert.notEqual(contextPanelIndex, -1);
  assert.notEqual(statusIndex, -1);
  assert.notEqual(workbenchIndex, -1);
  assert.equal(controlIndex < contextPanelIndex, true);
  assert.equal(contextPanelIndex < statusIndex, true);
  assert.equal(statusIndex < workbenchIndex, true);
  assert.equal(nextContextPanelIndex, -1);
  assert.equal(candidateIndex > workbenchIndex, true);
  assert.equal(replayIndex > candidateIndex, true);
});

test('skill tester workbench uses a 3 to 7 candidate and replay column ratio', async () => {
  const css = await fs.readFile(cssPath, 'utf8');

  assert.match(
    css,
    /\.workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(300px,\s*3fr\)\s+minmax\(0,\s*7fr\)/u
  );
  assert.doesNotMatch(css, /grid-template-columns:\s*minmax\(360px,\s*0\.82fr\)\s+minmax\(620px,\s*1\.18fr\)/u);
});

test('skill tester replay table prioritizes player loop and enemy damage evidence', async () => {
  const html = await fs.readFile(pagePath, 'utf8');
  const app = await fs.readFile(appPath, 'utf8');
  const tableStart = html.indexOf('<table id="turnReplayTable">');
  const tableEnd = html.indexOf('</table>', tableStart);
  const tableHtml = html.slice(tableStart, tableEnd);
  const headers = [...tableHtml.matchAll(/<th>(.*?)<\/th>/gu)].map(match => match[1]);

  assert.deepEqual(headers, [
    '回合',
    '我方技能组合',
    '敌方 HP',
    '敌方护甲',
    '敌方行动',
    '我方状态',
    'AP',
    '结算 / 状态'
  ]);
  assert.equal(headers.includes('流血窗口'), false);
  assert.match(app, /class="replay-cell replay-cell--player-skill"/u);
  assert.match(app, /formatEnemyAction\(turn\.enemyAction\)/u);
  assert.match(app, /summarizeEvents\(turn\)/u);
  assert.doesNotMatch(app, /formatBuffWindow\(turn\)/u);
});

test('skill tester candidate cards expose duplicate tactic evidence', async () => {
  const app = await fs.readFile(appPath, 'utf8');
  const css = await fs.readFile(cssPath, 'utf8');

  assert.match(app, /duplicateBuildCount/u);
  assert.match(app, /unusedSkillNames/u);
  assert.match(app, /candidate-duplicate-detail/u);
  assert.match(css, /\.candidate-duplicate-detail/u);
});

test('skill tester app and stylesheet files exist', async () => {
  await fs.access(appPath);
  await fs.access(cssPath);
});

test('skill tester app renders dataset attributes with html-safe kebab names', async () => {
  const app = await fs.readFile(appPath, 'utf8');

  assert.match(app, /function toDataAttributeName/u);
  assert.match(app, /data-\$\{toDataAttributeName\(key\)\}/u);
  assert.doesNotMatch(app, /data-\$\{key\}/u);
});
