import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const candidatePath = path.join(
  projectRoot,
  'assets',
  'enemy_packs',
  'authoring',
  'enemies_20260531_000000.json'
);

const expectedStoryLevelIds = Array.from({ length: 3 }, (_, chapterIndex) => {
  const chapter = chapterIndex + 1;
  return Array.from({ length: 10 }, (_, levelIndex) => `level_${chapter}_${levelIndex + 1}`);
}).flat();

const standardBodyParts = ['head', 'chest', 'abdomen', 'arm', 'leg'];
const allowedCarryOver = ['hp', 'armor'];
const requiredClearAfterBattle = ['bleed', 'poison', 'slow', 'vulnerable', 'stun', 'temporary_buff'];

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), 'utf8'));
}

test('enemy V2 候选包为 30 个正式关卡生成机制化主敌', async () => {
  const candidateEnemies = await readJson('assets/enemy_packs/authoring/enemies_20260531_000000.json');
  const enemySkills = await readJson('assets/data/skills_enemy_v1.json');
  const skillIds = new Set((enemySkills.skills || []).map(skill => skill.id));
  const enemies = Object.values(candidateEnemies);

  assert.equal(enemies.length, 30, '候选包应包含 30 个 V2 主敌');
  assert.deepEqual(
    enemies.map(enemy => enemy.candidateForLevel).sort(),
    expectedStoryLevelIds.sort(),
    '候选包应一一覆盖 30 个正式 story 关卡'
  );

  for (const enemy of enemies) {
    assert.match(enemy.id, /^(enemy|boss)_v2_c[123]_\d{2}_/u, `${enemy.id} 应使用 V2 章节语义 ID`);
    assert.equal(enemy.tags?.includes('v2_candidate'), true, `${enemy.id} 应标记为候选敌人`);
    assert.equal(enemy.stats?.hp > 0, true, `${enemy.id} 应有 HP`);
    assert.equal(enemy.stats?.ap > 0, true, `${enemy.id} 应有 AP`);
    assert.deepEqual(Object.keys(enemy.bodyParts || {}).sort(), standardBodyParts.sort(), `${enemy.id} 应使用标准部位`);

    assert.equal(typeof enemy.mechanicProfile?.slotId, 'string', `${enemy.id} 应声明机制槽位`);
    assert.equal(Array.isArray(enemy.capabilities), true, `${enemy.id} 应声明敌人自身能力`);
    assert.equal(enemy.capabilities.length >= 1, true, `${enemy.id} 至少需要一个自身能力`);
    for (const capability of enemy.capabilities) {
      assert.equal(typeof capability.type, 'string', `${enemy.id} capability 应有 type`);
      assert.equal(Array.isArray(capability.counterplay), true, `${enemy.id} capability 应有 counterplay`);
    }

    assert.equal(Array.isArray(enemy.intentModel?.pattern), true, `${enemy.id} 应声明意图循环`);
    assert.equal(enemy.intentModel.pattern.length >= 2, true, `${enemy.id} 意图循环不能为空`);
    assert.equal(typeof enemy.runPressure?.type, 'string', `${enemy.id} 应声明流程压力`);
    assert.deepEqual(enemy.statePersistence?.carryOver, allowedCarryOver, `${enemy.id} 跨关只继承 HP/护甲`);
    for (const clearedState of requiredClearAfterBattle) {
      assert.equal(
        enemy.statePersistence?.clearAfterBattle?.includes(clearedState),
        true,
        `${enemy.id} 战后应清除 ${clearedState}`
      );
    }

    assert.equal(Array.isArray(enemy.skills), true, `${enemy.id} 应引用敌技`);
    assert.equal(enemy.skills.length >= 2, true, `${enemy.id} 至少需要 2 个技能引用`);
    for (const skillId of enemy.skills) {
      assert.equal(skillIds.has(skillId), true, `${enemy.id} 引用了不存在的敌技 ${skillId}`);
    }
  }
});
