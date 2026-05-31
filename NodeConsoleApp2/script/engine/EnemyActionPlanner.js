export default class EnemyActionPlanner {
    constructor({ getSkillConfig }) {
        this._getSkillConfig = getSkillConfig;
    }

    planTurn({ enemy, player, playerBodyParts, turnNumber, turnIndex } = {}) {
        if (!enemy || !player) return null;

        const skills = Array.isArray(enemy.skills) ? enemy.skills : [];
        const candidates = skills
            .map(skillId => this._getSkillConfig ? this._getSkillConfig(skillId) : null)
            .filter(Boolean)
            .map(skill => {
                const summary = this._summarizeSkill(skill);
                return {
                    skill,
                    summary,
                    target: this._pickTarget(skill, { enemy, player, playerBodyParts }),
                    score: this._scoreSkill(skill, { enemy, player, playerBodyParts })
                };
            })
            .filter(entry => entry.target && entry.target.targetId);

        if (candidates.length === 0) return null;

        const intentPlan = this._selectIntentCandidates(candidates, enemy, { turnNumber, turnIndex });
        const ranked = intentPlan.candidates.length > 0 ? intentPlan.candidates : candidates;
        ranked.sort((a, b) => b.score - a.score);
        const best = ranked[0];
        const cost = Number(best.skill?.costs?.ap ?? 0) || 0;
        const baseSpeed = Number(enemy?.speed ?? enemy?.stats?.speed ?? 0) || 0;
        const skillSpeed = Number(best.skill?.speed ?? 0) || 0;

        const out = {
            source: 'ENEMY',
            sourceId: enemy.id,
            skillId: best.skill.id,
            skillName: best.skill.name || best.skill.id,
            targetId: best.target.targetId,
            bodyPart: best.target.bodyPart,
            cost,
            speed: baseSpeed + skillSpeed
        };
        if (intentPlan.intent) {
            out.intentToken = intentPlan.selectedToken || intentPlan.intent.token;
            out.intentSource = intentPlan.source;
            out.intentIndex = intentPlan.intent.index;
            out.intentPatternLength = intentPlan.intent.patternLength;
        }
        return out;
    }

    _selectIntentCandidates(candidates, enemy, { turnNumber, turnIndex } = {}) {
        const intent = this._resolveIntent(enemy, { turnNumber, turnIndex });
        if (!intent) {
            return { intent: null, candidates: [], selectedToken: null, source: null };
        }

        const preferred = this._filterCandidatesByIntent(candidates, intent.token, enemy);
        if (preferred.length > 0) {
            return { intent, candidates: preferred, selectedToken: intent.token, source: 'pattern' };
        }

        const fallbackToken = this._normalizeIntentToken(intent.fallback);
        if (fallbackToken && fallbackToken !== intent.token) {
            const fallback = this._filterCandidatesByIntent(candidates, fallbackToken, enemy);
            if (fallback.length > 0) {
                return { intent, candidates: fallback, selectedToken: fallbackToken, source: 'fallback' };
            }
        }

        return { intent, candidates: [], selectedToken: null, source: 'score' };
    }

    _resolveIntent(enemy, { turnNumber, turnIndex } = {}) {
        const model = enemy?.intentModel;
        const pattern = Array.isArray(model?.pattern)
            ? model.pattern.map(token => this._normalizeIntentToken(token)).filter(Boolean)
            : [];
        if (pattern.length === 0) return null;

        const providedIndex = Number.isFinite(Number(turnIndex))
            ? Number(turnIndex)
            : (Number.isFinite(Number(turnNumber)) ? Number(turnNumber) - 1 : 0);
        const index = ((Math.trunc(providedIndex) % pattern.length) + pattern.length) % pattern.length;
        return {
            token: pattern[index],
            fallback: model?.fallback,
            index,
            patternLength: pattern.length
        };
    }

    _filterCandidatesByIntent(candidates, token, enemy) {
        const normalized = this._normalizeIntentToken(token);
        if (!normalized) return [];

        const affordable = candidates.filter(entry => this._canPaySkill(entry.skill, enemy));
        const pool = affordable.length > 0 ? affordable : candidates;
        return pool.filter(entry => this._skillMatchesIntent(entry.skill, normalized, entry.summary));
    }

    _normalizeIntentToken(token) {
        return String(token || '').trim().toLowerCase();
    }

    _canPaySkill(skill, enemy) {
        const cost = Number(skill?.costs?.ap ?? 0) || 0;
        const ap = Number(enemy?.stats?.ap ?? enemy?.ap ?? 0) || 0;
        return cost <= ap;
    }

    _skillMatchesIntent(skill, token, summary = this._summarizeSkill(skill)) {
        if (!skill || !token) return false;

        const explicitTags = [
            ...(Array.isArray(skill.intentTags) ? skill.intentTags : []),
            ...(Array.isArray(skill.aiTags) ? skill.aiTags : []),
            ...(Array.isArray(skill.tags) ? skill.tags : []),
            ...(Array.isArray(skill.editorMeta?.intentTags) ? skill.editorMeta.intentTags : [])
        ].map(tag => this._normalizeIntentToken(tag));
        if (explicitTags.includes(token)) return true;

        const buffIds = (skill?.buffRefs?.apply || []).map(row => this._normalizeIntentToken(row?.buffId));
        const targetSubject = skill?.target?.subject;
        const isEnemyTarget = targetSubject !== 'SUBJECT_SELF';
        const isSelfTarget = targetSubject === 'SUBJECT_SELF';
        const cost = Number(skill?.costs?.ap ?? 0) || 0;

        switch (token) {
        case 'attack':
        case 'pressure':
        case 'punish':
        case 'cash_out':
        case 'terminal':
            return isEnemyTarget && (summary.damageHp > 0 || summary.damageArmor > 0);
        case 'heavy_attack':
        case 'burst':
            return isEnemyTarget && (summary.damageHp >= 20 || (cost >= 3 && summary.damageHp > 0));
        case 'armor_attack':
        case 'break':
            return isEnemyTarget && summary.damageArmor > 0;
        case 'bleed':
            return buffIds.includes('buff_bleed');
        case 'poison':
            return buffIds.includes('buff_poison');
        case 'slow':
            return buffIds.includes('buff_slow');
        case 'vulnerable':
        case 'mark':
        case 'exposed':
            return buffIds.includes('buff_vulnerable');
        case 'stun':
        case 'control':
        case 'control_phase':
        case 'bind':
            return buffIds.includes('buff_stun') || buffIds.includes('buff_slow');
        case 'lifesteal':
        case 'stance':
        case 'setup':
            return isSelfTarget && summary.buffRefsSelf > 0;
        case 'recover':
        case 'heal':
            return isSelfTarget && summary.healHp > 0;
        case 'repair':
        case 'guard':
        case 'armor_phase':
            return isSelfTarget && summary.addArmor > 0;
        default:
            return explicitTags.includes(token);
        }
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
            score += summary.buffRefsSelf * 12;
            score += this._scoreSelfProtection(skill, enemy, { hpRatio });
            if (hpRatio <= 0.35) score += 25;
            if (hpRatio <= 0.2) score += 15;
            score -= this._scoreRepeatedSelfBuffPenalty(skill, enemy);
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
                if (summary.damageHp > 0 && summary.damageHp > armorCurrent) {
                    const piercingDamage = Math.max(0, Math.floor(summary.damageHp * weakness) - armorCurrent);
                    score += piercingDamage * 3.0;
                    if ((player?.stats?.hp ?? player?.hp ?? 0) > 0 && piercingDamage > 0) {
                        score += 18;
                    }
                }
                if (summary.damageArmor > 0 && summary.damageHp <= 0 && armorCurrent <= summary.damageArmor) {
                    score -= 18;
                }
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

    _scoreRepeatedSelfBuffPenalty(skill, enemy) {
        const rows = Array.isArray(skill?.buffRefs?.apply) ? skill.buffRefs.apply : [];
        let penalty = 0;
        for (const row of rows) {
            if (row?.target !== 'self' || !row?.buffId) continue;
            const hasBuff = typeof enemy?.buffs?.has === 'function'
                ? enemy.buffs.has(row.buffId)
                : false;
            const stacks = typeof enemy?.buffs?.getStacks === 'function'
                ? enemy.buffs.getStacks(row.buffId)
                : 0;
            if (hasBuff || stacks > 0) {
                penalty += 110;
            }
        }
        return penalty;
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

    _scoreSelfProtection(skill, enemy, { hpRatio = 1 } = {}) {
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

        const repairMultiplier = hpRatio >= 0.75 ? 0.75 : 1.8;
        let score = missingArmor * repairMultiplier;
        score += missingRatio * 30;

        if (missingRatio >= 0.5) score += hpRatio >= 0.75 ? 8 : 25;
        if (currentArmor <= 0) score += hpRatio >= 0.75 ? 6 : 20;
        if (hpRatio >= 0.75) score = Math.min(score, 55);

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
