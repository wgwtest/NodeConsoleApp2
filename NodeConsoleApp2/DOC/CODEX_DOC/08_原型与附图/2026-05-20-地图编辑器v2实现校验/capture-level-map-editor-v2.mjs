import { writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const endpoint = process.env.APP_URL || 'http://127.0.0.1:3121/test/level_map_editor_v1.html';
const outDir = path.resolve(process.cwd(), 'DOC/CODEX_DOC/08_原型与附图/2026-05-20-地图编辑器v2实现校验');
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9462);

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

async function screenshot(cdp, fileName) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  await writeFile(path.join(outDir, fileName), Buffer.from(shot.data, 'base64'));
}

await mkdir(outDir, { recursive: true });

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
  const target = await fetchJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(endpoint)}`, {
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
  await sleep(1600);
  await screenshot(cdp, '01-editor-node-list.png');
  await evalExpr(cdp, `document.getElementById('edgeInspectorBtn')?.click()`);
  await sleep(500);
  await screenshot(cdp, '02-editor-edge-list.png');
  await evalExpr(cdp, `document.getElementById('openBackgroundPickerBtn')?.click()`);
  await sleep(500);
  await screenshot(cdp, '03-background-picker.png');
  await evalExpr(cdp, `document.getElementById('cancelBackgroundPickerBtn')?.click()`);
  await sleep(250);
  await evalExpr(cdp, `document.getElementById('saveMapBtn')?.click()`);
  await sleep(500);
  await screenshot(cdp, '04-apply-map-settings.png');
  await evalExpr(cdp, `document.getElementById('cancelMapSettingsBtn')?.click()`);
  await sleep(250);
  await evalExpr(cdp, `document.getElementById('exportMapBtn')?.click()`);
  await sleep(500);
  await screenshot(cdp, '05-export-writeback.png');
  const report = await evalExpr(cdp, `({
    viewport: { width: innerWidth, height: innerHeight },
    leftWidth: getComputedStyle(document.documentElement).getPropertyValue('--drawer-left-width').trim(),
    rightWidth: getComputedStyle(document.documentElement).getPropertyValue('--drawer-right-width').trim(),
    nodeListCount: document.querySelectorAll('#nodeList button').length,
    edgeListCount: document.querySelectorAll('#edgeList button').length,
    hasBackgroundButton: !!document.getElementById('openBackgroundPickerBtn'),
    exportText: document.getElementById('exportMapDialog')?.innerText || ''
  })`);
  await writeFile(path.join(outDir, 'capture-report.json'), JSON.stringify(report, null, 2));
  cdp.close();
} finally {
  chrome.kill('SIGTERM');
}
