import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importSkillEditorModule() {
  const filePath = path.join(projectRoot, 'script', 'editor', 'skill', 'skillEditor.js');
  const source = await fs.readFile(filePath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 5000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(baseUrl);
      if (res.status === 403 || res.status === 404 || res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw lastError || new Error('server did not start');
}

async function withTempServer(t, callback) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-editor-file-api-'));
  await fs.mkdir(path.join(tempRoot, 'assets', 'data'), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, 'assets', 'data', 'source.json'),
    JSON.stringify({ $schemaVersion: 'test', skills: [{ id: 'skill_a', name: 'A' }] }, null, 2),
    'utf8'
  );

  const port = await getFreePort();
  const child = spawn(process.execPath, [path.join(projectRoot, 'app.js')], {
    cwd: tempRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    child.kill();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  child.stderr.on('data', chunk => {
    const text = String(chunk || '').trim();
    if (text) process.stderr.write(text + '\n');
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, child);
  await callback({ baseUrl, tempRoot });
}

test('skill editor file API reads and writes JSON files inside the project data directory', async t => {
  await withTempServer(t, async ({ baseUrl, tempRoot }) => {
    const readRes = await fetch(`${baseUrl}/__skill_editor_file?path=assets/data/source.json`);
    assert.equal(readRes.status, 200);
    const readBody = await readRes.json();
    assert.equal(readBody.ok, true);
    assert.equal(readBody.path, 'assets/data/source.json');
    assert.match(readBody.content, /skill_a/);

    const saveRes = await fetch(`${baseUrl}/__skill_editor_file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'assets/data/saved_from_editor.json',
        content: JSON.stringify({ $schemaVersion: 'test', skills: [{ id: 'skill_saved' }] }, null, 2)
      })
    });
    assert.equal(saveRes.status, 200);
    const saveBody = await saveRes.json();
    assert.equal(saveBody.ok, true);
    assert.equal(saveBody.path, 'assets/data/saved_from_editor.json');

    const saved = JSON.parse(await fs.readFile(path.join(tempRoot, 'assets', 'data', 'saved_from_editor.json'), 'utf8'));
    assert.equal(saved.skills[0].id, 'skill_saved');
  });
});

test('skill editor file API rejects traversal, non-json targets, and invalid JSON content', async t => {
  await withTempServer(t, async ({ baseUrl, tempRoot }) => {
    for (const body of [
      { path: '../outside.json', content: '{}' },
      { path: 'package.json', content: '{}' },
      { path: 'assets/data/bad.txt', content: '{}' },
      { path: 'assets/data/bad.json', content: '{not json' }
    ]) {
      const res = await fetch(`${baseUrl}/__skill_editor_file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      assert.equal(res.status, 400, `${body.path} should be rejected`);
      const json = await res.json();
      assert.equal(json.ok, false);
    }

    await assert.rejects(
      fs.stat(path.join(tempRoot, 'outside.json')),
      /ENOENT/
    );
  });
});

test('SkillEditor builds project-save payload and timestamped save-as names', async () => {
  const { SkillEditor, buildTimestampedProjectJsonPath } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.skills = [
    {
      id: 'skill_a',
      name: 'A',
      editorMeta: { x: 100, y: 200 },
      legacyNoise: 'kept'
    }
  ];
  editor.skillPackMeta = { title: 'Pack', enums: {} };
  editor.skillPackSchemaVersion = 'skills_melee_v4_5';
  editor.defaultParts = [];
  editor.enums = {};

  const devPack = editor.buildSkillPackPayload(true);
  assert.equal(devPack.$schemaVersion, 'skills_melee_v4_5');
  assert.equal(devPack.skills[0].editorMeta.x, 100);

  const runtimePack = editor.buildSkillPackPayload(false);
  assert.equal(runtimePack.skills[0].editorMeta, undefined);

  const saveAsPath = buildTimestampedProjectJsonPath(
    'assets/data/skills_melee_v4_5.json',
    new Date(2026, 4, 21, 1, 2, 3)
  );
  assert.equal(saveAsPath, 'assets/data/skills_melee_v4_5_20260521_010203.json');
});

test('SkillEditor saves the current pack through the project file API instead of browser download', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.skills = [{ id: 'skill_a', name: 'A' }];
  editor.skillPackMeta = { title: 'Pack', enums: {} };
  editor.skillPackSchemaVersion = 'skills_melee_v4_5';
  editor.defaultParts = [];
  editor.enums = {};
  editor.currentSkillFilePath = 'assets/data/skills_melee_v4_5.json';
  editor.setProjectFileStatus = message => {
    editor.lastStatus = message;
  };
  editor.setCurrentProjectFilePath = filePath => {
    editor.currentSkillFilePath = filePath;
  };

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ ok: true, path: 'assets/data/skills_melee_v4_5.json', bytes: 123 })
    };
  };
  try {
    await editor.saveProjectSkillPack('assets/data/skills_melee_v4_5.json');
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/__skill_editor_file');
  assert.equal(calls[0].options.method, 'POST');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.path, 'assets/data/skills_melee_v4_5.json');
  assert.equal(JSON.parse(body.content).skills[0].id, 'skill_a');
  assert.match(editor.lastStatus, /已保存/);
});

test('skill editor toolbar uses Chinese labels for file and edit actions', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'test', 'skill_editor_test_v3.html'), 'utf8');
  for (const label of ['加载 Buff', '技能库', '加载项目', '导入本地', '新建技能', '保存', '另存为', '下载', '清空', '自动布局']) {
    assert.match(html, new RegExp(label), `toolbar should include ${label}`);
  }
  assert.doesNotMatch(
    html,
    />\s*(Load Buffs|Skills|Load Project|Import Local|New Skill|Save As|Download|Clear|Auto Layout)\b/,
    'toolbar should not expose English action labels'
  );
});
