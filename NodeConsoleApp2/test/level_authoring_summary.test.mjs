import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importDataManager() {
    const filePath = path.join(projectRoot, 'script', 'engine', 'DataManagerV2.js');
    let source = await fs.readFile(filePath, 'utf8');
    source = source.replace(
        /^import\s+\{\s*buildContentPackOverrideKey,\s*getContentPackOverride\s*\}\s+from\s+'..\/tooling\/ContentPackOverrideStore\.js';\s*/u,
        ''
    );
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

test('DataManager.getLevelContentSourceOverview 会把正式关卡编辑器纳入作者工具页摘要', async () => {
    const { default: DataManager } = await importDataManager();
    const dm = Object.create(Object.getPrototypeOf(DataManager));
    dm.levelCatalog = {
        levelsMap: {
            level_1_1: {
                id: 'level_1_1',
                flow: { kind: 'story', order: 1 }
            },
            level_1_2_story: {
                id: 'level_1_2_story',
                flow: { kind: 'story', order: 2 }
            },
            level_1_2_acceptance: {
                id: 'level_1_2_acceptance',
                flow: { kind: 'acceptance', order: 101 }
            }
        },
        levelsList: []
    };

    const overview = dm.getLevelContentSourceOverview();
    const authoring = overview.find(item => item.kind === 'authoring');

    assert.equal(authoring?.count, 3);
    assert.ok(Array.isArray(authoring?.pages), 'authoring.pages 应为数组');
    assert.ok(authoring.pages.includes('test/level_editor_v1.html'));
    assert.ok(authoring.pages.includes('test/level_editor_io_test.html'));
    assert.ok(authoring.pages.includes('test/level_runtime_probe.html'));
});
