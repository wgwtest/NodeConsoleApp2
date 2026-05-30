import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const ensureScriptPath = path.join(repoRoot, 'tools', 'graphify_ensure_fresh.sh');
const queryScriptPath = path.join(repoRoot, 'tools', 'graphify_query.sh');
const openScriptPath = path.join(repoRoot, 'tools', 'graphify_open.sh');

function writeExecutable(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
    fs.chmodSync(filePath, 0o755);
}

function createFixtureRoot(prefix) {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
    fs.mkdirSync(path.join(rootDir, 'script'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'graphify-out'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'script', 'example.js'), 'export const graphifyProbe = true;\n', 'utf8');
    return rootDir;
}

function setMtime(filePath, isoString) {
    const date = new Date(isoString);
    fs.utimesSync(filePath, date, date);
}

function findWindowsBash() {
    const candidates = [
        process.env.BASH,
        'C:/Program Files/Git/bin/bash.exe',
        'C:/Program Files/Git/usr/bin/bash.exe'
    ].filter(Boolean);

    return candidates.find(candidate => fs.existsSync(candidate)) || 'bash';
}

function runScript(scriptPath, args = [], env = {}) {
    const command = process.platform === 'win32' ? findWindowsBash() : scriptPath;
    const commandArgs = process.platform === 'win32' ? [scriptPath, ...args] : args;

    return spawnSync(command, commandArgs, {
        encoding: 'utf8',
        env: {
            ...process.env,
            ...env
        }
    });
}

test('graphify_ensure_fresh 会在源码比图谱新时标记 stale，并在图谱刷新后清理标记', () => {
    assert.equal(fs.existsSync(ensureScriptPath), true, 'graphify_ensure_fresh.sh 缺失');

    const rootDir = createFixtureRoot('graphify-status');
    const sourcePath = path.join(rootDir, 'script', 'example.js');
    const graphJsonPath = path.join(rootDir, 'graphify-out', 'graph.json');
    const flagPath = path.join(rootDir, 'graphify-out', 'needs_update');

    fs.writeFileSync(graphJsonPath, '{}\n', 'utf8');
    setMtime(graphJsonPath, '2026-01-01T00:00:00Z');
    setMtime(sourcePath, '2026-01-02T00:00:00Z');

    const staleResult = runScript(ensureScriptPath, ['--status-only'], {
        GRAPHIFY_ROOT_DIR: rootDir
    });

    assert.equal(staleResult.status, 0, staleResult.stderr || staleResult.stdout);
    assert.match(staleResult.stdout, /stale/, '源码更新后应判定为 stale');
    assert.equal(fs.existsSync(flagPath), true, 'stale 时应写入 needs_update 标记');

    setMtime(graphJsonPath, '2026-01-03T00:00:00Z');

    const freshResult = runScript(ensureScriptPath, ['--status-only'], {
        GRAPHIFY_ROOT_DIR: rootDir
    });

    assert.equal(freshResult.status, 0, freshResult.stderr || freshResult.stdout);
    assert.match(freshResult.stdout, /fresh/, '图谱刷新后应恢复为 fresh');
    assert.equal(fs.existsSync(flagPath), false, 'fresh 时应清理 needs_update 标记');
});

test('graphify_query 会在查询前按需重建图谱', () => {
    const rootDir = createFixtureRoot('graphify-query');
    const rebuildScriptPath = path.join(rootDir, 'stub_rebuild.sh');
    const cliScriptPath = path.join(rootDir, 'stub_graphify.sh');

    writeExecutable(
        rebuildScriptPath,
        `#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="\${GRAPHIFY_ROOT_DIR:?}"
mkdir -p "$ROOT_DIR/graphify-out"
printf '{}\\n' > "$ROOT_DIR/graphify-out/graph.json"
printf '# report\\n' > "$ROOT_DIR/graphify-out/GRAPH_REPORT.md"
printf '<html>fresh graph</html>\\n' > "$ROOT_DIR/graphify-out/graph.html"
rm -f "$ROOT_DIR/graphify-out/needs_update"
printf 'rebuild\\n' >> "$ROOT_DIR/rebuild.log"
`
    );

    writeExecutable(
        cliScriptPath,
        `#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="\${GRAPHIFY_ROOT_DIR:?}"
printf '%s\\n' "$*" >> "$ROOT_DIR/query.log"
printf 'stub query ok\\n'
`
    );

    const result = runScript(
        queryScriptPath,
        ['Which files changed?'],
        {
            GRAPHIFY_ROOT_DIR: rootDir,
            GRAPHIFY_REBUILD_SCRIPT: rebuildScriptPath,
            GRAPHIFY_BIN: cliScriptPath
        }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /stub query ok/, '查询入口未执行 Graphify CLI');
    assert.equal(fs.existsSync(path.join(rootDir, 'rebuild.log')), true, '缺失图谱时应先执行重建');
    assert.equal(fs.existsSync(path.join(rootDir, 'graphify-out', 'graph.json')), true, '重建后应生成 graph.json');

    const queryLog = fs.readFileSync(path.join(rootDir, 'query.log'), 'utf8');
    assert.match(queryLog, /query/, '查询入口未调用 graphify query 子命令');
});

test('graphify_open 会在打开前按需重建，并返回图谱入口路径', () => {
    assert.equal(fs.existsSync(openScriptPath), true, 'graphify_open.sh 缺失');

    const rootDir = createFixtureRoot('graphify-open');
    const rebuildScriptPath = path.join(rootDir, 'stub_rebuild.sh');

    writeExecutable(
        rebuildScriptPath,
        `#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="\${GRAPHIFY_ROOT_DIR:?}"
mkdir -p "$ROOT_DIR/graphify-out"
printf '{}\\n' > "$ROOT_DIR/graphify-out/graph.json"
printf '# report\\n' > "$ROOT_DIR/graphify-out/GRAPH_REPORT.md"
printf '<html>fresh graph</html>\\n' > "$ROOT_DIR/graphify-out/graph.html"
rm -f "$ROOT_DIR/graphify-out/needs_update"
printf 'rebuild\\n' >> "$ROOT_DIR/rebuild.log"
`
    );

    const result = runScript(openScriptPath, [], {
        GRAPHIFY_ROOT_DIR: rootDir,
        GRAPHIFY_REBUILD_SCRIPT: rebuildScriptPath
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(rootDir, 'rebuild.log')), true, '打开入口前应先按需重建');
    assert.match(result.stdout, /graphify-out\/graph\.html/, '打开入口应返回 graph.html 路径');
});
