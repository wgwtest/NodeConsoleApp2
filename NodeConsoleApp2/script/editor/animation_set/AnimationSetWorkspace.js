function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeString(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toFiniteNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function normalizeBoolean(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeOffset(value) {
    const source = asObject(value);
    return {
        x: toFiniteNumber(source.x, 0),
        y: toFiniteNumber(source.y, 0)
    };
}

function normalizeClip(key, value = {}) {
    const source = asObject(value);
    const normalizedKey = normalizeString(source.key, key);
    const sheetRef = normalizeString(source.sheetRef, '');
    const sourceDir = normalizeString(source.sourceDir, '');
    const explicitStatus = normalizeString(source.status, '');
    const inferredStatus = sheetRef ? 'ready' : sourceDir ? 'planned' : 'missing';
    return {
        ...clone(source),
        key: normalizedKey,
        sourceDir,
        sheetRef,
        manifestRef: normalizeString(source.manifestRef, ''),
        frameWidth: toFiniteNumber(source.frameWidth, 0),
        frameHeight: toFiniteNumber(source.frameHeight, 0),
        columns: toFiniteNumber(source.columns ?? source.sheetColumns, 0),
        rows: toFiniteNumber(source.rows ?? source.sheetRows, 0),
        frameCount: toFiniteNumber(source.frameCount, 0),
        fps: toFiniteNumber(source.fps, 12),
        loop: normalizeBoolean(source.loop, false),
        returnTo: source.returnTo === null ? null : normalizeString(source.returnTo, ''),
        scale: toFiniteNumber(source.scale, 1),
        offset: normalizeOffset(source.offset),
        status: explicitStatus || inferredStatus
    };
}

function normalizeClips(value) {
    const source = asObject(value);
    const result = {};
    Object.entries(source).forEach(([key, clip]) => {
        const normalized = normalizeClip(key, clip);
        if (normalized.key) result[normalized.key] = normalized;
    });
    return result;
}

function deriveStatusFromClips(clips) {
    const statuses = Object.values(clips).map(clip => clip.status);
    if (statuses.some(status => status === 'error')) return 'error';
    if (statuses.some(status => status === 'missing' || status === 'planned' || status === 'warning')) return 'warning';
    return 'ready';
}

function normalizeAnimationSet(value = {}) {
    const source = asObject(value);
    const clips = normalizeClips(source.clips);
    const id = normalizeString(source.id, '');
    const defaultAnimation = normalizeString(source.defaultAnimation, Object.keys(clips)[0] || '');
    return {
        ...clone(source),
        id,
        ownerType: normalizeString(source.ownerType, 'unknown'),
        ownerId: normalizeString(source.ownerId, ''),
        displayName: normalizeString(source.displayName, id),
        defaultAnimation,
        status: normalizeString(source.status, '') || deriveStatusFromClips(clips),
        clips,
        references: asArray(source.references).map(reference => clone(reference)),
        updatedAt: normalizeString(source.updatedAt, '')
    };
}

function clipMatchesQuery(clip, query) {
    if (!query) return true;
    const haystack = [
        clip.key,
        clip.sourceDir,
        clip.sheetRef,
        clip.manifestRef,
        clip.status,
        clip.returnTo
    ].join(' ').toLowerCase();
    return haystack.includes(query);
}

function setMatchesQuery(animationSet, query) {
    if (!query) return true;
    const haystack = [
        animationSet.id,
        animationSet.ownerType,
        animationSet.ownerId,
        animationSet.displayName,
        animationSet.defaultAnimation,
        animationSet.status
    ].join(' ').toLowerCase();
    return haystack.includes(query) || Object.values(animationSet.clips).some(clip => clipMatchesQuery(clip, query));
}

function ownerSortKey(owner) {
    const order = { player: 1, enemy: 2, ally: 3, effect: 4, unknown: 9 };
    return `${order[owner.ownerType] || 8}:${owner.ownerType}:${owner.ownerId}`;
}

export class AnimationSetWorkspace {
    constructor(document = {}) {
        const source = asObject(document);
        this.schemaVersion = toFiniteNumber(source.schemaVersion, 1);
        this.meta = asObject(source.meta);
        this.animationSets = asArray(source.animationSets)
            .map(normalizeAnimationSet)
            .filter(animationSet => animationSet.id);
    }

    listAnimationSets(filter = {}) {
        const ownerType = normalizeString(filter.ownerType, '');
        const status = normalizeString(filter.status, '');
        const query = normalizeString(filter.query, '').toLowerCase();
        return this.animationSets.filter((animationSet) => {
            if (ownerType && animationSet.ownerType !== ownerType) return false;
            if (status && animationSet.status !== status) return false;
            return setMatchesQuery(animationSet, query);
        });
    }

    getAnimationSet(animationSetId) {
        const id = normalizeString(animationSetId, '');
        return this.animationSets.find(animationSet => animationSet.id === id) || null;
    }

    findByOwner(ownerType, ownerId) {
        const normalizedType = normalizeString(ownerType, '');
        const normalizedId = normalizeString(ownerId, '');
        return this.animationSets.filter(animationSet => (
            animationSet.ownerType === normalizedType && animationSet.ownerId === normalizedId
        ));
    }

    findPrimarySetForOwner(ownerType, ownerId) {
        const sets = this.findByOwner(ownerType, ownerId);
        return sets.find(set => set.id.endsWith('_default')) || sets[0] || null;
    }

    listOwners(filter = {}) {
        const ownerType = normalizeString(filter.ownerType, '');
        const status = normalizeString(filter.status, '');
        const query = normalizeString(filter.query, '').toLowerCase();
        const groups = new Map();
        this.animationSets.forEach((animationSet) => {
            const key = `${animationSet.ownerType}:${animationSet.ownerId}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    ownerType: animationSet.ownerType,
                    ownerId: animationSet.ownerId,
                    displayName: animationSet.displayName,
                    animationSets: []
                });
            }
            groups.get(key).animationSets.push(animationSet);
        });
        return Array.from(groups.values())
            .map(owner => this.buildOwnerSummary(owner.ownerType, owner.ownerId, owner.animationSets, owner.displayName))
            .filter((owner) => {
                if (ownerType && owner.ownerType !== ownerType) return false;
                if (status && owner.status !== status) return false;
                if (!query) return true;
                return [
                    owner.ownerType,
                    owner.ownerId,
                    owner.displayName,
                    owner.status,
                    ...owner.animationSets.map(set => `${set.id} ${set.defaultAnimation}`),
                    ...owner.animationSets.flatMap(set => Object.values(set.clips).map(clip => `${clip.key} ${clip.sourceDir}`))
                ].join(' ').toLowerCase().includes(query);
            })
            .sort((left, right) => ownerSortKey(left).localeCompare(ownerSortKey(right)));
    }

    buildOwnerSummary(ownerType, ownerId, sets, displayName = '') {
        const allClips = sets.flatMap(set => Object.values(set.clips));
        const issues = sets.flatMap(set => this.validateAnimationSet(set.id)).filter(issue => issue.severity !== 'ok');
        const status = sets.some(set => set.status === 'error')
            ? 'error'
            : sets.some(set => set.status !== 'ready') || issues.length
                ? 'warning'
                : 'ready';
        return {
            ownerType,
            ownerId,
            displayName: normalizeString(displayName, ownerId),
            setCount: sets.length,
            clipCount: allClips.length,
            readyClipCount: allClips.filter(clip => clip.status === 'ready').length,
            issueCount: issues.length,
            status,
            animationSets: sets
        };
    }

    getOwnerSummary(ownerType, ownerId) {
        const sets = this.findByOwner(ownerType, ownerId);
        if (!sets.length) return null;
        return this.buildOwnerSummary(ownerType, ownerId, sets, sets[0].displayName);
    }

    addClipToOwner(ownerType, ownerId, clipDraft = {}) {
        const normalizedType = normalizeString(ownerType, '');
        const normalizedId = normalizeString(ownerId, '');
        if (!normalizedType || !normalizedId) throw new Error('必须先选择对象。');
        let animationSet = this.findPrimarySetForOwner(normalizedType, normalizedId);
        if (!animationSet) {
            animationSet = normalizeAnimationSet({
                id: `${normalizedId}_default`,
                ownerType: normalizedType,
                ownerId: normalizedId,
                displayName: normalizedId,
                defaultAnimation: normalizeString(clipDraft.key, ''),
                status: 'warning',
                clips: {},
                references: []
            });
            this.animationSets.push(animationSet);
        }
        const key = normalizeString(clipDraft.key, '');
        if (!key) throw new Error('clip key 不能为空。');
        const clip = normalizeClip(key, {
            ...animationSet.clips[key],
            ...clipDraft,
            key,
            status: normalizeString(clipDraft.status, '') || normalizeString(animationSet.clips[key]?.status, '') || 'planned'
        });
        animationSet.clips[key] = clip;
        if (!animationSet.defaultAnimation) animationSet.defaultAnimation = key;
        animationSet.status = deriveStatusFromClips(animationSet.clips);
        return clip;
    }

    allocateOwnerId(ownerType) {
        const normalizedType = normalizeString(ownerType, '');
        if (!normalizedType) throw new Error('对象类型不能为空。');
        const prefix = `${normalizedType}_`;
        const maxIndex = this.animationSets.reduce((max, animationSet) => {
            if (animationSet.ownerType !== normalizedType) return max;
            if (!animationSet.ownerId.startsWith(prefix)) return max;
            const suffix = animationSet.ownerId.slice(prefix.length);
            if (!/^\d+$/.test(suffix)) return max;
            return Math.max(max, Number(suffix) || 0);
        }, 0);
        return `${normalizedType}_${String(maxIndex + 1).padStart(3, '0')}`;
    }

    createOwner(ownerDraft = {}) {
        const ownerType = normalizeString(ownerDraft.ownerType, '');
        const displayName = normalizeString(ownerDraft.displayName, '');
        if (!ownerType) throw new Error('对象类型不能为空。');
        if (!displayName) throw new Error('对象名称不能为空。');
        const ownerId = normalizeString(ownerDraft.ownerId, '') || this.allocateOwnerId(ownerType);
        if (this.findByOwner(ownerType, ownerId).length) throw new Error(`${ownerType}:${ownerId} 已存在。`);
        const animationSetId = normalizeString(ownerDraft.animationSetId, `${ownerId}_default`);
        const animationSet = normalizeAnimationSet({
            id: animationSetId,
            ownerType,
            ownerId,
            displayName,
            defaultAnimation: '',
            status: 'warning',
            clips: {},
            references: [],
            updatedAt: new Date().toISOString()
        });
        this.animationSets.push(animationSet);
        return animationSet;
    }

    resolveClip(animationSetId, animationKey) {
        const animationSet = this.getAnimationSet(animationSetId);
        if (!animationSet) return null;
        const key = normalizeString(animationKey, '');
        return animationSet.clips[key]
            || animationSet.clips[animationSet.defaultAnimation]
            || Object.values(animationSet.clips)[0]
            || null;
    }

    removeClip(animationSetId, animationKey) {
        const animationSet = this.getAnimationSet(animationSetId);
        if (!animationSet) throw new Error('动画集不存在。');
        const key = normalizeString(animationKey, '');
        const clip = animationSet.clips[key];
        if (!clip) throw new Error('clip 不存在。');
        delete animationSet.clips[key];
        if (animationSet.defaultAnimation === key) {
            animationSet.defaultAnimation = Object.keys(animationSet.clips)[0] || '';
        }
        animationSet.status = Object.keys(animationSet.clips).length
            ? deriveStatusFromClips(animationSet.clips)
            : 'warning';
        animationSet.updatedAt = new Date().toISOString();
        return clip;
    }

    listReferences(animationSetId) {
        return this.getAnimationSet(animationSetId)?.references || [];
    }

    validateAnimationSet(animationSetId) {
        const animationSet = this.getAnimationSet(animationSetId);
        if (!animationSet) return [{ severity: 'error', message: '动画集不存在。' }];
        const issues = [];
        Object.values(animationSet.clips).forEach((clip) => {
            if (clip.status === 'ready') {
                if (!clip.sheetRef) issues.push({ severity: 'error', clipKey: clip.key, message: 'ready clip 缺少 sheetRef。' });
                if (!clip.manifestRef) issues.push({ severity: 'warning', clipKey: clip.key, message: 'clip 缺少 manifestRef。' });
                if (!clip.frameCount) issues.push({ severity: 'warning', clipKey: clip.key, message: 'clip 缺少 frameCount。' });
                return;
            }
            issues.push({
                severity: clip.status === 'error' ? 'error' : 'warning',
                clipKey: clip.key,
                message: `${clip.key} 状态为 ${clip.status}。`
            });
        });
        if (!issues.length) issues.push({ severity: 'ok', message: '资源可用。' });
        return issues;
    }

    validateAllAnimationSets() {
        const allClips = this.animationSets.flatMap(animationSet => Object.values(animationSet.clips));
        const issues = this.animationSets.flatMap(animationSet => (
            this.validateAnimationSet(animationSet.id)
                .filter(issue => issue.severity !== 'ok')
                .map(issue => ({
                    animationSetId: animationSet.id,
                    ownerType: animationSet.ownerType,
                    ownerId: animationSet.ownerId,
                    ...issue
                }))
        ));
        return {
            status: issues.some(issue => issue.severity === 'error') ? 'error' : issues.length ? 'warning' : 'ready',
            totalSets: this.animationSets.length,
            totalClips: allClips.length,
            readyClipCount: allClips.filter(clip => clip.status === 'ready').length,
            issueCount: issues.length,
            issues
        };
    }

    getSummary() {
        const allClips = this.animationSets.flatMap(animationSet => Object.values(animationSet.clips));
        const owners = this.listOwners();
        return {
            totalOwners: owners.length,
            totalSets: this.animationSets.length,
            readySets: this.animationSets.filter(animationSet => animationSet.status === 'ready').length,
            warningSets: this.animationSets.filter(animationSet => animationSet.status === 'warning').length,
            errorSets: this.animationSets.filter(animationSet => animationSet.status === 'error').length,
            totalClips: allClips.length,
            readyClips: allClips.filter(clip => clip.status === 'ready').length,
            missingClips: allClips.filter(clip => clip.status === 'missing').length
        };
    }

    exportDocument() {
        return {
            schemaVersion: this.schemaVersion,
            meta: clone(this.meta),
            animationSets: clone(this.animationSets)
        };
    }
}

export default AnimationSetWorkspace;
