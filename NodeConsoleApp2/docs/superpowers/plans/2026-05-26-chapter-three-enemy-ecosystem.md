# Chapter Three Enemy Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace third-chapter old-sample filler in `level_3_5` through `level_3_8` with four chapter-specific enemies, enemy skills, and content contracts driven by the WBS-3.4.7 counter matrix.

**Architecture:** Keep this as a content-data change guarded by `node:test` contracts. First add failing tests that require the four new enemy IDs, their enemy-skill pressure mapping, and their use in chapter-three P0 levels; then update `enemies.json`, `skills_enemy_v1.json`, and all three level documents in lockstep; finally run content, simulator, and smoke-contract verification without tuning single damage values for 3-9 or 3-10.

**Tech Stack:** Node.js `node:test`, JSON content packs, `DataManagerV2` enemy-pool expansion, `EnemyActionPlanner`, existing campaign balance simulator.

---

## File Structure

- Modify `NodeConsoleApp2/test/campaign_balance_content.test.mjs`
  - Add WBS-3.4.7 contracts for third-chapter P0 enemy replacement.
  - Assert new enemy templates exist, have chapter-3 role tags, have valid enemy skills, and are used in `level_3_5` through `level_3_8`.
- Modify `NodeConsoleApp2/assets/data/enemies.json`
  - Add `enemy_c3_blood_rite_acolyte`.
  - Add `enemy_c3_mire_chain_jailer`.
  - Add `enemy_c3_twilight_warden`.
  - Add `enemy_c3_plague_standard_bearer`.
- Modify `NodeConsoleApp2/assets/data/skills_enemy_v1.json`
  - Add `enemy_skill_blood_rite_cut`.
  - Add `enemy_skill_mire_chain_drag`.
  - Add `enemy_skill_twilight_warden_bulwark`.
  - Add `enemy_skill_plague_standard_wave`.
- Modify all three level fact-source documents:
  - `NodeConsoleApp2/assets/map_packs/current/story_pack_v1/levels.json`
  - `NodeConsoleApp2/assets/map_packs/authoring/story_pack_v1/levels.json`
  - `NodeConsoleApp2/assets/data/levels.json`
  - Replace primary enemies and enemy-pool members for `level_3_5` through `level_3_8`.
