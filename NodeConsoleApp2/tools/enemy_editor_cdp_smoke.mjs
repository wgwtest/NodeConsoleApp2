import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3124';
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9463);
const chromePath = resolveChrome();
const outputDir = path.resolve('DOC/CODEX_DOC/08_原型与附图/2026-05-24-敌人编辑器工作区原型-v1');

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome executable not found. Set CHROME_PATH.');
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
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
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

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  `--remote-debugging-port=${debugPort}`,
  '--window-size=1920,1080',
  'about:blank'
], { stdio: 'ignore' });

try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const url = `${baseUrl}/test/enemy_editor_v1.html`;
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
  await sleep(1100);
  const report = await evalExpr(cdp, `({
    title: document.title,
    status: document.getElementById('status')?.textContent || '',
    enemyListText: document.getElementById('enemyList')?.textContent || '',
    previewName: document.getElementById('mapPreviewName')?.textContent || '',
    previewPortrait: document.getElementById('mapPreviewPortrait')?.getAttribute('src') || '',
    issueText: document.getElementById('issueList')?.textContent || '',
    viewport: { width: innerWidth, height: innerHeight },
    body: { width: document.body.scrollWidth, height: document.body.scrollHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
  })`);

  if (!report.enemyListText.includes('哥布林') && !report.enemyListText.includes('goblin')) {
    throw new Error(`Enemy list did not render expected content: ${report.enemyListText.slice(0, 120)}`);
  }
  if (!report.previewName || report.previewName === '未选择敌人') {
    throw new Error('Map preview did not render selected enemy.');
  }
  if (report.previewName === '哥布林战士' && !report.previewPortrait.includes('enemy_goblin_warrior.svg')) {
    throw new Error(`Goblin warrior preview used the wrong portrait: ${report.previewPortrait}`);
  }
  await mkdir(outputDir, { recursive: true });
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  const fileName = '02-1920x1080-敌人编辑器实现页面-smoke.png';
  await writeFile(path.join(outputDir, fileName), Buffer.from(shot.data, 'base64'));
  await writeFile(path.join(outputDir, 'enemy-editor-smoke-report.json'), JSON.stringify({
    url,
    screenshot: fileName,
    ...report
  }, null, 2));
  await cdp.send('Page.close').catch(() => {});
  cdp.close();
  console.log(JSON.stringify({ ok: true, url, screenshot: fileName, previewName: report.previewName }, null, 2));
} finally {
  chrome.kill('SIGTERM');
}
