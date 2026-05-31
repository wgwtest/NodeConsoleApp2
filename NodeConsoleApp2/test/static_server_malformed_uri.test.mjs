import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function getFreePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${child.exitCode}`);
    try {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('error', reject);
      });
      socket.destroy();
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
  throw new Error('server did not start');
}

function rawHttpRequest(port, requestText) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let response = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(requestText));
    socket.on('data', chunk => {
      response += chunk;
    });
    socket.on('end', () => resolve(response));
    socket.on('error', reject);
    socket.setTimeout(3000, () => {
      socket.destroy(new Error('socket timeout'));
    });
  });
}

function httpGet(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method: 'GET'
    }, response => {
      response.resume();
      response.on('end', () => resolve(response));
    });
    request.on('error', reject);
    request.end();
  });
}

async function withAppServer(callback) {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['app.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(port, child);
    await callback({ port, child });
  } finally {
    if (child.exitCode === null) child.kill();
  }
}

test('static server returns 400 for malformed URI instead of crashing', async () => {
  await withAppServer(async ({ port, child }) => {
    const response = await rawHttpRequest(
      port,
      'GET /%E0%A4%A HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n'
    );
    await new Promise(resolve => setTimeout(resolve, 80));

    assert.match(response, /^HTTP\/1\.1 400 Bad Request/m);
    assert.equal(child.exitCode, null);
  });
});

test('static server serves ES modules with a JavaScript MIME type', async () => {
  await withAppServer(async ({ port }) => {
    const response = await httpGet(port, '/script/editor/skill_tester/skillTesterApp.mjs');
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'] || '', /^text\/javascript\b/u);
  });
});