- Modify docs only if implementation differs from the design matrix:
  - `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
  - `NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/26-WBS-3.4-三章关卡敌人与技能平衡.md`

Do not modify these files in this implementation pass:

- `NodeConsoleApp2/assets/data/skills_melee_v4_5.json`
- `NodeConsoleApp2/assets/data/player.json`
- `NodeConsoleApp2/tools/acceptance_click_smoke.mjs`

Player-skill changes require separate evidence that the existing skill tree has no usable counter. This plan only completes the enemy-ecosystem gap identified by WBS-3.4.7.

---

### Task 1: Lock Chapter-Three P0 Replacement Contract

**Files:**
- Modify: `NodeConsoleApp2/test/campaign_balance_content.test.mjs`

- [ ] **Step 1: Write the failing test**

Add this helper near the other helper functions, after `collectStoryLevelEnemyIds()`:

```js
function getPrimaryStoryEnemyByLevel(levelsDocument) {
  const levels = asObject(levelsDocument.levels);
  const enemyPools = asObject(levelsDocument.enemyPools);
  const result = new Map();

  for (const level of Object.values(levels)) {
    if (level?.flow?.kind !== 'story') {
      continue;
    }
    const poolId = level.waves?.[0]?.enemyPoolId;
    const members = Array.isArray(enemyPools[poolId]?.members) ? enemyPools[poolId].members : [];
    const templateId = level.primaryEnemy?.templateId || members[0]?.templateId || '';
    if (templateId) {
      result.set(level.id, templateId);
    }
  }

  return result;
}
```

Add this test after `三章 30 关敌人模板满足 WBS-3.4.2 的数量、角色和字段完整性约束`:

```js
test('WBS-3.4.7 第三章 P0 关卡应使用章节专属敌人替换旧样本补位', async () => {
  const enemies = normalizeEnemies(await readJson('assets/data/enemies.json'));
  const expectedP0Enemies = {
    level_3_5: {
      enemyId: 'enemy_c3_blood_rite_acolyte',
      requiredTags: ['chapter_3', 'role_status', 'pressure_bleed', 'pressure_lifesteal_setup']
    },
    level_3_6: {
      enemyId: 'enemy_c3_mire_chain_jailer',
      requiredTags: ['chapter_3', 'role_armor', 'role_status', 'pressure_slow', 'pressure_armor']
    },
    level_3_7: {
      enemyId: 'enemy_c3_twilight_warden',
      requiredTags: ['chapter_3', 'role_elite', 'role_armor', 'role_repair', 'pressure_armor']
    },
    level_3_8: {
      enemyId: 'enemy_c3_plague_standard_bearer',
      requiredTags: ['chapter_3', 'role_status', 'role_repair', 'pressure_poison', 'pressure_vulnerable']
    }
  };

  const levelDocuments = await Promise.all(levelDocumentPaths.map(async relativePath => ({
    relativePath,
    document: await readJson(relativePath)
  })));
  const runtimePrimaryEnemies = getPrimaryStoryEnemyByLevel(levelDocuments[0].document);

  for (const { relativePath, document } of levelDocuments) {
    const primaryEnemies = getPrimaryStoryEnemyByLevel(document);
    for (const [levelId, expected] of Object.entries(expectedP0Enemies)) {
      assert.equal(
        primaryEnemies.get(levelId),
        expected.enemyId,
        `${relativePath} ${levelId} 应使用 ${expected.enemyId} 替换旧样本补位`
      );
      assert.equal(
        primaryEnemies.get(levelId),
        runtimePrimaryEnemies.get(levelId),
        `${relativePath} ${levelId} 应与 current/story_pack_v1 保持相同 primaryEnemy`
      );
      const enemy = enemies[expected.enemyId];
      assert(enemy, `缺少第三章 P0 敌人模板 ${expected.enemyId}`);
      for (const tag of expected.requiredTags) {
        assert.equal(
          enemy.tags?.includes(tag),
          true,
          `${expected.enemyId} 缺少矩阵职责标签 ${tag}`
        );
      }
      assert.equal(
        /^(enemy|boss)_c3_/u.test(expected.enemyId),
        true,
        `${expected.enemyId} 应使用第三章语义 ID`
      );
    }
  }
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/campaign_balance_content.test.mjs
```

Expected result:

```text
not ok ... WBS-3.4.7 第三章 P0 关卡应使用章节专属敌人替换旧样本补位
```

The failure should mention `level_3_5` still using `skeleton_guard_lvl4` or one of the new `enemy_c3_*` IDs missing. If the test passes before data changes, inspect the test because it is not proving the replacement.

---

### Task 2: Lock New Enemy Skill Pressure Contract

**Files:**
- Modify: `NodeConsoleApp2/test/campaign_balance_content.test.mjs`

- [ ] **Step 1: Write the failing enemy-skill test**

Add this test after the P0 replacement test from Task 1:

```js
test('WBS-3.4.7 第三章新增敌技应映射到压力点和玩家反制方向', async () => {
  const enemySkillMap = getEnemySkillMap(await readJson('assets/data/skills_enemy_v1.json'));
  const enemies = normalizeEnemies(await readJson('assets/data/enemies.json'));
  const expectedEnemySkills = {
    enemy_skill_blood_rite_cut: {
      pressure: ['DMG_HP', 'buff_bleed'],
      users: ['enemy_c3_blood_rite_acolyte'],
      maxAp: 2
    },
    enemy_skill_mire_chain_drag: {
      pressure: ['DMG_ARMOR', 'buff_slow'],
      users: ['enemy_c3_mire_chain_jailer'],
      maxAp: 2
    },
    enemy_skill_twilight_warden_bulwark: {
      pressure: ['ARMOR_ADD'],
      users: ['enemy_c3_twilight_warden'],
      maxAp: 2
    },
    enemy_skill_plague_standard_wave: {
      pressure: ['DMG_HP', 'buff_poison', 'buff_vulnerable'],
      users: ['enemy_c3_plague_standard_bearer'],
      maxAp: 3
    }
  };

  for (const [skillId, expected] of Object.entries(expectedEnemySkills)) {
    const skill = enemySkillMap.get(skillId);
    assert(skill, `缺少第三章新增敌技 ${skillId}`);
    assert.equal(getSkillApCost(skill) <= expected.maxAp, true, `${skillId} AP 成本不应超过 ${expected.maxAp}`);

    const directEffects = (skill.actions || []).map(action => action?.effect?.effectType).filter(Boolean);
    const appliedBuffs = (skill.buffRefs?.apply || []).map(row => row?.buffId).filter(Boolean);
    const pressureTokens = [...directEffects, ...appliedBuffs];
    for (const pressure of expected.pressure) {
      assert.equal(
        pressureTokens.includes(pressure),
        true,
        `${skillId} 缺少压力点 ${pressure}`
      );
    }

    for (const enemyId of expected.users) {
      assert.equal(
        enemies[enemyId]?.skills?.includes(skillId),
        true,
        `${enemyId} 应引用新增敌技 ${skillId}`
      );
    }
  }
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/campaign_balance_content.test.mjs
```

Expected result:

```text
not ok ... WBS-3.4.7 第三章新增敌技应映射到压力点和玩家反制方向
```

The failure should mention `缺少第三章新增敌技 enemy_skill_blood_rite_cut`.

---

### Task 3: Add Four Chapter-Three Enemy Skills

**Files:**
- Modify: `NodeConsoleApp2/assets/data/skills_enemy_v1.json`
- Test: `NodeConsoleApp2/test/campaign_balance_content.test.mjs`

- [ ] **Step 1: Add `enemy_skill_blood_rite_cut`**

Append this skill object inside the top-level `skills` array, before the closing `]`:

```json
{
  "id": "enemy_skill_blood_rite_cut",
  "name": "血礼割痕",
  "rarity": "Uncommon",
  "description": "第三章血礼侍从专用技能，造成轻度生命伤害并叠加流血，作为吸血与续航反制的前置压力。",
  "prerequisites": [],
  "unlock": {
    "cost": { "kp": 0 },
    "requirements": {},
    "exclusives": [],
    "grants": { "type": "enemy" }
  },
  "editorMeta": {
    "x": 3350,
    "y": 240,
    "group": "enemy_twilight",
    "locked": false,
    "editState": "done",
    "hiddenInSkillTree": true
  },
  "speed": 2,
  "target": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART",
    "selection": {
      "mode": "single",
      "candidateParts": ["head", "chest", "abdomen", "arm", "leg"],
      "selectedParts": [],
      "selectCount": 1
    }
  },
  "requirements": {},
  "costs": { "ap": 1, "perTurnLimit": 1 },
  "buffRefs": {
    "apply": [
      { "buffId": "buff_bleed", "target": "enemy", "chance": 0.55, "duration": 2 }
    ],
    "remove": []
  },
  "actions": [
    {
      "id": "action_blood_rite_cut",
      "name": "血礼割痕",
      "target": { "binding": { "mode": "follow", "ref": "skillTarget" } },
      "effect": { "effectType": "DMG_HP", "amountType": "ABS", "amount": 8 }
    }
  ]
}
```

- [ ] **Step 2: Add `enemy_skill_mire_chain_drag`**

Append this skill object inside the `skills` array:

```json
{
  "id": "enemy_skill_mire_chain_drag",
  "name": "泥链拖拽",
  "rarity": "Uncommon",
  "description": "第三章泥链狱卒专用技能，削弱部位护甲并施加减速，检查玩家的补甲与速度管理。",
  "prerequisites": [],
  "unlock": {
    "cost": { "kp": 0 },
    "requirements": {},
    "exclusives": [],
    "grants": { "type": "enemy" }
  },
  "editorMeta": {
    "x": 3490,
    "y": 240,
    "group": "enemy_twilight",
    "locked": false,
    "editState": "done",
    "hiddenInSkillTree": true
  },
  "speed": 1,
  "target": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART",
    "selection": {
      "mode": "single",
      "candidateParts": ["leg", "abdomen", "chest"],
      "selectedParts": [],
      "selectCount": 1
    }
  },
  "requirements": {},
  "costs": { "ap": 2, "perTurnLimit": 1 },
  "buffRefs": {
    "apply": [
      { "buffId": "buff_slow", "target": "enemy", "chance": 0.65, "duration": 2 }
    ],
    "remove": []
  },
  "actions": [
    {
      "id": "action_mire_chain_drag",
      "name": "泥链拖拽",
      "target": { "binding": { "mode": "follow", "ref": "skillTarget" } },
      "effect": { "effectType": "DMG_ARMOR", "amountType": "ABS", "amount": 14 }
    }
  ]
}
```

- [ ] **Step 3: Add `enemy_skill_twilight_warden_bulwark`**

Append this skill object inside the `skills` array:

```json
{
  "id": "enemy_skill_twilight_warden_bulwark",
  "name": "暮卫筑垒",
  "rarity": "Rare",
  "description": "第三章暮色看守专用防御技能，快速补甲并制造高压预演中的破甲检查。",
  "prerequisites": [],
  "unlock": {
    "cost": { "kp": 0 },
    "requirements": {},
    "exclusives": [],
    "grants": { "type": "enemy" }
  },
  "editorMeta": {
    "x": 3630,
    "y": 240,
    "group": "enemy_twilight",
    "locked": false,
    "editState": "done",
    "hiddenInSkillTree": true
  },
  "speed": 4,
  "target": {
    "subject": "SUBJECT_SELF",
    "scope": "SCOPE_PART",
    "selection": {
      "mode": "single",
      "candidateParts": ["head", "chest", "abdomen", "arm", "leg"],
      "selectedParts": [],
      "selectCount": 1
    }
  },
  "requirements": {},
  "costs": { "ap": 1, "perTurnLimit": 1 },
  "buffRefs": {
    "apply": [],
    "remove": []
  },
  "actions": [
    {
      "id": "action_twilight_warden_bulwark",
      "name": "暮卫筑垒",
      "target": { "binding": { "mode": "follow", "ref": "skillTarget" } },
      "effect": { "effectType": "ARMOR_ADD", "amountType": "ABS", "amount": 18 }
    }
  ]
}
```

- [ ] **Step 4: Add `enemy_skill_plague_standard_wave`**

Append this skill object inside the `skills` array:

```json
{
  "id": "enemy_skill_plague_standard_wave",
  "name": "疫旗挥散",
  "rarity": "Rare",
  "description": "第三章疫旗手专用状态技能，造成毒雾伤害并施加中毒与易伤，检查治疗、速杀和状态处理。",
  "prerequisites": [],
  "unlock": {
    "cost": { "kp": 0 },
    "requirements": {},
    "exclusives": [],
    "grants": { "type": "enemy" }
  },
  "editorMeta": {
    "x": 3770,
    "y": 240,
    "group": "enemy_twilight",
    "locked": false,
    "editState": "done",
    "hiddenInSkillTree": true
  },
  "speed": 0,
  "target": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART",
    "selection": {
      "mode": "single",
      "candidateParts": ["head", "chest", "abdomen", "arm", "leg"],
      "selectedParts": [],
      "selectCount": 1
    }
  },
  "requirements": {},
  "costs": { "ap": 2, "perTurnLimit": 1 },
  "buffRefs": {
    "apply": [
      { "buffId": "buff_poison", "target": "enemy", "chance": 0.6, "duration": 2 },
      { "buffId": "buff_vulnerable", "target": "enemy", "chance": 0.45, "duration": 1 }
    ],
    "remove": []
  },
  "actions": [
    {
      "id": "action_plague_standard_wave",
      "name": "疫旗挥散",
      "target": { "binding": { "mode": "follow", "ref": "skillTarget" } },
      "effect": { "effectType": "DMG_HP", "amountType": "ABS", "amount": 9 }
    }
  ]
}
```

- [ ] **Step 5: Run enemy-skill contract and verify partial progress**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/campaign_balance_content.test.mjs
```

