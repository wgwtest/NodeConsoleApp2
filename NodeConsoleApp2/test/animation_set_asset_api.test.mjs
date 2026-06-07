import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lG7X4wAAAABJRU5ErkJggg==';

async function getFreePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(baseUrl);
      if (res.status === 403 || res.status === 404 || res.ok) return;
    } catch {
      // Retry until the child starts listening.
    }
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error('server did not start');
}

async function waitForChildExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(resolve, 2000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function withTempServer(t, callback) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'animation-set-api-'));
  await fs.mkdir(path.join(tempRoot, 'source', 'character', 'fixture-walk'), { recursive: true });
  for (let index = 1; index <= 3; index += 1) {
    await fs.writeFile(
      path.join(tempRoot, 'source', 'character', 'fixture-walk', `walk_${index}.png`),
      Buffer.from(tinyPngBase64, 'base64')
    );
  }

  const port = await getFreePort();
  const child = spawn(process.execPath, [path.join(projectRoot, 'app.js')], {
    cwd: tempRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    child.kill();
    await waitForChildExit(child);
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, child);
  await callback({ baseUrl, tempRoot });
}

test('animation asset API lists frame directories and writes generated sheet assets', async t => {
  await withTempServer(t, async ({ baseUrl, tempRoot }) => {
    await fs.mkdir(path.join(tempRoot, 'source', 'character', 'empty-dir'), { recursive: true });
    const listRes = await fetch(`${baseUrl}/api/animation-assets/frames?dir=source/character/fixture-walk`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.ok, true);
    assert.equal(listBody.directory, 'source/character/fixture-walk');
    assert.equal(listBody.frameCount, 3);
    assert.deepEqual(listBody.frames.map(frame => frame.name), ['walk_1.png', 'walk_2.png', 'walk_3.png']);

    const dirRes = await fetch(`${baseUrl}/api/animation-assets/frame-directories?root=source/character`);
    assert.equal(dirRes.status, 200);
    const dirBody = await dirRes.json();
    assert.equal(dirBody.ok, true);
    assert.equal(dirBody.root, 'source/character');
    assert.deepEqual(dirBody.directories.map(item => item.directory), ['source/character/fixture-walk']);
    assert.equal(dirBody.directories[0].frameCount, 3);

    const writeRes = await fetch(`${baseUrl}/api/animation-assets/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [
          {
            path: 'source/character/fixture-walk/walk_sheet.png',
            encoding: 'base64',
            content: tinyPngBase64
          },
          {
            path: 'source/character/fixture-walk/walk_sheet.json',
            encoding: 'utf8',
            content: JSON.stringify({ id: 'fixture_walk', frameCount: 3 }, null, 2)
          }
        ]
      })
    });
    assert.equal(writeRes.status, 200);
    const writeBody = await writeRes.json();
    assert.equal(writeBody.ok, true);
    assert.deepEqual(writeBody.files.map(file => file.path), [
      'source/character/fixture-walk/walk_sheet.png',
      'source/character/fixture-walk/walk_sheet.json'
    ]);

    const manifest = JSON.parse(await fs.readFile(path.join(tempRoot, 'source', 'character', 'fixture-walk', 'walk_sheet.json'), 'utf8'));
    assert.equal(manifest.frameCount, 3);

    const localSource = path.join(tempRoot, 'local-picked-walk');
    await fs.mkdir(localSource, { recursive: true });
    await fs.writeFile(path.join(localSource, 'walk_1.png'), Buffer.from(tinyPngBase64, 'base64'));
    await fs.writeFile(path.join(localSource, 'walk_2.png'), Buffer.from(tinyPngBase64, 'base64'));

    const importRes = await fetch(`${baseUrl}/api/animation-assets/import-local-directory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceDirectory: localSource,
        targetName: 'uploaded-walk'
      })
    });
    assert.equal(importRes.status, 200);
    const importBody = await importRes.json();
    assert.equal(importBody.ok, true);
    assert.equal(importBody.directory, 'source/character/uploaded-walk');
    assert.equal(importBody.frameCount, 2);
    assert.deepEqual(importBody.files.map(file => file.path), [
      'source/character/uploaded-walk/walk_1.png',
      'source/character/uploaded-walk/walk_2.png'
    ]);
    await fs.access(path.join(tempRoot, 'source', 'character', 'uploaded-walk', 'walk_1.png'));

    await fs.writeFile(path.join(tempRoot, 'source', 'character', 'uploaded-walk', 'walk_sheet.png'), Buffer.from(tinyPngBase64, 'base64'));
    await fs.writeFile(path.join(tempRoot, 'source', 'character', 'uploaded-walk', 'walk_sheet.json'), JSON.stringify({ frameCount: 2 }));
    const deleteRes = await fetch(`${baseUrl}/api/animation-assets/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paths: [
          'source/character/uploaded-walk',
          '../source/character/uploaded-walk/walk_sheet.png',
          '../source/character/uploaded-walk/walk_sheet.json'
        ]
      })
    });
    assert.equal(deleteRes.status, 200);
    const deleteBody = await deleteRes.json();
    assert.equal(deleteBody.ok, true);
    assert.deepEqual(deleteBody.deleted.map(item => item.path).sort(), [
      'source/character/uploaded-walk',
      'source/character/uploaded-walk/walk_sheet.json',
      'source/character/uploaded-walk/walk_sheet.png'
    ]);
    await assert.rejects(
      fs.access(path.join(tempRoot, 'source', 'character', 'uploaded-walk')),
      /ENOENT/
    );
  });
});

test('animation asset API rejects traversal and non-animation output paths', async t => {
  await withTempServer(t, async ({ baseUrl }) => {
    const badList = await fetch(`${baseUrl}/api/animation-assets/frames?dir=../outside`);
    assert.equal(badList.status, 400);

    const badDirs = await fetch(`${baseUrl}/api/animation-assets/frame-directories?root=../outside`);
    assert.equal(badDirs.status, 400);

    const badImport = await fetch(`${baseUrl}/api/animation-assets/import-local-directory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceDirectory: 'source/character/fixture-walk',
        targetName: '../outside'
      })
    });
    assert.equal(badImport.status, 400);

    const badWrite = await fetch(`${baseUrl}/api/animation-assets/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{ path: 'assets/data/not_allowed.png', encoding: 'base64', content: tinyPngBase64 }]
      })
    });
    assert.equal(badWrite.status, 400);

    const badDelete = await fetch(`${baseUrl}/api/animation-assets/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: ['../outside'] })
    });
    assert.equal(badDelete.status, 400);
  });
});
