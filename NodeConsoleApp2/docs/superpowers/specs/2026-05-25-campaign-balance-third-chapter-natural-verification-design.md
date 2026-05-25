# Campaign Balance Third Chapter Natural Verification Design

Date: 2026-05-25

Status: pending user review

## Objective

The campaign balance work is no longer in the initial "too few enemies" state. Current repository evidence shows that the first content expansion pass has already produced 30 story levels, 23 enemy templates, 22 story-used enemies, and 32 enemy skills. The next stage should therefore verify the remaining player-facing playability gap instead of adding more enemies by default.

This spec defines the next stage for the campaign balance goal:

1. Bring the formal WBS design and plan documents up to the current verified baseline.
2. Extend the browser low-KP natural progression evidence from the current two-chapter path to all three chapters.
3. Use any third-chapter failure evidence to decide whether to adjust enemy numbers, enemy skills, level enemy pools, browser autoplay strategy, or the player skill tree.
4. Avoid adding player skills or more enemies unless the refreshed evidence proves that the current content cannot support a fair, learnable campaign.

## Current Evidence

Current repository state was audited from these sources:

- `assets/data/levels.json`
- `assets/map_packs/current/story_pack_v1/levels.json`
- `assets/data/enemies.json`
- `assets/data/skills_enemy_v1.json`
- `assets/data/skills_melee_v4_5.json`
- `tools/campaign_balance_simulator.mjs`
- `tools/acceptance_click_smoke.mjs`
- `test/campaign_balance_content.test.mjs`
- `test/campaign_balance_simulator.test.mjs`
- `test/acceptance_click_smoke_contract.test.mjs`

Verified facts:

| Area | Current value |
| --- | ---: |
| Story chapters | 3 |
| Strict story levels | 30 |
| Route variant levels | 6 |
| Independent story enemy pools | 30 |
| Enemy templates | 23 |
| Enemies used by story levels | 22 |
| Enemy skill pack entries | 32 |
| Player skills | 45 |
| Missing story enemy refs | 0 |
| Missing used enemy skill refs | 0 |
| Used enemy AP overspend issues | 0 |

Recent verification:

- `node --test test/campaign_balance_content.test.mjs test/campaign_balance_simulator.test.mjs` passed `23/23`.
- `node --test test/acceptance_click_smoke_contract.test.mjs` passed `2/2`.
- Low-KP progressive simulator with `--initial-skill-points 0` passed `30/30`, with `skillTreeGapCandidates = 0`.
- Browser low-KP natural progression currently targets two chapters through `targetChapterCount = 2`.

## Approach Options

### Option A: Evidence closure first

Update stale documents, extend the browser low-KP natural progression path to chapter 3, and only tune data if the browser run produces actionable failure evidence.

This is the recommended approach because the content quantity and simulator gates already pass. The remaining uncertainty is whether the real browser loop can carry the learned skill tree through the final chapter without hidden UI, planning, or skill-availability problems.

### Option B: Continue expanding enemies first

Add more enemies and enemy skills before extending browser natural progression.

This is not recommended now. The current enemy count already meets the first-pass target, and adding more templates would increase balance noise before the real playability gap is known.

### Option C: Tune third-chapter numbers immediately

Adjust chapter 3 enemies or boss pressure based on simulator summaries before extending browser evidence.

This is also not recommended as the first move. The simulator shows the low-KP progressive path can clear all 30 levels, while fixed recommended builds still fail high-pressure checkpoints. That means the current data is close enough to require browser evidence before tuning.

## Recommended Design

### Scope

In scope:

- Update the formal WBS-3.4 design and plan baseline to match current repository facts.
- Extend `runNaturalProgressiveCampaignSmoke()` from two chapters to three chapters.
- Update the acceptance-click contract so the browser low-KP natural path cannot regress to one or two chapters.
- Run the browser acceptance smoke at 1920x1080 through the existing CDP path.
- If chapter 3 fails, classify the failure before changing data.

Out of scope for this stage:

- New enemy templates.
- New enemy skills.
- New player skills.
- Broad UI redesign.
- Rebalancing levels without a failing or weak-evidence browser result.

### Data and Control Flow

The browser natural progression test should continue to use the real UI path:

1. Start a new game.
2. Override the initial skill tree to `0 KP` and the default starting skills only.
3. Enter each level through the level-select UI or settlement next-level button.
4. Play each battle through planning, skill placement, submit planning, and execute round.
5. Use natural settlement only; do not call `GameEngine.endBattle(true)`.
6. Learn skills from the settlement skill-tree entry according to the explicit progression priority.
7. Continue until `level_3_10` has either naturally won or produced a diagnosable failure.

The expected target list is:

```text
level_1_1 ... level_1_10
level_2_1 ... level_2_10
level_3_1 ... level_3_10
```

### Failure Classification

If the third chapter natural browser path fails, classify it before changing content:

| Failure signal | Preferred response |
| --- | --- |
| No deployable skill while simulator has a valid action | Fix autoplay planning or UI target selection |
| Learned skill missing from battle buttons | Fix skill-tree persistence or battle loadout wiring |
| Player dies with enemy still high HP | Inspect enemy skill pressure and player defensive tools |
| Player times out while healthy | Inspect enemy HP, armor, repair, or target selection |
| Mutual kill counted as loss | Inspect settlement semantics before changing balance |
| Terminal boss wins with no pressure | Increase enemy pressure only after checking browser action mix |
| Recommended learned path lacks a counter | Consider player skill-tree gap only after enemy pressure is confirmed reasonable |

### Player Skill Tree Rule

Do not add or modify player skills during this stage unless all of the following are true:

1. Browser natural progression fails or exposes repeated non-trivial pressure.
2. The failure is not caused by autoplay planning, UI selection, persistence, or an enemy data error.
3. Existing learned skills do not provide a reasonable counter.
4. Adjusting enemy numbers or enemy skill cadence would remove strategic identity more than adding or adjusting a player skill.

Any player skill change must run the existing skill authoring guard and skill runtime tests.

### Acceptance

This design is ready for implementation when the user approves the spec. Implementation should be accepted only when:

1. WBS-3.4 formal documents no longer contain the stale 9-enemy / 3-level baseline as the current state.
2. The acceptance-click contract fixes the natural progression target at three chapters.
3. Browser low-KP natural progression attempts all 30 story levels through real UI actions.
4. The report records skill-tree snapshots, learned skills, combat outcomes, completed levels, unlocked levels, and final state.
5. If all 30 levels pass, no balance data is changed in this stage.
6. If a level fails, the next action is based on the failure classification table above.

## Self-Review

- No unresolved placeholders.
- The scope is intentionally narrower than the full campaign balance objective because content quantity and simulator gates already passed.
- The design preserves the full long-term objective by moving the weakest remaining evidence from simulator-level proof to real browser natural play.
- The design does not redefine final success: complete playability still requires evidence that the campaign is playable, not merely that tests exist.