Expected result:

```text
not ok ... WBS-3.4.7 第三章新增敌技应映射到压力点和玩家反制方向
```

The failure should now be about new enemies not referencing the new skills, not missing skill IDs.

---

### Task 4: Add Four Chapter-Three Enemy Templates

**Files:**
- Modify: `NodeConsoleApp2/assets/data/enemies.json`
- Test: `NodeConsoleApp2/test/campaign_balance_content.test.mjs`

- [ ] **Step 1: Add `enemy_c3_blood_rite_acolyte`**

Add this property to the top-level enemy object near the other chapter-three enemies:

```json
"enemy_c3_blood_rite_acolyte": {
  "id": "enemy_c3_blood_rite_acolyte",
  "name": "血礼侍从",
  "race": "cultist",
  "class": "acolyte",
  "tags": ["chapter_3", "role_status", "pressure_bleed", "pressure_lifesteal_setup"],
  "description": "第三章中段的流血铺垫敌人，用轻伤和流血提示玩家准备治疗、DOT 反制和吸血窗口。",
  "stats": { "hp": 118, "maxHp": 118, "ap": 4, "speed": 12 },
  "skills": ["enemy_skill_blood_rite_cut", "enemy_skill_rusty_shiv", "enemy_skill_dirty_bandage"],
  "bodyParts": {
    "head": { "current": 8, "max": 8, "weakness": 1.2 },
    "chest": { "current": 18, "max": 18, "weakness": 1 },
    "abdomen": { "current": 14, "max": 14, "weakness": 1.1 },
    "arm": { "current": 10, "max": 10, "weakness": 1 },
    "leg": { "current": 8, "max": 8, "weakness": 1 }
  },
  "dropTable": "drop_twilight_cultist",
  "presentation": {
    "portraitRef": "",
    "mapPortraitRef": "",
    "battleSpriteRef": "../source/character/敌人-003-状态001-正常状态.png",
    "iconRef": ""
  }
}
```

