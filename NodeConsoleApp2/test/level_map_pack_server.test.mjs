import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';

const projectRoot = path.resolve(import.meta.dirname, '..');
const appPath = path.join(projectRoot, 'app.js');

function requestJson(server, pathname, body) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      }
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        text += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          body: text ? JSON.parse(text) : null
        });
      });
    });
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });
}

test('地图包保存接口只允许写入 authoring/current 地图包目录', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodeconsole-map-pack-'));
  const previousSkipListen = process.env.NODECONSOLEAPP2_SKIP_LISTEN;
  process.env.NODECONSOLEAPP2_SKIP_LISTEN = '1';
  const previousCwd = process.cwd();
  process.chdir(tempDir);
  try {
    const appModule = await import(`${pathToFileURL(appPath).href}?test=${Date.now()}`);
    const { createServer, writeLevelMapPackage, isAllowedMapPackDirectory } = appModule.default || appModule;
    assert.equal(isAllowedMapPackDirectory('assets/map_packs/authoring/story_pack_v1/'), true);
    assert.equal(isAllowedMapPackDirectory('assets/map_packs/current/story_pack_v1/'), true);
    assert.equal(isAllowedMapPackDirectory('assets/data/'), false);

    await writeLevelMapPackage({
      targetDirectory: 'assets/map_packs/authoring/story_pack_v1/',
      files: [
        { fileName: 'package.json', content: '{"packageId":"story_pack_v1"}' },
        { fileName: 'maps.json', content: '{"$schemaVersion":"level_map_pack_v1"}' },
        { fileName: 'asset-manifest.json', content: '{"backgrounds":[]}' }
      ]
    });

    const packageJson = await fs.readFile(path.join(tempDir, 'assets/map_packs/authoring/story_pack_v1/package.json'), 'utf8');
    assert.equal(JSON.parse(packageJson).packageId, 'story_pack_v1');

    const resultWithLevels = await writeLevelMapPackage({
      targetDirectory: 'assets/map_packs/authoring/story_pack_with_levels/',
      files: [
        { fileName: 'package.json', content: '{"packageId":"story_pack_with_levels","files":{"maps":"maps.json","levels":"levels.json"}}' },
        { fileName: 'maps.json', content: '{"$schemaVersion":"level_map_pack_v1"}' },
        { fileName: 'levels.json', content: '{"$schemaVersion":"levels_v1_wrapped","levels":{},"enemyPools":{}}' },
        { fileName: 'asset-manifest.json', content: '{"backgrounds":[]}' }
      ]
    });
    assert.deepEqual(resultWithLevels.writtenFiles, ['package.json', 'maps.json', 'levels.json', 'asset-manifest.json']);
    const levelsJson = await fs.readFile(path.join(tempDir, 'assets/map_packs/authoring/story_pack_with_levels/levels.json'), 'utf8');
    assert.equal(JSON.parse(levelsJson).$schemaVersion, 'levels_v1_wrapped');

    await assert.rejects(
      () => writeLevelMapPackage({
        targetDirectory: 'assets/data/',
        files: [{ fileName: 'package.json', content: '{}' }]
      }),
      /不允许写入/u
    );

    const server = createServer();
    server.listen(0);
    await once(server, 'listening');
    try {
      const response = await requestJson(server, '/api/level-map-packs/publish', {
        targetDirectory: 'assets/map_packs/current/story_pack_v1/',
        files: [
          { fileName: 'package.json', content: '{"packageId":"story_pack_v1"}' },
          { fileName: 'maps.json', content: '{"$schemaVersion":"level_map_pack_v1"}' },
          { fileName: 'asset-manifest.json', content: '{"backgrounds":[]}' }
        ]
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body.writtenFiles, ['package.json', 'maps.json', 'asset-manifest.json']);
    } finally {
      server.close();
      await once(server, 'close');
    }
  } finally {
    process.chdir(previousCwd);
    if (previousSkipListen === undefined) {
      delete process.env.NODECONSOLEAPP2_SKIP_LISTEN;
    } else {
      process.env.NODECONSOLEAPP2_SKIP_LISTEN = previousSkipListen;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
