export default class EnemyActionPlanner {
    constructor({ getSkillConfig }) {
        this._getSkillConfig = getSkillConfig;
    }

    planTurn({ enemy, player, playerBodyParts }) {
        if (!enemy || !player) return null;

        const skills = Array.isArray(enemy.skills) ? enemy.skills : [];
        const candidates = skills
            .map(skillId => this._getSkillConfig ? this._getSkillConfig(skillId) : null)
            .filter(Boolean)
            .map(skill => ({
                skill,
                target: this._pickTarget(skill, { enemy, player, playerBodyParts }),
                score: this._scoreSkill(skill, { enemy, player, playerBodyParts })
            }))
            .filter(entry => entry.target && entry.target.targetId);

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        const cost = Number(best.skill?.costs?.ap ?? 0) || 0;
        const baseSpeed = Number(enemy?.speed ?? enemy?.stats?.speed ?? 0) || 0;
        const skillSpeed = Number(best.skill?.speed ?? 0) || 0;

        return {
            source: 'ENEMY',
            sourceId: enemy.id,
            skillId: best.skill.id,
            targetId: best.target.targetId,
            bodyPart: best.target.bodyPart,
            cost,
            speed: baseSpeed + skillSpeed
        };
    }

    _pickTarget(skill, context) {
        const subject = skill?.target?.subject;
        const scope = skill?.target?.scope;

        if (subject === 'SUBJECT_SELF') {
            return {
                targetId: context.enemy.id,
                bodyPart: scope === 'SCOPE_PART'
                    ? this._pickMostDamagedPart(context.enemy.bodyParts, this._getCandidateParts(skill, context.enemy.bodyParts))
                    : null
            };
        }

        if (subject === 'SUBJECT_ENEMY') {
            return {
                targetId: context.player.id,
                bodyPart: scope === 'SCOPE_PART'
                    ? this._pickPlayerWeakPoint(context.playerBodyParts || context.player.bodyParts, this._getCandidateParts(skill, context.playerBodyParts || context.player.bodyParts))
                    : null
            };
        }

        return {
            targetId: context.player.id,
            bodyPart: scope === 'SCOPE_PART'
                ? this._pickPlayerWeakPoint(context.playerBodyParts || context.player.bodyParts, this._getCandidateParts(skill, context.playerBodyParts || context.player.bodyParts))
                : null
        };
    }

    _scoreSkill(skill, { enemy, player, playerBodyParts }) {
        const summary = this._summarizeSkill(skill);
        const hp = Number(enemy?.hp ?? enemy?.stats?.hp ?? 0) || 0;
        const maxHp = Number(enemy?.maxHp ?? enemy?.stats?.maxHp ?? hp) || hp || 1;
        const hpRatio = maxHp > 0 ? hp / maxHp : 1;

        let score = 0;
        if (skill?.target?.subject === 'SUBJECT_SELF') {
            score += summary.healHp * (1.8 - hpRatio);
            score += summary.addArmor * (1.4 - hpRatio);
            score += summary.buffRefsSelf * 18;
            score += this._scoreSelfProtection(skill, enemy);
            if (hpRatio <= 0.45) score += 35;
            if (hpRatio <= 0.3) score += 18;
        } else {
            score += summary.damageHp * 2.0;
            score += summary.damageArmor * 1.2;
            score += summary.buffRefsEnemy * 20;

            const chosenPart = this._pickPlayerWeakPoint(playerBodyParts || player?.bodyParts, this._getCandidateParts(skill, playerBodyParts || player?.bodyParts));
            const part = chosenPart ? (playerBodyParts || player?.bodyParts || {})[chosenPart] : null;
            if (part) {
                const weakness = Number(part.weakness ?? 1) || 1;
                const armorCurrent = Number(part.current ?? 0) || 0;
                score += weakness * 10;
                if (armorCurrent <= 0) score += 14;
                score += this._scoreFocusedPartPressure(skill, summary, {
                    chosenPart,
                    part,
                    candidateParts: this._getCandidateParts(skill, playerBodyParts || player?.bodyParts)
                });
            }

            const playerHp = Number(player?.stats?.hp ?? player?.hp ?? 0) || 0;
            const playerMaxHp = Number(player?.stats?.maxHp ?? player?.maxHp ?? playerHp) || playerHp || 1;
            if (playerMaxHp > 0 && (playerHp / playerMaxHp) <= 0.35) {
                score += summary.damageHp > 0 ? 30 : 0;
            }
        }

        const cost = Number(skill?.costs?.ap ?? 0) || 0;
        const ap = Number(enemy?.stats?.ap ?? enemy?.ap ?? 0) || 0;
        if (cost > ap) score -= 1000;

        return score;
    }