- [ ] **Step 2: Add `enemy_c3_mire_chain_jailer`**

Add this property to `enemies.json`:

```json
"enemy_c3_mire_chain_jailer": {
  "id": "enemy_c3_mire_chain_jailer",
  "name": "泥链狱卒",
  "race": "undead",
  "class": "jailer",
  "tags": ["chapter_3", "role_armor", "role_status", "pressure_slow", "pressure_armor"],
  "description": "第三章节奏压迫敌人，用护甲、破甲和减速检查玩家是否能管理速度与部位防御。",
  "stats": { "hp": 150, "maxHp": 150, "ap": 4, "speed": 8 },
  "skills": ["enemy_skill_mire_chain_drag", "enemy_skill_shield_tap", "enemy_skill_bone_patch"],
  "bodyParts": {
    "head": { "current": 16, "max": 16, "weakness": 1.15 },
    "chest": { "current": 36, "max": 36, "weakness": 0.9 },
    "abdomen": { "current": 24, "max": 24, "weakness": 1.05 },
    "arm": { "current": 24, "max": 24, "weakness": 0.95 },
    "leg": { "current": 22, "max": 22, "weakness": 1 }
  },
  "dropTable": "drop_twilight_armor",
  "presentation": {
    "portraitRef": "",
    "mapPortraitRef": "",
    "battleSpriteRef": "../source/character/敌人-011-状态001-正常状态.png",
    "iconRef": ""
  }
}
```

