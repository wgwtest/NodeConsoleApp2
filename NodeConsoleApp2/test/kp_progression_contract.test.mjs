import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), 'utf8'));
}

function getStoryRewardKpRows(levelsDocument) {
  return Object.values(levelsDocument.levels || {})
    .filter(level => level?.flow?.kind === 'story')
    .sort((a, b) => (Number(a.flow?.order) || 0) - (Number(b.flow?.order) || 0))
    .map(level => ({
      id: level.id,
      order: level.flow?.order,
      kp: Number(level.rewards?.kp ?? 0)
    }));
}

test('default player starts with 5 spendable KP for formal balance', async () => {
  const player = await readJson('assets/data/player.json');
  assert.equal(player.default.skills.skillPoints, 5);
});

test('formal story level packs grant 3 KP per story level', async () => {
  for (const relativePath of [
    'assets/data/levels.json',
    'assets/map_packs/current/story_pack_v1/levels.json',
    'assets/map_packs/authoring/story_pack_v1/levels.json'
  ]) {
    const rows = getStoryRewardKpRows(await readJson(relativePath));
    assert.equal(rows.length, 30, `${relativePath} 应包含 30 个正式 story 关卡`);
    assert.deepEqual(
      rows.filter(row => row.kp !== 3),
      [],
      `${relativePath} 的正式 story 关卡应统一奖励 3 KP`
    );
  }
});
