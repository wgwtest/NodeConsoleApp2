import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const endpoint = process.env.APP_URL || 'http://127.0.0.1:3122/mock_ui_v11.html';
const outDir = path.resolve(process.cwd(), 'DOC/CODEX_DOC/08_原型与附图/2026-05-18-234717-NodeConsoleApp2-技能树视觉优化草图-v1/original');
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9333);

const { spawn } = await import('node:child_process');

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
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
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
  await screenshot(cdp, '01-current-main-1920x1080.png');

  await evalExpr(cdp, `
    (async () => {
      const btn = document.getElementById('btnOpenSkillTree');
      btn?.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise(resolve => requestAnimationFrame(resolve));
      btn?.click();
      await new Promise(resolve => setTimeout(resolve, 900));
      return {
        hasButton: !!btn,
        overlayHidden: document.getElementById('skillTreeOverlay')?.getAttribute('aria-hidden'),
        bodyText: document.getElementById('skillTreeBody')?.innerText?.slice(0, 500)
      };
    })()
  `);
  await sleep(1200);
  await screenshot(cdp, '02-current-skilltree-overview-1920x1080.png');

  const selected = await evalExpr(cdp, `
    (async () => {
      const initialNodes = Array.from(document.querySelectorAll('.ui-skilltree__node'));
      const learnable = initialNodes.find(node => node.classList.contains('ui-skilltree__node--learnable'));
      const locked = initialNodes.find(node => node.classList.contains('ui-skilltree__node--locked'));
      const firstNode = initialNodes[0];
      const target = learnable || locked || firstNode;
      target?.click();
      await new Promise(resolve => setTimeout(resolve, 250));
      const nodes = Array.from(document.querySelectorAll('.ui-skilltree__node'));
      const overlay = document.getElementById('skillTreeOverlay')?.getBoundingClientRect();
      const canvas = document.querySelector('.ui-skilltree__canvasWrap')?.getBoundingClientRect();
      const detail = document.querySelector('.ui-skilltree__detail')?.getBoundingClientRect();
      const nodeRects = nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return {
          id: node.dataset.skillId,
          text: node.innerText,
          className: node.className,
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          visibleInViewport: rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight
        };
      });
      return {
        viewport: { width: innerWidth, height: innerHeight },
        overlay: overlay && { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height },
        canvas: canvas && { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height },
        detail: detail && { left: detail.left, top: detail.top, width: detail.width, height: detail.height },
        nodeCount: nodes.length,
        visibleNodeCount: nodeRects.filter(n => n.visibleInViewport).length,
        nodeRects,
        selectedText: target?.innerText || ''
      };
    })()
  `);
  await screenshot(cdp, '03-current-skilltree-selected-1920x1080.png');
  await writeFile(path.join(outDir, 'current-skilltree-dom-report.json'), JSON.stringify(selected, null, 2));

  cdp.close();
} finally {
  chrome.kill('SIGTERM');
}
