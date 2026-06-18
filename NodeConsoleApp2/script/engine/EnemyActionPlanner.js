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

        const decisionPlan = this._selectEnemyDecisionCandidate(candidates, enemy, { enemy, player, playerBodyParts, turnNumber, turnIndex });
        const ranked = decisionPlan?.candidates?.length > 0 ? decisionPlan.candidates : candidates;
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
        if (decisionPlan?.actionNode) {
            out.decisionSource = 'enemyDecision';
            out.decisionNodeId = decisionPlan.actionNode.id;
            out.decisionTargetRule = decisionPlan.actionNode.targetRule || null;
            out.telegraph = Boolean(decisionPlan.actionNode.telegraph);
        }
        return out;
    }

    _selectEnemyDecisionCandidate(candidates, enemy, context = {}) {
        const decision = enemy?.enemyDecision;
        const graph = decision?.graph;
        const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
        const edges = Array.isArray(graph?.edges) ? graph.edges : [];
        if (nodes.length === 0) return null;

        const nodeById = new Map(nodes.filter(node => node?.id).map(node => [node.id, node]));
        const edgesByFrom = new Map();
        edges.forEach((edge) => {
            if (!edge?.from || !edge?.to) return;
            if (!edgesByFrom.has(edge.from)) edgesByFrom.set(edge.from, []);
            edgesByFrom.get(edge.from).push(edge);
        });
        edgesByFrom.forEach(list => {
            list.sort((left, right) => (Number(right.priority ?? 0) || 0) - (Number(left.priority ?? 0) || 0));
        });

        let nodeId = graph.initialStateId || graph.entryNodeId || nodes[0]?.id;
        for (let step = 0; step < 32; step += 1) {
            const node = nodeById.get(nodeId);
            if (!node) return null;

            if (node.type === 'action') {
                const skillId = this._resolveDecisionSkillId(node, decision);
                const candidate = candidates.find(entry => entry.skill?.id === skillId);
                if (!candidate || !this._canPaySkill(candidate.skill, enemy)) return null;
                return {
                    candidates: [this._withDecisionTarget(candidate, node, context)],
                    actionNode: node
                };
            }

            const outgoing = edgesByFrom.get(node.id) || [];
            let edge = null;
            if (node.type === 'branch') {
                const branch = this._decisionConditionMatches(node.condition, enemy, context) ? 'true' : 'false';
                edge = outgoing.find(item => item.branch === branch) || null;
            } else {
                edge = outgoing[0] || null;
            }

            if (edge) {
                nodeId = edge.to;
                continue;
            }
            if (node.fallbackNodeId) {
                nodeId = node.fallbackNodeId;
                continue;
            }
            return null;
        }
        return null;
    }

    _resolveDecisionSkillId(actionNode, decision) {
        const direct = String(actionNode?.skillId || '').trim();
        if (direct) return direct;
        const slotId = String(actionNode?.skillSlotId || '').trim();
        return slotId ? String(decision?.slotBindings?.[slotId] || '').trim() : '';
    }

    _decisionConditionMatches(condition, enemy, { turnNumber, turnIndex, previousActionId } = {}) {
        const source = condition && typeof condition === 'object' ? condition : { type: 'always' };
        if (!source.type || source.type === 'always') return true;

        const hp = Number(enemy?.hp ?? enemy?.stats?.hp ?? 0) || 0;
        const maxHp = Number(enemy?.maxHp ?? enemy?.stats?.maxHp ?? hp) || hp || 1;
        const hpRatio = maxHp > 0 ? hp / maxHp : 1;
        if (source.type === 'self_hp_ratio_lte') return hpRatio <= (Number(source.value) || 0);
        if (source.type === 'self_hp_ratio_gte') return hpRatio >= (Number(source.value) || 0);

        const turnValue = Number.isFinite(Number(turnNumber))
            ? Number(turnNumber)
            : (Number.isFinite(Number(turnIndex)) ? Number(turnIndex) + 1 : 1);
        if (source.type === 'turn_number_modulo') {
            const mod = Math.max(1, Math.trunc(Number(source.mod ?? 1) || 1));
            const equals = Math.trunc(Number(source.equals ?? 0) || 0);
            return (Math.trunc(turnValue) % mod) === equals;
        }
        if (source.type === 'previous_action_is') {
            return String(previousActionId || '').trim() === String(source.actionId || '').trim();
        }
        return false;
    }

    _withDecisionTarget(candidate, actionNode, context) {
        const targetRule = String(actionNode?.targetRule || '').trim();
        if (!targetRule || targetRule === 'player_weak_part') return candidate;

        const next = { ...candidate, target: { ...candidate.target } };
        if (targetRule === 'self') {
            next.target = { targetId: context.enemy?.id, bodyPart: null };
        } else if (targetRule === 'player') {
            next.target = { targetId: context.player?.id, bodyPart: null };
        } else if (targetRule.startsWith('fixed_part:')) {
            next.target = {
                targetId: context.player?.id,
                bodyPart: targetRule.slice('fixed_part:'.length) || null
            };
        }
        return next;
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