    _scoreFocusedPartPressure(skill, summary, { chosenPart, part, candidateParts }) {
        if (!part) return 0;
        if (!Array.isArray(candidateParts) || candidateParts.length !== 1) return 0;
        if (candidateParts[0] !== chosenPart) return 0;

        const weakness = Number(part.weakness ?? 1) || 1;
        const armorCurrent = Number(part.current ?? 0) || 0;
        let score = 0;

        if (summary.damageArmor > 0 && armorCurrent > 0) {
            score += Math.min(armorCurrent, summary.damageArmor) * (0.8 + weakness * 0.4);
        }

        if (summary.damageHp > 0 && armorCurrent <= 0) {
            score += weakness * 10;
        }

        if (skill?.target?.selection?.selectedParts?.length === 1) {
            score += weakness * 4;
        }

        return score;
    }

    _scoreSelfProtection(skill, enemy) {
        const bodyParts = enemy?.bodyParts;
        if (!bodyParts || typeof bodyParts !== 'object') return 0;

        const candidateParts = this._getCandidateParts(skill, bodyParts);
        const chosenPart = this._pickMostDamagedPart(bodyParts, candidateParts);
        const part = chosenPart ? bodyParts[chosenPart] : null;
        if (!part) return 0;

        const maxArmor = Number(part.max ?? 0) || 0;
        const currentArmor = Number(part.current ?? 0) || 0;
        if (maxArmor <= 0) return 0;

        const missingArmor = Math.max(0, maxArmor - currentArmor);
        const missingRatio = missingArmor / maxArmor;

        let score = missingArmor * 1.8;
        score += missingRatio * 30;

        if (missingRatio >= 0.5) score += 25;
        if (currentArmor <= 0) score += 20;

        return score;
    }

    _summarizeSkill(skill) {
        const summary = {
            damageHp: 0,
            damageArmor: 0,
            healHp: 0,
            addArmor: 0,
            buffRefsSelf: 0,
            buffRefsEnemy: 0
        };

        for (const action of (skill?.actions || [])) {
            const effect = action?.effect || {};
            const amount = Number(effect.amount ?? 0) || 0;
            switch (effect.effectType) {
            case 'DMG_HP':
                summary.damageHp += amount || 10;
                break;
            case 'DMG_ARMOR':
                summary.damageArmor += amount || 10;
                break;
            case 'HEAL':
                summary.healHp += amount || 10;
                break;
            case 'ARMOR_ADD':
                summary.addArmor += amount || 10;
                break;
            default:
                break;
            }
        }

        for (const row of (skill?.buffRefs?.apply || [])) {
            if (row?.target === 'self') summary.buffRefsSelf += 1;
            else summary.buffRefsEnemy += 1;
        }

        return summary;
    }

    _getCandidateParts(skill, bodyParts) {
        const fromSkill = Array.isArray(skill?.target?.selection?.candidateParts)
            ? skill.target.selection.candidateParts
            : [];
        if (fromSkill.length > 0) return fromSkill;
        return bodyParts ? Object.keys(bodyParts) : [];
    }

    _pickPlayerWeakPoint(bodyParts, candidateParts) {
        if (!bodyParts) return null;
        const parts = (candidateParts || [])
            .map(part => ({ part, data: bodyParts[part] }))
            .filter(entry => entry.data);

        if (parts.length === 0) return null;

        parts.sort((a, b) => {
            const armorA = Number(a.data.current ?? 0) || 0;
            const armorB = Number(b.data.current ?? 0) || 0;
            if (armorA !== armorB) return armorA - armorB;

            const weakA = Number(a.data.weakness ?? 1) || 1;
            const weakB = Number(b.data.weakness ?? 1) || 1;
            return weakB - weakA;
        });

        return parts[0].part;
    }

    _pickMostDamagedPart(bodyParts, candidateParts) {
        if (!bodyParts) return null;
        const parts = (candidateParts || [])
            .map(part => ({ part, data: bodyParts[part] }))
            .filter(entry => entry.data);

        if (parts.length === 0) return null;

        parts.sort((a, b) => {
            const damageA = (Number(a.data.max ?? 0) || 0) - (Number(a.data.current ?? 0) || 0);
            const damageB = (Number(b.data.max ?? 0) || 0) - (Number(b.data.current ?? 0) || 0);
            return damageB - damageA;
        });

        return parts[0].part;
    }
}
