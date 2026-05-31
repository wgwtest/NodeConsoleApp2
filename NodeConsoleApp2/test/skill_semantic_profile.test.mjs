import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSemanticProfileIndex,
  summarizeLoopRoleMetrics,
  validateSemanticProfiles
} from '../script/editor/skill_tester/skillSemanticProfileModel.mjs';

function makeSkillPack() {
  return {
    skills: [
      {
        id: 'skill_apply',
        name: '浅割',
        semanticProfile: {
          profileVersion: 1,
          roleTags: { primary: 'Skill.Bleed.Apply', secondary: ['Skill.Attack.BasicArmor'] },
          mechanicTags: ['Bleed.Window.Create'],
          relationProfile: { alternativeTo: ['skill_extend'], synergyWith: ['skill_read'] },
          decisionProfile: { preferredWhen: '需要建窗。', avoidWhen: '目标已有长窗口。', differentiation: '建窗起手。' }
        },
        buffRefs: { apply: [{ buffId: 'buff_bleed', target: 'enemy', duration: 2 }] }
      },
      {
        id: 'skill_extend',
        name: '锯齿斩',
        semanticProfile: {
          profileVersion: 1,
          roleTags: { primary: 'Skill.Bleed.Extend', secondary: ['Skill.Attack.BasicArmor'] },
          mechanicTags: ['Bleed.Window.Extend'],
          relationProfile: { alternativeTo: ['skill_apply'], synergyWith: ['skill_read'] },
          decisionProfile: { preferredWhen: '需要维持窗口。', avoidWhen: '目标没有窗口。', differentiation: '延长窗口。' }
        },
        buffRefs: { apply: [{ buffId: 'buff_bleed', target: 'enemy', duration: 3 }] }
      },
      {
        id: 'skill_read',
        name: '深切',
        semanticProfile: {
          profileVersion: 1,
          roleTags: { primary: 'Skill.Bleed.Read', secondary: [] },
          mechanicTags: ['Bleed.Window.Read'],
          relationProfile: { synergyWith: ['skill_apply', 'skill_extend'] },
          decisionProfile: { preferredWhen: '目标已有窗口。', avoidWhen: '目标没有窗口。', differentiation: '读取窗口兑现。' }
        },
        actions: [{ effect: { amountType: 'BUFF_REMAINING', buffId: 'buff_bleed' } }]
      },
      {
        id: 'skill_bad',
        name: '错误标签',
        semanticProfile: {
          profileVersion: 1,
          roleTags: { primary: 'Skill.Bleed.Apply', secondary: [] },
          mechanicTags: ['Bleed.Window.Create'],
          relationProfile: { alternativeTo: ['missing_skill'] },
          decisionProfile: { preferredWhen: '', avoidWhen: '', differentiation: '' }
        },
        buffRefs: {}
      },
      {
        id: 'skill_unprofiled',
        name: '未标注技能'
      }
    ]
  };
}

test('buildSemanticProfileIndex exposes role and relation metadata without using runtime fields as tags', () => {
  const index = buildSemanticProfileIndex(makeSkillPack());

  assert.equal(index.profiledSkillCount, 4);
  assert.equal(index.unprofiledSkillCount, 1);
  assert.equal(index.getPrimaryRole('skill_apply'), 'Skill.Bleed.Apply');
  assert.equal(index.getPrimaryRole('skill_unprofiled'), 'Skill.Unprofiled');
  assert.deepEqual(index.getRoleTags('skill_extend'), ['Skill.Bleed.Extend', 'Skill.Attack.BasicArmor']);
  assert.deepEqual(index.getRelations('skill_apply').alternativeTo, ['skill_extend']);
});

test('validateSemanticProfiles reports missing profiles, invalid references, and obvious tag-mechanic contradictions', () => {
  const warnings = validateSemanticProfiles(makeSkillPack());

  assert.ok(warnings.some(item => item.skillId === 'skill_unprofiled' && item.code === 'missing_semantic_profile'));
  assert.ok(warnings.some(item => item.skillId === 'skill_bad' && item.code === 'missing_relation_target'));
  assert.ok(warnings.some(item => item.skillId === 'skill_bad' && item.code === 'bleed_apply_without_bleed_write'));
  assert.ok(warnings.some(item => item.skillId === 'skill_bad' && item.code === 'empty_decision_profile'));
});

test('summarizeLoopRoleMetrics separates role diversity from raw skill-count diversity', () => {
  const index = buildSemanticProfileIndex(makeSkillPack());
  const levels = [
    { nodeLabel: '1-1', best: { loopSkillIds: ['skill_apply', 'skill_extend', 'skill_read'] } },
    { nodeLabel: '1-2', best: { loopSkillIds: ['skill_apply', 'skill_extend'] } },
    { nodeLabel: '1-3', best: { loopSkillIds: ['skill_unprofiled'] } }
  ];

  const metrics = summarizeLoopRoleMetrics(levels, index);

  assert.equal(metrics.averagePrimaryRoleCount, 2);
  assert.equal(metrics.lowRoleLoopCount, 1);
  assert.equal(metrics.unprofiledLoopCount, 1);
  assert.equal(metrics.dominantRoleLoop.signature, 'Skill.Bleed.Apply > Skill.Bleed.Extend');
  assert.equal(metrics.dominantRoleLoop.count, 1);
});