- [ ] **Step 3: Add `enemy_c3_twilight_warden`**

Add this property to `enemies.json`:

```json
"enemy_c3_twilight_warden": {
  "id": "enemy_c3_twilight_warden",
  "name": "暮色看守",
  "race": "undead",
  "class": "elite_warden",
  "tags": ["chapter_3", "role_elite", "role_armor", "role_repair", "pressure_armor"],
  "description": "第三章 Boss 前高压预演精英，用护甲修复和重压检查破甲、续航与爆发窗口。",
  "stats": { "hp": 188, "maxHp": 188, "ap": 4, "speed": 7 },
  "skills": ["enemy_skill_twilight_warden_bulwark", "enemy_skill_shield_tap", "enemy_skill_twilight_gate_crush"],
  "bodyParts": {
    "head": { "current": 24, "max": 24, "weakness": 1.1 },
    "chest": { "current": 58, "max": 58, "weakness": 0.82 },
    "abdomen": { "current": 36, "max": 36, "weakness": 1.05 },
    "arm": { "current": 42, "max": 42, "weakness": 0.86 },
    "leg": { "current": 32, "max": 32, "weakness": 1 }
  },
  "dropTable": "drop_twilight_armor",
  "presentation": {
    "portraitRef": "",
    "mapPortraitRef": "",
    "battleSpriteRef": "../source/character/敌人-011-状态001-正常状态.png",
    "iconRef": ""
  }
}
```

