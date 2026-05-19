import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packageDir = path.resolve(process.cwd(), 'DOC/CODEX_DOC/08_原型与附图/2026-05-19-004500-NodeConsoleApp2-技能树双层视角原型-v1');
const htmlPath = path.join(packageDir, 'source', 'skilltree-lod-prototype.html');
const outDir = packageDir;
const reportPath = path.join(outDir, 'prototype-report.json');
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9450);
const chromePath = resolveChrome();

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Google Chrome executable not found. Set CHROME_PATH.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function waitForJson(url, timeoutMs = 8000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
      await sleep(120);
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 12000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function evalExpr(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result.value;
}

async function captureState(state, fileName) {
  const url = pathToFileURL(htmlPath).href + `?state=${encodeURIComponent(state)}`;
  const target = await fetchJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT'
  });
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(500);
  await evalExpr(cdp, 'window.__PROTOTYPE_READY__ === true');
  const report = await evalExpr(cdp, `({
    viewport: { width: innerWidth, height: innerHeight },
    body: { width: document.body.scrollWidth, height: document.body.scrollHeight },
    whiteBottomProbe: getComputedStyle(document.body).backgroundColor
  })`);
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  await writeFile(path.join(outDir, fileName), Buffer.from(shot.data, 'base64'));
  cdp.close();
  return report;
}

await mkdir(outDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${debugPort}`,
  '--window-size=1920,1080',
  'about:blank'
], { stdio: 'ignore' });

try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const screenshots = [
    {
      state: 'global',
      fileName: '01-skilltree-global-structure-1920x1080.png',
      label: 'global structure'
    },
    {
      state: 'selected',
      fileName: '02-skilltree-selected-reading-1920x1080.png',
      label: 'selected reading'
    }
  ];

  for (const item of screenshots) {
    item.report = await captureState(item.state, item.fileName);
  }

  await writeFile(reportPath, JSON.stringify({
    viewport: { width: 1920, height: 1080 },
    screenshots
  }, null, 2));
} finally {
  chrome.kill('SIGTERM');
}
