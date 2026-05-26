import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3101';
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9464);
const skillPackPath = 'assets/skill_packs/authoring/skills_melee_v4_5_growth_v1_20260526_000000.json';
const outputDir = path.resolve('test-results');
const screenshotPath = path.join(outputDir, 'skill-growth-tree-v1-editor-1920x1080.png');
const reportPath = path.join(outputDir, 'skill-growth-tree-v1-editor-report.json');

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
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result.value;
}

const chrome = spawn(resolveChrome(), [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  `--remote-debugging-port=${debugPort}`,
  '--window-size=1920,1080',
  'about:blank'
], { stdio: 'ignore' });

let cdp = null;

try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const url = `${baseUrl}/test/skill_editor_test_v3.html`;
  const target = await fetchJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT'
  });
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  await sleep(1000);
  const report = await evalExpr(cdp, `(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const waitFor = async (predicate, label, timeoutMs = 12000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const value = predicate();
        if (value) return value;
        await sleep(120);
      }
      throw new Error('等待超时：' + label);
    };
    await waitFor(() => window.editor && typeof window.editor.loadProjectSkillPack === 'function', 'editor bootstrap');
    await window.editor.loadProjectSkillPack(${JSON.stringify(skillPackPath)});
    await waitFor(() => document.querySelectorAll('.skill-node').length >= 30, 'growth skill nodes');
    window.editor.zoom = 0.68;
    window.editor.pan = { x: 20, y: 55 };
    window.editor.updateTransform();
    window.editor.renderNodes();
    await sleep(600);
    const tracks = {};
    for (const skill of window.editor.skills || []) {
      const key = skill.editorMeta?.growthTrack || 'unknown';
      tracks[key] = (tracks[key] || 0) + 1;
    }
    const nodes = [...document.querySelectorAll('.skill-node')].map(node => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.dataset.id,
        text: node.textContent.trim().replace(/\\s+/g, ' '),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    });
    return {
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      status: document.getElementById('project-file-status')?.textContent || '',
      path: document.getElementById('project-file-path')?.value || '',
      skillCount: window.editor.skills?.length || 0,
      nodeCount: nodes.length,
      connectionCount: document.querySelectorAll('#connection-layer polyline').length,
      tracks,
      firstNodeTexts: nodes.slice(0, 8).map(node => node.text),
      body: {
        width: document.body.scrollWidth,
        height: document.body.scrollHeight
      }
    };
  })()`);

  if (report.viewport.width !== 1920 || report.viewport.height !== 1080) {
    throw new Error(`Viewport mismatch: ${JSON.stringify(report.viewport)}`);
  }
  if (!report.status.includes(skillPackPath)) {
    throw new Error(`Editor did not load growth pack: ${report.status}`);
  }
  if (report.skillCount < 30 || report.nodeCount < 30) {
    throw new Error(`Too few skills rendered: ${report.skillCount}/${report.nodeCount}`);
  }
  if (report.connectionCount < 30) {
    throw new Error(`Too few skill tree connections rendered: ${report.connectionCount}`);
  }
  for (const key of ['sword', 'hammer', 'spell', 'defense', 'tempo']) {
    if (!report.tracks[key]) throw new Error(`Missing rendered growth track: ${key}`);
  }

  await mkdir(outputDir, { recursive: true });
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  await writeFile(reportPath, JSON.stringify({ url, screenshotPath, skillPackPath, ...report }, null, 2));
  await cdp.send('Page.close').catch(() => {});
  console.log(JSON.stringify({ ok: true, url, screenshotPath, skillCount: report.skillCount, tracks: report.tracks }, null, 2));
} finally {
  if (cdp) cdp.close();
  chrome.kill('SIGTERM');
}
