import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const packPath = path.join(
  projectRoot,
  'assets',
  'skill_packs',
  'authoring',
  'skills_melee_v4_5_growth_v1_20260526_000000.json'
);

const expectedTracks = {
  sword: {
    label: '剑系',
    x: 220,
    chain: [
      'skill_double_thrust',
      'skill_1771769351059',
      'skill_shockwave_copy_1770042951717',
      'skill_execute_copy_1770043820577',
      'skill_execute_copy_1770044052832',
      'skill_blood_debt_due'
    ]
  },
  hammer: {
    label: '锤系',
    x: 460,
    chain: [
      'skill_heavy_swing',
      'skill_skull_cracker',
      'skill_hold_the_line',
      'skill_execute_copy_1769961767095',
      'skill_earthquake',
      'skill_ragnarok'
    ]
  },
  spell: {
    label: '法术系',
    x: 700,
    chain: [
      'skill_leftover_lunchbox',
      'skill_loose_shoelaces',
      'skill_break_defense_comment',
      'skill_all_talk_weak_legs',
      'skill_forced_overtime'
    ]
  },
  defense: {
    label: '防御系',
    x: 940,
    chain: [
      'skill_block',
      'skill_artery_slice_copy_1769788322314',
      'skill_regroup',
      'skill_fortify',
      'skill_hit_me_if_you_dare',
      'skill_aegis',
      'skill_cactus_vest'
    ]
  },
  tempo: {
    label: '战术/AP系',
    x: 1340,
    chain: [
      'skill_skull_cracker_copy_1770042860426',
      'skill_shockwave_copy_1770041956468',
      'skill_shockwave_copy_1769791396881',
      'skill_aegis_copy_1770042764756'
    ]
  }
};

const rarityBands = {
  Common: [160, 280],
  Uncommon: [320, 420],
  Rare: [480, 600],
  Epic: [640, 820],
  Legendary: [820, 1100]
};

async function loadPack() {
  return JSON.parse(await fs.readFile(packPath, 'utf8'));
}

function getSkillMap(pack) {
  return new Map(pack.skills.map(skill => [skill.id, skill]));
}

function assertTrackChain(skillMap, trackKey, track) {
  for (const [index, skillId] of track.chain.entries()) {
    const skill = skillMap.get(skillId);
    assert(skill, `${track.label} 缺少节点 ${skillId}`);
    assert.equal(skill.editorMeta?.growthTrack, trackKey, `${skill.name} 应归属 ${track.label}`);
    assert.equal(skill.editorMeta?.groupLabel, track.label, `${skill.name} 应显示 ${track.label}`);
    assert.equal(skill.editorMeta?.growthTier, index + 1, `${skill.name} 阶段编号应连续`);
  }

  for (let index = 1; index < track.chain.length; index += 1) {
    const previousId = track.chain[index - 1];
    const skill = skillMap.get(track.chain[index]);
    assert(
      Array.isArray(skill.prerequisites) && skill.prerequisites.includes(previousId),
      `${track.label} 的 ${skill.name} 应以前一阶段 ${previousId} 为前置`
    );
  }
}

test('growth v1 authoring skill tree exists and exposes five clean main tracks', async () => {
  const pack = await loadPack();
  assert.equal(pack.$schemaVersion, 'skills_melee_v3');
  assert.equal(pack.meta?.variantId, 'growth_v1_five_tracks');
  assert.equal(pack.meta?.status, 'authoring_review');
  assert.deepEqual(pack.meta?.growthTracks?.map(track => track.id), Object.keys(expectedTracks));

  const skillMap = getSkillMap(pack);
  for (const [trackKey, track] of Object.entries(expectedTracks)) {
    assertTrackChain(skillMap, trackKey, track);
  }
});

test('growth v1 authoring skill tree keeps valid references and readable editor layout', async () => {
  const pack = await loadPack();
  const skillMap = getSkillMap(pack);
  const ids = new Set(skillMap.keys());

  for (const skill of pack.skills) {
    assert.equal(typeof skill.name, 'string', `${skill.id} 缺少正式名称`);
    assert(!/提桶跑路|光脚|光头|嘴硬腿软|破防发言|装死三秒|仙人掌背心|临时加班|西海岸/u.test(skill.name), `${skill.id} 仍使用测试期名称：${skill.name}`);
    for (const prerequisiteId of skill.prerequisites || []) {
      assert(ids.has(prerequisiteId), `${skill.id} 引用了不存在的前置 ${prerequisiteId}`);
    }
    assert.equal(Number.isFinite(skill.editorMeta?.x), true, `${skill.id} 缺少 editorMeta.x`);
    assert.equal(Number.isFinite(skill.editorMeta?.y), true, `${skill.id} 缺少 editorMeta.y`);
  }

  const visible = pack.skills.filter(skill => !skill.editorMeta?.hiddenInSkillTree);
  const byPosition = new Map();
  for (const skill of visible) {
    const key = `${skill.editorMeta.x},${skill.editorMeta.y}`;
    assert(!byPosition.has(key), `${skill.id} 与 ${byPosition.get(key)} 坐标重叠：${key}`);
    byPosition.set(key, skill.id);
  }
});

test('growth v1 authoring skill tree is vertical by rarity instead of a horizontal flowchart', async () => {
  const pack = await loadPack();
  const skillMap = getSkillMap(pack);

  for (const [trackKey, track] of Object.entries(expectedTracks)) {
    for (const skillId of track.chain) {
      const skill = skillMap.get(skillId);
      assert.equal(skill.editorMeta?.x, track.x, `${track.label} 主干节点 ${skill.name} 应固定在同一流派列`);
      const [minY, maxY] = rarityBands[skill.rarity];
      assert(
        skill.editorMeta?.y >= minY && skill.editorMeta?.y <= maxY,
        `${track.label} 主干节点 ${skill.name} 应位于 ${skill.rarity} 稀有度行内`
      );
    }

    for (let index = 1; index < track.chain.length; index += 1) {
      const parent = skillMap.get(track.chain[index - 1]);
      const child = skillMap.get(track.chain[index]);
      assert.equal(child.editorMeta?.x, parent.editorMeta?.x, `${parent.name} -> ${child.name} 不应横向连线`);
      assert(
        child.editorMeta?.y > parent.editorMeta?.y,
        `${parent.name} -> ${child.name} 应向下连接，而不是同排或向上`
      );
    }
  }
});
