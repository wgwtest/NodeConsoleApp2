import LevelPackWorkspace from './LevelPackWorkspace.js';
import LevelEditorPage from './LevelEditorPage.js';
import {
    clearContentPackOverride,
    getContentPackOverride,
    setContentPackOverride
} from '../../tooling/ContentPackOverrideStore.js';

export function createLevelEditorPage(options = {}) {
    return new LevelEditorPage({
        document: options.document || globalThis.document,
        defaultSourceUrl: options.defaultSourceUrl || '../assets/data/levels.json',
        fetchImpl: options.fetchImpl || globalThis.fetch?.bind(globalThis),
        workspaceFactory(rawDocument) {
            return new LevelPackWorkspace(rawDocument);
        },
        overrideStore: {
            get(contentKey) {
                return getContentPackOverride(contentKey);
            },
            set(contentKey, payload) {
                return setContentPackOverride(contentKey, payload);
            },
            clear(contentKey) {
                return clearContentPackOverride(contentKey);
            }
        },
        createObjectURL(blob) {
            return globalThis.URL.createObjectURL(blob);
        },
        revokeObjectURL(url) {
            return globalThis.URL.revokeObjectURL(url);
        }
    });
}

export function bootLevelEditorPage(options = {}) {
    const page = createLevelEditorPage(options);
    page.bind();
    page.loadDefaultPack().catch((error) => {
        page.setStatus(`默认关卡包加载失败：${error.message}`);
    });
    return page;
}

export { LevelPackWorkspace, LevelEditorPage };
