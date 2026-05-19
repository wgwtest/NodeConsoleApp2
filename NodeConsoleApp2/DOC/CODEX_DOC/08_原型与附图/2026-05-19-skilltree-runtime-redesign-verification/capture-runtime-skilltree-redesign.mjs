import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const endpoint = process.env.APP_URL || 'http://127.0.0.1:3122/mock_ui_v11.html';
const outDir = path.resolve(process.cwd(), 'DOC/CODEX_DOC/08_原型与附图/2026-05-19-skilltree-runtime-redesign-verification');
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9444);

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

  await sleep(2200);
  await evalExpr(cdp, `
    (async () => {
      const btn = document.getElementById('btnOpenSkillTree');
      btn?.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise(resolve => requestAnimationFrame(resolve));
      btn?.click();
      const started = Date.now();
      while (Date.now() - started < 5000) {
        const tree = document.querySelector('.ui-skilltree');
        const nodes = document.querySelectorAll('.ui-skilltree__node');
        if (tree && nodes.length > 0) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return {
        hidden: document.getElementById('skillTreeOverlay')?.getAttribute('aria-hidden'),
        nodeCount: document.querySelectorAll('.ui-skilltree__node').length
      };
    })()
  `);
  await sleep(800);
  await screenshot(cdp, '01-runtime-skilltree-overview-1920x1080.png');

  const report = await evalExpr(cdp, `
    (async () => {
      const target = document.querySelector('[data-skill-id="skill_1771769351059"]')
        || document.querySelector('.ui-skilltree__node--route-blood')
        || document.querySelector('.ui-skilltree__node');
      target?.click();
      await new Promise(resolve => setTimeout(resolve, 350));
      const nodes = Array.from(document.querySelectorAll('.ui-skilltree__node'));
      const overlay = document.getElementById('skillTreeOverlay')?.getBoundingClientRect();
      const content = document.querySelector('.ui-skilltree__content')?.getBoundingClientRect();
      const canvas = document.querySelector('.ui-skilltree__canvasViewport')?.getBoundingClientRect();
      const detail = document.querySelector('.ui-skilltree__decisionPanel')?.getBoundingClientRect();
      const selected = document.querySelector('.ui-skilltree__node.is-selected')?.getBoundingClientRect();
      const chain = document.querySelector('.ui-skilltree__chain')?.getBoundingClientRect();
      const actions = document.querySelector('.ui-skilltree__actions')?.getBoundingClientRect();
      const treeText = document.querySelector('.ui-skilltree')?.innerText || '';
      return {
        viewport: { width: innerWidth, height: innerHeight },
        overlay: overlay && { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height },
        content: content && { left: content.left, top: content.top, width: content.width, height: content.height },
        canvas: canvas && { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height },
        detail: detail && { left: detail.left, top: detail.top, width: detail.width, height: detail.height },
        selected: selected && { left: selected.left, top: selected.top, right: selected.right, bottom: selected.bottom },
        chain: chain && { left: chain.left, top: chain.top, right: chain.right, bottom: chain.bottom, height: chain.height },
        actions: actions && { left: actions.left, top: actions.top, right: actions.right, bottom: actions.bottom, height: actions.height },
        actionsOverlapChain: !!(chain && actions && actions.top < chain.bottom && actions.bottom > chain.top),
        nodeCount: nodes.length,
        hiddenRuntimeTextPresent: /单攻测试|多攻测试|验收轻击|等待/.test(treeText),
        selectedText: document.querySelector('.ui-skilltree__decisionPanel')?.innerText || '',
        transform: document.querySelector('.ui-skilltree__transform')?.style.transform || ''
      };
    })()
  `);
  await screenshot(cdp, '02-runtime-skilltree-selected-path-1920x1080.png');
  await writeFile(path.join(outDir, 'runtime-skilltree-redesign-report.json'), JSON.stringify(report, null, 2));
  cdp.close();
} finally {
  chrome.kill('SIGTERM');
}