- [ ] **Step 4: Add `enemy_c3_plague_standard_bearer`**

Add this property to `enemies.json`:

```json
"enemy_c3_plague_standard_bearer": {
  "id": "enemy_c3_plague_standard_bearer",
  "name": "疫旗手",
  "race": "cultist",
  "class": "standard_bearer",
  "tags": ["chapter_3", "role_status", "role_repair", "pressure_poison", "pressure_vulnerable"],
  "description": "第三章外环营垒的状态支援敌人，用毒、易伤和修复能力制造 Boss 前持续损耗。",
  "stats": { "hp": 142, "maxHp": 142, "ap": 4, "speed": 9 },
  "skills": ["enemy_skill_plague_standard_wave", "enemy_skill_plague_mist_burst", "enemy_skill_dirty_bandage"],
  "bodyParts": {
    "head": { "current": 12, "max": 12, "weakness": 1.2 },
    "chest": { "current": 28, "max": 28, "weakness": 1 },
    "abdomen": { "current": 18, "max": 18, "weakness": 1.1 },
    "arm": { "current": 14, "max": 14, "weakness": 1 },
    "leg": { "current": 12, "max": 12, "weakness": 1 }
  },
  "dropTable": "drop_twilight_cultist",
  "presentation": {
    "portraitRef": "",
    "mapPortraitRef": "",
    "battleSpriteRef": "../source/character/敌人-003-状态001-正常状态.png",
    "iconRef": ""
  }
}
```

- [ ] **Step 5: Run content test and verify remaining red**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/campaign_balance_content.test.mjs
```

Expected result:

```text
not ok ... WBS-3.4.7 第三章 P0 关卡应使用章节专属敌人替换旧样本补位
```

The enemy-skill test should now pass. The remaining failure should be that `level_3_5` through `level_3_8` still point at old enemies.

---

### Task 5: Replace Third-Chapter P0 Enemy Pools In All Level Documents

**Files:**
- Modify: `NodeConsoleApp2/assets/map_packs/current/story_pack_v1/levels.json`
- Modify: `NodeConsoleApp2/assets/map_packs/authoring/story_pack_v1/levels.json`
- Modify: `NodeConsoleApp2/assets/data/levels.json`
- Test: `NodeConsoleApp2/test/campaign_balance_content.test.mjs`

- [ ] **Step 1: Replace `level_3_5` in all three level documents**

For each file, update `level_3_5.primaryEnemy.templateId`:

```json
"primaryEnemy": {
  "templateId": "enemy_c3_blood_rite_acolyte"
}
```

For each file, update `enemyPools.pool_level_3_5_primary.members[0].templateId`:

```json
{
  "templateId": "enemy_c3_blood_rite_acolyte",
  "position": "front"
}
```

- [ ] **Step 2: Replace `level_3_6` in all three level documents**

Update `level_3_6.primaryEnemy.templateId`:

```json
"primaryEnemy": {
  "templateId": "enemy_c3_mire_chain_jailer"
}
```

Update `enemyPools.pool_level_3_6_primary.members[0].templateId`:

```json
{
  "templateId": "enemy_c3_mire_chain_jailer",
  "position": "front"
}
```

- [ ] **Step 3: Replace `level_3_7` in all three level documents**

Update `level_3_7.primaryEnemy.templateId`:

```json
"primaryEnemy": {
  "templateId": "enemy_c3_twilight_warden"
}
```

Update `enemyPools.pool_level_3_7_primary.members[0].templateId`:

```json
{
  "templateId": "enemy_c3_twilight_warden",
  "position": "front"
}
```

- [ ] **Step 4: Replace `level_3_8` in all three level documents**

Update `level_3_8.primaryEnemy.templateId`:

```json
"primaryEnemy": {
  "templateId": "enemy_c3_plague_standard_bearer"
}
```

Update `enemyPools.pool_level_3_8_primary.members[0].templateId`:

```json
{
  "templateId": "enemy_c3_plague_standard_bearer",
  "position": "front"
}
```

- [ ] **Step 5: Run content tests and verify green**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/campaign_balance_content.test.mjs
```

