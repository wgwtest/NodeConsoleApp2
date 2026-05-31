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
    'kpModeSelect',
    'initialKpInput',
    'perLevelKpInput',
    'manualKpInput',
    'apBudgetInput',
    'turnLimitInput',
    'skillFocusSelect',
    'runSkillTestBtn',
    'saveSkillTestRecordBtn',
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

test('skill tester app and stylesheet files exist', async () => {
  await fs.access(appPath);
  await fs.access(cssPath);
});
