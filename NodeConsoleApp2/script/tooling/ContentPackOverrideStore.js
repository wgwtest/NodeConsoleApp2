export const CONTENT_PACK_OVERRIDE_STORAGE_KEY = 'codex_content_pack_overrides_v1';

function cloneValue(value) {
    if (!value || typeof value !== 'object') return null;
    return JSON.parse(JSON.stringify(value));
}

function getWindowOverrides() {
    if (typeof globalThis === 'undefined') return null;
    const overrides = globalThis.__CODEX_CONTENT_PACK_OVERRIDES__;
    return overrides && typeof overrides === 'object' ? overrides : null;
}

function getStorage(storage = null) {
    if (storage) return storage;
    if (typeof globalThis === 'undefined') return null;
    return globalThis.localStorage || null;
}

export function buildContentPackOverrideKey(contentKey, scopeId = null) {
    return scopeId ? `${contentKey}:${scopeId}` : contentKey;
}

export function readContentPackOverrides(storage = null) {
    const windowOverrides = getWindowOverrides();
    if (windowOverrides) {
        return cloneValue(windowOverrides) || {};
    }

    const safeStorage = getStorage(storage);
    if (!safeStorage) return {};

    try {
        const raw = safeStorage.getItem(CONTENT_PACK_OVERRIDE_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('[ContentPackOverrideStore] Failed to read overrides:', error);
        return {};
    }
}

export function writeContentPackOverrides(overrides, storage = null) {
    const safeStorage = getStorage(storage);
    if (!safeStorage) return false;

    try {
        safeStorage.setItem(
            CONTENT_PACK_OVERRIDE_STORAGE_KEY,
            JSON.stringify(overrides && typeof overrides === 'object' ? overrides : {})
        );
        return true;
    } catch (error) {
        console.warn('[ContentPackOverrideStore] Failed to write overrides:', error);
        return false;
    }
}

export function getContentPackOverride(contentKey, scopeId = null, storage = null) {
    const overrides = readContentPackOverrides(storage);
    const scopedKey = buildContentPackOverrideKey(contentKey, scopeId);
    return cloneValue(overrides[scopedKey] || overrides[contentKey] || null);
}

export function setContentPackOverride(contentKey, rawPack, scopeId = null, storage = null) {
    const overrides = readContentPackOverrides(storage);
    const scopedKey = buildContentPackOverrideKey(contentKey, scopeId);
    overrides[scopedKey] = cloneValue(rawPack);
    writeContentPackOverrides(overrides, storage);
    return cloneValue(overrides[scopedKey]);
}

export function clearContentPackOverride(contentKey, scopeId = null, storage = null) {
    const overrides = readContentPackOverrides(storage);
    const scopedKey = buildContentPackOverrideKey(contentKey, scopeId);
    delete overrides[scopedKey];
    if (!scopeId) {
        delete overrides[contentKey];
    }
    writeContentPackOverrides(overrides, storage);
    return true;
}