Expected result:

```text
# pass 8
# fail 0
```

If the total test count differs because other tests were added, the command must still exit with code `0`.

---

### Task 6: Update Matrix Documentation With Implemented Status

**Files:**
- Modify: `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
- Modify: `NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/26-WBS-3.4-三章关卡敌人与技能平衡.md`

- [ ] **Step 1: Mark third-chapter P0 enemy implementation complete in the matrix doc**

In section `8.1 第三章优先补 4 个敌人`, replace the table with:

```markdown
| 敌人 | 使用位置 | 职责 | 敌技 | 状态 |
| --- | --- | --- | --- | --- |
| `enemy_c3_blood_rite_acolyte` | `level_3_5` | DOT + 吸血前置 | `enemy_skill_blood_rite_cut` | 已落数据 |
| `enemy_c3_mire_chain_jailer` | `level_3_6` | 控制 / 节奏 + 护甲 | `enemy_skill_mire_chain_drag` | 已落数据 |
| `enemy_c3_twilight_warden` | `level_3_7` | 高压预演精英 | `enemy_skill_twilight_warden_bulwark` | 已落数据 |
| `enemy_c3_plague_standard_bearer` | `level_3_8` | 状态 + 防御修复组合 | `enemy_skill_plague_standard_wave` | 已落数据 |
```

- [ ] **Step 2: Update WBS status**

In `WBS-3.4.7 流派-敌人职责-反制矩阵重整`, change:

```markdown
当前状态：`设计矩阵已落文档 / 内容实现待实施`
```

to:

```markdown
当前状态：`设计矩阵已落文档 / 第三章 P0 敌人生态补齐已实施`
```

- [ ] **Step 3: Run diff check**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2
git diff --check
```

Expected result: no output and exit code `0`.

---

### Task 7: Run Full Targeted Verification

**Files:**
- No file edits.

- [ ] **Step 1: Check JSON and script syntax**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --check tools/acceptance_click_smoke.mjs
node -e "JSON.parse(require('fs').readFileSync('assets/data/enemies.json','utf8')); JSON.parse(require('fs').readFileSync('assets/data/skills_enemy_v1.json','utf8')); JSON.parse(require('fs').readFileSync('assets/map_packs/current/story_pack_v1/levels.json','utf8')); JSON.parse(require('fs').readFileSync('assets/map_packs/authoring/story_pack_v1/levels.json','utf8')); JSON.parse(require('fs').readFileSync('assets/data/levels.json','utf8'));"
```

Expected result: both commands exit `0`.

- [ ] **Step 2: Run content and smoke contract tests**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/campaign_balance_content.test.mjs
node --test test/acceptance_click_smoke_contract.test.mjs
```

Expected result: both commands exit `0`.

- [ ] **Step 3: Run simulator tests**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/campaign_balance_simulator.test.mjs
```

Expected result: command exits `0`. If it fails, inspect whether the failure is a genuine design pressure increase or a stale expectation that assumed old sample enemies in chapter three.

- [ ] **Step 4: Generate a fresh diagnostic report without committing it by default**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node tools/campaign_balance_simulator.mjs --report test-results/campaign-balance-report.json
```

Expected result: command exits `0` and writes `test-results/campaign-balance-report.json` plus `test-results/campaign-balance-summary.md`.

