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
  await fs.writeFile(
    path.join(tempRoot, 'assets', 'data', 'buffs_v2_5.json'),
    JSON.stringify({ $schemaVersion: 'buffs_test', buffs: { buff_old: { id: 'buff_old', name: 'Old' } } }, null, 2),
    'utf8'
  );
  await fs.writeFile(
    path.join(tempRoot, 'assets', 'data', 'buffs_v2_7.json'),
    JSON.stringify({ $schemaVersion: 'buffs_test', buffs: { buff_new: { id: 'buff_new', name: 'New' } } }, null, 2),
    'utf8'
  );
  await fs.mkdir(path.join(tempRoot, 'assets', 'skill_packs', 'authoring'), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, 'assets', 'skill_packs', 'authoring', 'skills_melee_v4_5_20260522_010203.json'),
    JSON.stringify({ $schemaVersion: 'skills_melee_v3', skills: [{ id: 'skill_recent', name: 'Recent' }] }, null, 2),
    'utf8'
  );
  await fs.writeFile(
    path.join(tempRoot, 'assets', 'skill_packs', 'authoring', 'skills_enemy_v1_20260522_010203.json'),
    JSON.stringify({ $schemaVersion: 'skills_melee_v3', meta: { skillDomain: 'enemy' }, skills: [{ id: 'enemy_skill_recent', name: 'Recent Enemy' }] }, null, 2),
    'utf8'
  );
  await fs.utimes(
    path.join(tempRoot, 'assets', 'skill_packs', 'authoring', 'skills_melee_v4_5_20260522_010203.json'),
    new Date('2026-05-22T01:02:03Z'),
    new Date('2026-05-22T01:02:03Z')
  );
  await fs.utimes(
    path.join(tempRoot, 'assets', 'skill_packs', 'authoring', 'skills_enemy_v1_20260522_010203.json'),
    new Date('2026-05-22T01:02:04Z'),
    new Date('2026-05-22T01:02:04Z')
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

test('skill editor file API lists JSON files beside a project file', async t => {
  await withTempServer(t, async ({ baseUrl }) => {
    const listRes = await fetch(`${baseUrl}/__skill_editor_file?path=assets/data/source.json&list=1`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.ok, true);
    assert.equal(listBody.path, 'assets/data/source.json');
    assert.deepEqual(
      listBody.files.filter(file => file.startsWith('assets/data/buffs_')),
      ['assets/data/buffs_v2_5.json', 'assets/data/buffs_v2_7.json']
    );
  });
});

test('project JSON file API allows enemy authoring draft files', async t => {
  await withTempServer(t, async ({ baseUrl, tempRoot }) => {
    const content = JSON.stringify({
      goblin_story_headhunter: {
        id: 'goblin_story_headhunter',
        name: '哥布林追猎手',
        stats: { hp: 65, maxHp: 65, ap: 4, speed: 11 },
        bodyParts: {},
        skills: ['skill_throw_stone'],
        presentation: { portraitRef: 'enemy_goblin_hunter' }
      }
    }, null, 2);

    const saveRes = await fetch(`${baseUrl}/__skill_editor_file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'assets/enemy_packs/authoring/enemies_20260524_010203.json',
        content
      })
    });
    assert.equal(saveRes.status, 200);
    const saveBody = await saveRes.json();
    assert.equal(saveBody.ok, true);
    assert.equal(saveBody.path, 'assets/enemy_packs/authoring/enemies_20260524_010203.json');

    const saved = JSON.parse(await fs.readFile(
      path.join(tempRoot, 'assets', 'enemy_packs', 'authoring', 'enemies_20260524_010203.json'),
      'utf8'
    ));
    assert.equal(saved.goblin_story_headhunter.presentation.portraitRef, 'enemy_goblin_hunter');
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

test('skill pack API saves authoring versions, publishes runtime pack, and lists recent skill JSON files', async t => {
  await withTempServer(t, async ({ baseUrl, tempRoot }) => {
    const authoringPath = 'assets/skill_packs/authoring/skills_melee_v4_5_20260522_020304.json';
    const content = JSON.stringify({ $schemaVersion: 'skills_melee_v3', skills: [{ id: 'skill_saved_authoring' }] }, null, 2);

    const saveRes = await fetch(`${baseUrl}/api/skill-packs/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: authoringPath, content })
    });
    assert.equal(saveRes.status, 200);
    const saveBody = await saveRes.json();
    assert.equal(saveBody.ok, true);
    assert.equal(saveBody.targetPath, authoringPath);

    const savedAuthoring = JSON.parse(await fs.readFile(path.join(tempRoot, authoringPath), 'utf8'));
    assert.equal(savedAuthoring.skills[0].id, 'skill_saved_authoring');

    const publishRes = await fetch(`${baseUrl}/api/skill-packs/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    assert.equal(publishRes.status, 200);
    const publishBody = await publishRes.json();
    assert.equal(publishBody.ok, true);
    assert.equal(publishBody.targetPath, 'assets/data/skills_melee_v4_5.json');

    const runtimePack = JSON.parse(await fs.readFile(path.join(tempRoot, 'assets', 'data', 'skills_melee_v4_5.json'), 'utf8'));
    assert.equal(runtimePack.skills[0].id, 'skill_saved_authoring');

    const recentRes = await fetch(`${baseUrl}/api/skill-packs/recent?limit=5`);
    assert.equal(recentRes.status, 200);
    const recentBody = await recentRes.json();
    assert.equal(recentBody.ok, true);
    assert(
      recentBody.files.some(file => file.path === authoringPath),
      'recent list should include saved authoring skill versions'
    );
    assert(
      recentBody.files.some(file => file.path === 'assets/data/skills_melee_v4_5.json'),
      'recent list should include runtime skill JSON'
    );
  });
});

test('skill pack API supports enemy skill authoring, runtime publish, and kind-filtered recents', async t => {
  await withTempServer(t, async ({ baseUrl, tempRoot }) => {
    const authoringPath = 'assets/skill_packs/authoring/skills_enemy_v1_20260522_020304.json';
    const content = JSON.stringify({
      $schemaVersion: 'skills_melee_v3',
      meta: { skillDomain: 'enemy' },
      skills: [{ id: 'enemy_skill_saved', name: '敌人技能' }]
    }, null, 2);

    const saveRes = await fetch(`${baseUrl}/api/skill-packs/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'enemy', targetPath: authoringPath, content })
    });
    assert.equal(saveRes.status, 200);
    const saveBody = await saveRes.json();
    assert.equal(saveBody.ok, true);
    assert.equal(saveBody.targetPath, authoringPath);

    const publishRes = await fetch(`${baseUrl}/api/skill-packs/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'enemy', content })
    });
    assert.equal(publishRes.status, 200);
    const publishBody = await publishRes.json();
    assert.equal(publishBody.ok, true);
    assert.equal(publishBody.targetPath, 'assets/data/skills_enemy_v1.json');

    const runtimePack = JSON.parse(await fs.readFile(path.join(tempRoot, 'assets', 'data', 'skills_enemy_v1.json'), 'utf8'));
    assert.equal(runtimePack.skills[0].id, 'enemy_skill_saved');

    const enemyRecentRes = await fetch(`${baseUrl}/api/skill-packs/recent?kind=enemy&limit=10`);
    assert.equal(enemyRecentRes.status, 200);
    const enemyRecentBody = await enemyRecentRes.json();
    assert.equal(enemyRecentBody.ok, true);
    assert(enemyRecentBody.files.some(file => file.path === authoringPath));
    assert(enemyRecentBody.files.some(file => file.path === 'assets/data/skills_enemy_v1.json'));
    assert(!enemyRecentBody.files.some(file => file.path.includes('skills_melee_v4_5')));

    const playerRecentRes = await fetch(`${baseUrl}/api/skill-packs/recent?kind=player&limit=10`);
    assert.equal(playerRecentRes.status, 200);
    const playerRecentBody = await playerRecentRes.json();
    assert.equal(playerRecentBody.ok, true);
    assert(playerRecentBody.files.some(file => file.path.includes('skills_melee_v4_5')));
    assert(!playerRecentBody.files.some(file => file.path.includes('skills_enemy_v1')));
  });
});

test('skill pack API rejects authoring saves outside authoring root and runtime publishes outside runtime skill file', async t => {
  await withTempServer(t, async ({ baseUrl, tempRoot }) => {
    const content = JSON.stringify({ $schemaVersion: 'skills_melee_v3', skills: [{ id: 'skill_bad' }] }, null, 2);
    const badSave = await fetch(`${baseUrl}/api/skill-packs/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: 'assets/data/skills_bad.json', content })
    });
    assert.equal(badSave.status, 400);
    assert.equal((await badSave.json()).ok, false);

    const badPublish = await fetch(`${baseUrl}/api/skill-packs/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: 'assets/skill_packs/authoring/skills_bad.json', content })
    });
    assert.equal(badPublish.status, 400);
    assert.equal((await badPublish.json()).ok, false);

    await assert.rejects(
      fs.stat(path.join(tempRoot, 'assets', 'data', 'skills_bad.json')),
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

test('SkillEditor saves authoring skill versions and publishes the runtime skill pack through dedicated APIs', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.skills = [{ id: 'skill_a', name: 'A' }];
  editor.skillPackMeta = { title: 'Pack', enums: {} };
  editor.skillPackSchemaVersion = 'skills_melee_v3';
  editor.defaultParts = [];
  editor.enums = {};
  editor.currentSkillFilePath = 'assets/data/skills_melee_v4_5.json';
  editor.setProjectFileStatus = message => {
    editor.lastStatus = message;
  };
  editor.setCurrentProjectFilePath = filePath => {
    editor.currentSkillFilePath = filePath;
  };
  editor.refreshRecentSkillFiles = async () => {};

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        targetPath: url === '/api/skill-packs/publish'
          ? 'assets/data/skills_melee_v4_5.json'
          : 'assets/skill_packs/authoring/skills_melee_v4_5_20260522_010203.json',
        bytes: 123
      })
    };
  };
  try {
    await editor.saveAuthoringSkillPack(new Date(2026, 4, 22, 1, 2, 3));
    await editor.publishRuntimeSkillPack();
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(calls.map(call => call.url), ['/api/skill-packs/save', '/api/skill-packs/publish']);
  const saveBody = JSON.parse(calls[0].options.body);
  const publishBody = JSON.parse(calls[1].options.body);
  assert.equal(saveBody.targetPath, 'assets/skill_packs/authoring/skills_melee_v4_5_20260522_010203.json');
  assert.equal(JSON.parse(saveBody.content).skills[0].id, 'skill_a');
  assert.equal(publishBody.targetPath, 'assets/data/skills_melee_v4_5.json');
  assert.equal(JSON.parse(publishBody.content).skills[0].id, 'skill_a');
  assert.match(editor.lastStatus, /已发布到主流程/);
});

test('SkillEditor switches to enemy skill mode with separate paths, API kind, and recent list', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.skills = [{ id: 'enemy_skill_a', name: 'Enemy A' }];
  editor.skillPackMeta = { title: 'Enemy Pack', enums: {} };
  editor.skillPackSchemaVersion = 'skills_melee_v3';
  editor.defaultParts = [];
  editor.enums = {};
  editor.currentSkillFilePath = 'assets/data/skills_melee_v4_5.json';
  editor.elProjectFilePath = { value: '' };
  editor.setProjectFileStatus = message => {
    editor.lastStatus = message;
  };
  editor.setCurrentProjectFilePath = SkillEditor.prototype.setCurrentProjectFilePath;
  editor.refreshRecentSkillFiles = SkillEditor.prototype.refreshRecentSkillFiles;

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        targetPath: String(url).includes('/publish')
          ? 'assets/data/skills_enemy_v1.json'
          : 'assets/skill_packs/authoring/skills_enemy_v1_20260522_010203.json',
        files: [
          { path: 'assets/skill_packs/authoring/skills_enemy_v1_20260522_010203.json', mtimeMs: 1770000000000 }
        ]
      })
    };
  };
  try {
    editor.setSkillDomain('enemy');
    assert.equal(editor.currentSkillFilePath, 'assets/data/skills_enemy_v1.json');
    assert.equal(editor.elProjectFilePath.value, 'assets/data/skills_enemy_v1.json');

    await editor.saveAuthoringSkillPack(new Date(2026, 4, 22, 1, 2, 3));
    await editor.publishRuntimeSkillPack();
    await editor.refreshRecentSkillFiles();
  } finally {
    global.fetch = originalFetch;
  }

  const saveBody = JSON.parse(calls.find(call => call.url === '/api/skill-packs/save').options.body);
  const publishBody = JSON.parse(calls.find(call => call.url === '/api/skill-packs/publish').options.body);
  assert.equal(saveBody.kind, 'enemy');
  assert.equal(saveBody.targetPath, 'assets/skill_packs/authoring/skills_enemy_v1_20260522_010203.json');
  assert.equal(publishBody.kind, 'enemy');
  assert.equal(publishBody.targetPath, 'assets/data/skills_enemy_v1.json');
  assert(calls.some(call => call.url === '/api/skill-packs/recent?kind=enemy&limit=20'));
});

test('SkillEditor toolbar domain switch refreshes recents and loads the selected default skill pack', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.skillDomain = 'player';
  editor.currentSkillFilePath = 'assets/data/skills_melee_v4_5.json';
  editor.elProjectFilePath = { value: 'assets/data/skills_melee_v4_5.json' };
  editor.elSkillDomainSelect = { value: 'player' };
  editor.setProjectFileStatus = message => {
    editor.lastStatus = message;
  };
  editor.setCurrentProjectFilePath = SkillEditor.prototype.setCurrentProjectFilePath;

  const calls = [];
  editor.refreshRecentSkillFiles = async () => {
    calls.push(['recent', editor.getRecentSkillPackKind()]);
  };
  editor.loadProjectSkillPack = async filePath => {
    calls.push(['load', filePath]);
    editor.loadedPath = filePath;
  };

  await editor.switchSkillDomain('enemy');

  assert.equal(editor.skillDomain, 'enemy');
  assert.equal(editor.currentSkillFilePath, 'assets/data/skills_enemy_v1.json');
  assert.equal(editor.elProjectFilePath.value, 'assets/data/skills_enemy_v1.json');
  assert.equal(editor.loadedPath, 'assets/data/skills_enemy_v1.json');
  assert.deepEqual(calls, [
    ['recent', 'enemy'],
    ['load', 'assets/data/skills_enemy_v1.json']
  ]);
});

test('SkillEditor compact domain toggle switches between player and enemy modes', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.skillDomain = 'player';
  editor.elSkillDomainToggle = { dataset: {}, textContent: '', title: '' };
  editor.elProjectFilePath = { value: 'assets/data/skills_melee_v4_5.json' };
  editor.setProjectFileStatus = message => {
    editor.lastStatus = message;
  };
  editor.setCurrentProjectFilePath = SkillEditor.prototype.setCurrentProjectFilePath;

  const loaded = [];
  editor.refreshRecentSkillFiles = async () => {};
  editor.loadProjectSkillPack = async filePath => {
    loaded.push(filePath);
  };

  editor.updateSkillDomainToggle();
  assert.equal(editor.elSkillDomainToggle.textContent, '我方技能');
  assert.equal(editor.elSkillDomainToggle.dataset.domain, 'player');

  await editor.toggleSkillDomain();
  assert.equal(editor.skillDomain, 'enemy');
  assert.equal(editor.elSkillDomainToggle.textContent, '敌方技能');
  assert.equal(editor.elSkillDomainToggle.dataset.domain, 'enemy');
  assert.deepEqual(loaded, ['assets/data/skills_enemy_v1.json']);
});

test('SkillEditor authoring version names do not accumulate old timestamp suffixes', async () => {
  const { buildTimestampedSkillAuthoringPath } = await importSkillEditorModule();
  const nextPath = buildTimestampedSkillAuthoringPath(
    'assets/skill_packs/authoring/skills_melee_v4_5_20260522_010203.json',
    new Date(2026, 4, 22, 2, 3, 4)
  );
  assert.equal(nextPath, 'assets/skill_packs/authoring/skills_melee_v4_5_20260522_020304.json');
});

test('SkillEditor refreshes and loads recent skill JSON versions from the toolbar dropdown', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const appended = [];
  const editor = Object.create(SkillEditor.prototype);
  editor.elRecentSkillFileSelect = {
    innerHTML: '',
    value: '',
    appendChild(option) {
      appended.push(option);
      if (!this.value) this.value = option.value;
    }
  };
  editor.document = {
    createElement(tagName) {
      assert.equal(tagName, 'option');
      return { value: '', textContent: '' };
    }
  };
  editor.setProjectFileStatus = message => {
    editor.lastStatus = message;
  };
  editor.loadProjectSkillPack = async filePath => {
    editor.loadedPath = filePath;
  };

  const originalFetch = global.fetch;
  global.fetch = async url => {
    assert.equal(String(url), '/api/skill-packs/recent?limit=20');
    return {
      ok: true,
      json: async () => ({
        ok: true,
        files: [
          { path: 'assets/skill_packs/authoring/skills_melee_v4_5_20260522_010203.json', mtimeMs: 1770000000000 },
          { path: 'assets/data/skills_melee_v4_5.json', mtimeMs: 1760000000000 }
        ]
      })
    };
  };
  try {
    const files = await editor.refreshRecentSkillFiles();
    await editor.loadSelectedRecentSkillFile();
    assert.equal(files.length, 2);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(appended.length, 2);
  assert.equal(appended[0].value, 'assets/skill_packs/authoring/skills_melee_v4_5_20260522_010203.json');
  assert.equal(editor.loadedPath, 'assets/skill_packs/authoring/skills_melee_v4_5_20260522_010203.json');
});

test('SkillEditor draws editor connections with only horizontal and vertical segments', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const appended = [];
  const originalDocument = global.document;
  global.document = {
    createElementNS(namespace, tagName) {
      assert.equal(namespace, 'http://www.w3.org/2000/svg');
      assert.equal(tagName, 'polyline');
      const attrs = new Map();
      const listeners = new Map();
      return {
        setAttribute(name, value) {
          attrs.set(name, String(value));
        },
        getAttribute(name) {
          return attrs.get(name) || '';
        },
        addEventListener(name, handler) {
          listeners.set(name, handler);
        },
        dispatch(name, event) {
          listeners.get(name)?.(event);
        }
      };
    }
  };

  try {
    const editor = Object.create(SkillEditor.prototype);
    editor.GRID_SIZE = 100;
    editor.NODE_SIZE = 72;
    editor.NODE_HALF = 36;
    editor.CONNECTION_MARGIN = 12;
    editor.ANCHOR_HYSTERESIS_PX = 14;
    editor.selectedConnection = null;
    editor.clearSelection = () => {
      editor.didClearSelection = true;
    };
    editor.renderNodes = () => {
      editor.renderNodeCalls = (editor.renderNodeCalls || 0) + 1;
    };
    editor.renderConnections = () => {
      editor.renderConnectionCalls = (editor.renderConnectionCalls || 0) + 1;
    };
    editor.elSvgLayer = {
      appendChild(node) {
        appended.push(node);
      }
    };

    const sourceMeta = { x: 614, y: 614 };
    const targetMeta = { x: 514, y: 814 };
    editor.drawConnection(
      { id: 'skill_parent', editorMeta: sourceMeta },
      { id: 'skill_child', editorMeta: targetMeta }
    );

    assert.equal(appended.length, 2);
    const [hitLine, visibleLine] = appended;
    assert.equal(hitLine.getAttribute('class'), 'connection-hit-line');
    assert.equal(hitLine.getAttribute('stroke'), 'transparent');
    assert.equal(hitLine.getAttribute('stroke-width'), '8');
    assert.equal(hitLine.getAttribute('pointer-events'), 'stroke');
    assert.equal(visibleLine.getAttribute('class'), 'connection-line');
    assert.equal(hitLine.getAttribute('points'), visibleLine.getAttribute('points'));

    const points = visibleLine.getAttribute('points')
      .trim()
      .split(/\s+/u)
      .map(point => point.split(',').map(Number));

    assert(points.length >= 2, 'connection should include multiple polyline points');
    for (let i = 1; i < points.length; i += 1) {
      const [prevX, prevY] = points[i - 1];
      const [x, y] = points[i];
      assert(
        prevX === x || prevY === y,
        `segment ${i} should be orthogonal: ${prevX},${prevY} -> ${x},${y}`
      );
    }

    const horizontalSegments = [];
    for (let i = 1; i < points.length; i += 1) {
      const [prevX, prevY] = points[i - 1];
      const [x, y] = points[i];
      if (prevX !== x && prevY === y) horizontalSegments.push({ y });
    }
    const expectedMidY = (sourceMeta.y + editor.NODE_SIZE + targetMeta.y) / 2;
    assert.equal(horizontalSegments.length, 1);
    assert.equal(horizontalSegments[0].y, expectedMidY);

    let stopped = false;
    hitLine.dispatch('click', { stopPropagation: () => { stopped = true; } });
    assert.equal(stopped, true);
    assert.deepEqual(editor.selectedConnection, { source: 'skill_parent', target: 'skill_child' });
    assert.equal(editor.didClearSelection, true);
    assert.equal(editor.renderNodeCalls, 1);
    assert.equal(editor.renderConnectionCalls, 1);

    appended.length = 0;
    editor.selectedConnection = { source: 'skill_parent', target: 'skill_child' };
    editor.drawConnection(
      { id: 'skill_parent', editorMeta: sourceMeta },
      { id: 'skill_child', editorMeta: targetMeta }
    );
    assert.equal(appended[1].getAttribute('class'), 'connection-line is-selected');
    assert.equal(appended[1].getAttribute('stroke'), '');
    assert.equal(appended[1].getAttribute('stroke-width'), '');
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
  }
});

test('SkillEditor offsets incoming endpoints for targets with multiple prerequisites', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const appended = [];
  const originalDocument = global.document;
  global.document = {
    createElementNS(namespace, tagName) {
      assert.equal(namespace, 'http://www.w3.org/2000/svg');
      assert.equal(tagName, 'polyline');
      const attrs = new Map();
      return {
        setAttribute(name, value) {
          attrs.set(name, String(value));
        },
        getAttribute(name) {
          return attrs.get(name) || '';
        },
        addEventListener() {}
      };
    }
  };

  try {
    const editor = Object.create(SkillEditor.prototype);
    editor.GRID_SIZE = 100;
    editor.NODE_SIZE = 72;
    editor.NODE_HALF = 36;
    editor.CONNECTION_MARGIN = 12;
    editor.ANCHOR_HYSTERESIS_PX = 14;
    editor.selectedConnection = null;
    editor.clearSelection = () => {};
    editor.renderNodes = () => {};
    editor.renderConnections = () => {};
    editor.skills = [
      { id: 'left_parent', editorMeta: { x: 414, y: 1014 } },
      { id: 'right_parent', editorMeta: { x: 614, y: 1014 } },
      { id: 'merged_child', prerequisites: ['left_parent', 'right_parent'], editorMeta: { x: 514, y: 1214 } }
    ];
    editor.elSvgLayer = {
      appendChild(node) {
        appended.push(node);
      }
    };

    editor.drawConnection(editor.skills[0], editor.skills[2]);
    editor.drawConnection(editor.skills[1], editor.skills[2]);

    const visibleLines = appended.filter(node => node.getAttribute('class').startsWith('connection-line'));
    assert.equal(visibleLines.length, 2);
    const endpoints = visibleLines.map(line => {
      const points = line.getAttribute('points').trim().split(/\s+/u);
      return points.at(-1).split(',').map(Number);
    });

    assert.notEqual(endpoints[0][0], endpoints[1][0], 'incoming endpoints should not share the same x coordinate');
    assert.deepEqual(
      endpoints.map(point => point[1]),
      [1214, 1214],
      'incoming endpoints should still land on the target top edge'
    );
  } finally {
    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
  }
});

test('SkillEditor assigns incoming endpoint order by source node position instead of prerequisite order', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.NODE_SIZE = 72;
  editor.NODE_HALF = 36;
  editor.skills = [
    { id: 'right_parent', editorMeta: { x: 814, y: 814 } },
    { id: 'left_parent', editorMeta: { x: 614, y: 814 } },
    {
      id: 'merged_child',
      prerequisites: ['right_parent', 'left_parent'],
      editorMeta: { x: 814, y: 1014 }
    }
  ];

  const rightEndpointX = editor.getIncomingAnchorX(editor.skills[0], editor.skills[2]);
  const leftEndpointX = editor.getIncomingAnchorX(editor.skills[1], editor.skills[2]);

  assert(leftEndpointX < rightEndpointX, 'left source should land on the left target endpoint even when listed second');
});

test('sword rework descriptions are player-facing summaries with costs and effects', async () => {
  const packPath = path.join(projectRoot, 'assets', 'skill_packs', 'authoring', 'skills_melee_v4_5_sword_rework_20260527_230444.json');
  const pack = JSON.parse(await fs.readFile(packPath, 'utf8'));
  const swordSkills = pack.skills.filter(skill => (
    skill.editorMeta?.groupLabel === '剑系'
    || skill.editorMeta?.group === '剑系'
    || String(skill.editorMeta?.growthTrack || '').startsWith('sword')
  ));
  const forbidden = /低\s*KP|低\s*AP|基准|启动器|加深器|兑现|当前运行时|设计上|不强制|不消耗|后续支持|高约束/u;

  assert(swordSkills.length > 0, 'expected sword skills in sword rework pack');
  for (const skill of swordSkills) {
    assert.doesNotMatch(skill.description || '', forbidden, `${skill.name} description leaks design language`);
    assert.match(skill.description || '', /学习\s*\d+\s*KP/u, `${skill.name} description should include learning KP`);
    assert.match(skill.description || '', /消耗\s*\d+\s*AP/u, `${skill.name} description should include AP cost`);
    assert.match(skill.description || '', /(造成|回复|施加|获得|进入)/u, `${skill.name} description should summarize player-visible effect`);
  }
});

test('skill editor stylesheet gives transparent connection hit lines an 8px response area', async () => {
  const css = await fs.readFile(path.join(projectRoot, 'test', 'skill_editor_test_v3.css'), 'utf8');
  assert.match(css, /\.skill-editor-v3 \.connection-hit-line\s*\{[\s\S]*stroke-width:\s*8/u);
  assert.match(css, /\.skill-editor-v3 \.connection-hit-line:hover \+ \.connection-line\s*\{[\s\S]*stroke:\s*#ff9900/u);
  assert.match(css, /\.skill-editor-v3 \.connection-line\.is-selected\s*\{[\s\S]*stroke:\s*#ff0000/u);
  assert.match(css, /\.skill-editor-v3 \.connection-line\.is-selected\s*\{[\s\S]*stroke-width:\s*4/u);
});

test('SkillEditor loads the newest sibling buffs pack after loading a project skill pack', async () => {
  const { SkillEditor } = await importSkillEditorModule();
  const editor = Object.create(SkillEditor.prototype);
  editor.skills = [];
  editor.buffDict = {};
  editor.defaultParts = [];
  editor.enums = {};
  editor.currentSkillFilePath = 'assets/data/skills_melee_v4_5.json';
  editor.setProjectFileStatus = message => {
    editor.lastStatus = message;
  };
  editor.setCurrentProjectFilePath = filePath => {
    editor.currentSkillFilePath = filePath;
  };
  editor.setSkillPackMeta = (meta, schemaVersion) => {
    editor.skillPackMeta = meta;
    editor.skillPackSchemaVersion = schemaVersion;
  };
  editor.clearSelection = () => {};
  editor.renderNodes = () => {};
  editor.renderSkillLibrary = () => {};
  editor.loadProperties = () => {};
  editor.renderBuffRefTables = () => {};
  editor.updateSummary = () => {};
  editor.ensureBuffNameIndex = SkillEditor.prototype.ensureBuffNameIndex;

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes('list=1')) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          path: 'assets/data/skills_melee_v4_5.json',
          files: [
            'assets/data/skills_melee_v4_5.json',
            'assets/data/buffs_v2_5.json',
            'assets/data/buffs_v2_7.json'
          ]
        })
      };
    }
    if (String(url).includes('buffs_v2_7.json')) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          path: 'assets/data/buffs_v2_7.json',
          content: JSON.stringify({ $schemaVersion: 'buffs_v2_7', buffs: { buff_bleed: { id: 'buff_bleed', name: '流血' } } })
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        ok: true,
        path: 'assets/data/skills_melee_v4_5.json',
        content: JSON.stringify({ $schemaVersion: 'skills_melee_v4_5', skills: [{ id: 'skill_a', name: 'A' }] })
      })
    };
  };
  try {
    await editor.loadProjectSkillPack('assets/data/skills_melee_v4_5.json');
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(editor.skills.map(skill => skill.id), ['skill_a']);
  assert.equal(editor.currentBuffFilePath, 'assets/data/buffs_v2_7.json');
  assert.equal(editor.buffDict.buff_bleed.name, '流血');
  assert(calls.some(url => url.includes('list=1')), 'should ask the project file API for sibling JSON files');
  assert(calls.some(url => url.includes('buffs_v2_7.json')), 'should load the newest sibling buffs pack');
});

test('skill editor toolbar uses Chinese labels for file and edit actions', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'test', 'skill_editor_test_v3.html'), 'utf8');
  for (const label of ['我方技能', '敌方技能', '打开技能包', '最近版本', '打开版本', '刷新', '指定路径', '打开路径', '从本地导入', 'Buff', '同目录自动加载', '手动加载 Buff', '编辑', '技能库', '新建技能', '自动布局', '清空', '保存与发布', '保存工作稿', '发布到主流程', '另存到指定路径', '下载备份']) {
    assert.match(html, new RegExp(label), `toolbar should include ${label}`);
  }
  for (const retiredLabel of ['>加载项目<', '>加载版本<', '>导入本地<', '>加载 Buff<', '>另存为<', '>下载\\s*<']) {
    assert.doesNotMatch(html, new RegExp(retiredLabel), `toolbar should not include ambiguous retired label ${retiredLabel}`);
  }
  assert.match(
    html,
    /打开技能包[\s\S]*最近版本[\s\S]*打开版本[\s\S]*刷新[\s\S]*指定路径[\s\S]*打开路径[\s\S]*从本地导入[\s\S]*Buff[\s\S]*手动加载 Buff[\s\S]*编辑[\s\S]*技能库[\s\S]*新建技能[\s\S]*自动布局[\s\S]*清空[\s\S]*保存与发布[\s\S]*保存工作稿[\s\S]*发布到主流程[\s\S]*另存到指定路径[\s\S]*下载备份/u,
    'toolbar should follow the approved topbar grouping order'
  );
  assert.doesNotMatch(
    html,
    />\s*(Load Buffs|Skills|Load Project|Import Local|New Skill|Save As|Download|Clear|Auto Layout)\b/,
    'toolbar should not expose English action labels'
  );
  assert.match(html, /<div class="toolbar-title-row">[\s\S]*id="skill-domain-toggle"[\s\S]*>我方技能<\/button>/u);
  assert.doesNotMatch(
    html,
    /<section class="toolbar-group toolbar-group-open"[\s\S]*id="skill-domain-(?:select|toggle)"/u,
    'domain switch should stay in the title row instead of increasing the open-pack group height'
  );
});