If the generated report changes, inspect it. Commit generated reports only if they are intentionally used as evidence for this implementation. Otherwise restore them before commit:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2
git restore -- NodeConsoleApp2/test-results/campaign-balance-report.json NodeConsoleApp2/test-results/campaign-balance-summary.md
```

- [ ] **Step 5: Review final diff**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2
git status --short
git diff --stat
```

Expected changed files:

```text
NodeConsoleApp2/assets/data/enemies.json
NodeConsoleApp2/assets/data/skills_enemy_v1.json
NodeConsoleApp2/assets/map_packs/current/story_pack_v1/levels.json
NodeConsoleApp2/assets/map_packs/authoring/story_pack_v1/levels.json
NodeConsoleApp2/assets/data/levels.json
NodeConsoleApp2/test/campaign_balance_content.test.mjs
NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md
NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/26-WBS-3.4-三章关卡敌人与技能平衡.md
```

Existing uncommitted files from the prior diagnostic-work cleanup may also be present:

```text
NodeConsoleApp2/tools/acceptance_click_smoke.mjs
NodeConsoleApp2/test/acceptance_click_smoke_contract.test.mjs
NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/README.md
NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/README.md
NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md
```

---

### Task 8: Commit The Content Slice

**Files:**
- Commit all intentional files from this implementation slice.

- [ ] **Step 1: Stage intentional files**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2
git add \
  NodeConsoleApp2/assets/data/enemies.json \
  NodeConsoleApp2/assets/data/skills_enemy_v1.json \
  NodeConsoleApp2/assets/map_packs/current/story_pack_v1/levels.json \
  NodeConsoleApp2/assets/map_packs/authoring/story_pack_v1/levels.json \
  NodeConsoleApp2/assets/data/levels.json \
  NodeConsoleApp2/test/campaign_balance_content.test.mjs \
  NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统\(enemy_design\)-设计说明.md \
  NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/26-WBS-3.4-三章关卡敌人与技能平衡.md
```

If the prior diagnostic-work cleanup is intended to be included in the same commit, also stage:

```bash
git add \
  NodeConsoleApp2/tools/acceptance_click_smoke.mjs \
  NodeConsoleApp2/test/acceptance_click_smoke_contract.test.mjs \
  NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/README.md \
  NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/README.md \
  NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统\(enemy_design\)-设计说明.md
```

- [ ] **Step 2: Confirm staged diff**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2
git diff --cached --stat
```

Expected result: staged diff contains content data, content contract tests, and WBS/design docs. It must not contain generated report files unless explicitly chosen in Task 7.

- [ ] **Step 3: Commit**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2
git commit -m "feat: expand chapter three enemy ecosystem"
```

Expected result: commit succeeds.

---

## Self-Review

Spec coverage:

- WBS-3.4.7 requires player-flow, enemy-role, enemy-skill-pressure, and level-rhythm matrices before implementation. This plan consumes the new matrix document and implements its P0 third-chapter enemy recommendations.
- The original user goal requires enemy expansion, enemy skills, difficulty tuning, real testing, and player-skill-tree gap detection. This plan advances enemy expansion and enemy-skill binding, then runs content and simulator diagnostics. It explicitly does not tune player skills without evidence.
- The prior correction requires avoiding overfitting 3-9 / 3-10. This plan does not modify `enemy_skill_twilight_gate_crush`, `enemy_skill_twilight_bastion_swing`, or player skills.

Placeholder scan:

- No `TODO`, `TBD`, or unspecified "add tests" steps remain.
- Every task lists exact files and exact commands.
- Every new ID, enemy skill, enemy template, and target level is named explicitly.

Type consistency:

- New enemy IDs use the `enemy_c3_*` naming rule.
- New enemy skills use the `enemy_skill_*` naming rule.
- New skills use existing schema fields: `unlock`, `editorMeta`, `speed`, `target`, `requirements`, `costs`, `buffRefs`, and `actions`.
- Level documents are updated through existing `primaryEnemy.templateId` and `enemyPools.*.members[].templateId` fields.
