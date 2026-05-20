import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const outputDir = path.join(packageDir, 'runtime-verification');
const targetUrl = process.env.SKILLTREE_URL || 'http://127.0.0.1:3122/mock_ui_v11.html';
const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const viewport = { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false };

fs.mkdirSync(outputDir, { recursive: true });

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

class CDP {
	constructor(wsUrl) {
		this.ws = new WebSocket(wsUrl);
		this.id = 0;
		this.pending = new Map();
		this.ws.addEventListener('message', event => {
			const msg = JSON.parse(event.data);
			if (!msg.id || !this.pending.has(msg.id)) return;
			const { resolve, reject } = this.pending.get(msg.id);
			this.pending.delete(msg.id);
			if (msg.error) reject(new Error(`${msg.error.message}: ${JSON.stringify(msg.error.data || '')}`));
			else resolve(msg.result || {});
		});
	}

	open() {
		return new Promise((resolve, reject) => {
			this.ws.addEventListener('open', resolve, { once: true });
			this.ws.addEventListener('error', reject, { once: true });
		});
	}

	send(method, params = {}) {
		const id = ++this.id;
		this.ws.send(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
	}

	close() {
		this.ws.close();
	}
}

async function waitForChromePage(userDataDir) {
	const devtoolsFile = path.join(userDataDir, 'DevToolsActivePort');
	for (let i = 0; i < 100; i += 1) {
		if (fs.existsSync(devtoolsFile)) {
			const [port] = fs.readFileSync(devtoolsFile, 'utf8').trim().split(/\n/);
			const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
			return list.find(target => target.type === 'page') || list[0];
		}
		await sleep(100);
	}
	throw new Error('Chrome DevTools endpoint was not created.');
}

async function createPage() {
	const userDataDir = path.join('/tmp', `skilltree-runtime-verify-${Date.now()}`);
	fs.mkdirSync(userDataDir, { recursive: true });
	const chrome = spawn(chromePath, [
		'--headless=new',
		'--disable-gpu',
		'--no-sandbox',
		'--disable-dev-shm-usage',
		'--hide-scrollbars',
		'--force-device-scale-factor=1',
		'--remote-debugging-port=0',
		`--user-data-dir=${userDataDir}`,
		'about:blank'
	], { stdio: ['ignore', 'ignore', 'pipe'] });

	try {
		const target = await waitForChromePage(userDataDir);
		const page = new CDP(target.webSocketDebuggerUrl);
		await page.open();
		await page.send('Page.enable');
		await page.send('Runtime.enable');
		await page.send('DOM.enable');
		await page.send('Emulation.setDeviceMetricsOverride', viewport);
		return { page, chrome };
	} catch (error) {
		chrome.kill('SIGTERM');
		throw error;
	}
}

async function evaluate(page, expression, awaitPromise = true) {
	const result = await page.send('Runtime.evaluate', {
		expression,
		awaitPromise,
		returnByValue: true,
		userGesture: true
	});
	if (result.exceptionDetails) {
		throw new Error(`Evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
	}
	return result.result?.value;
}

async function waitFor(page, expression, timeout = 25000) {
	const started = Date.now();
	let lastValue = null;
	while (Date.now() - started < timeout) {
		try {
			lastValue = await evaluate(page, expression);
			if (lastValue) return lastValue;
		} catch (error) {
			lastValue = error.message;
		}
		await sleep(200);
	}
	throw new Error(`Timed out waiting for ${expression}. Last value: ${JSON.stringify(lastValue)}`);
}

function assertCondition(condition, message) {
	if (!condition) throw new Error(message);
}

function getPngSize(buffer) {
	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20)
	};
}

async function writeScreenshot(page, filename) {
	const shot = await page.send('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	const buffer = Buffer.from(shot.data, 'base64');
	const size = getPngSize(buffer);
	assertCondition(size.width === viewport.width && size.height === viewport.height, `Screenshot size mismatch: ${size.width}x${size.height}`);
	fs.writeFileSync(path.join(outputDir, filename), buffer);
	return size;
}

async function openRepresentativeSkillTree(page) {
	await page.send('Page.navigate', { url: `${targetUrl}?runtime_v3=${Date.now()}` });
	await waitFor(page, 'document.readyState === "complete"');
	await waitFor(page, `(() => (
		!!window.GameEngine
		&& window.GameEngine.fsm?.currentState === 'LOGIN'
		&& Array.isArray(window.GameEngine.data?.getSkillCatalog?.().skillsList)
		&& window.GameEngine.data.getSkillCatalog().skillsList.length >= 30
	))()`);
	await evaluate(page, `(() => {
		window.GameEngine.login('CodexVisualCheck');
		const skills = window.GameEngine.data.playerData.skills;
		skills.skillTreeId = 'melee_v4_5';
		skills.skillPoints = 4;
		skills.learned = ['skill_block', 'skill_savage_charge', 'skill_heavy_swing', 'skill_skull_cracker'];
		return true;
	})()`);
	await waitFor(page, `(() => !!window.GameEngine.data.playerData?.skills && window.GameEngine.fsm?.currentState === 'MAIN_MENU')()`);
	await evaluate(page, `(() => {
		window.GameEngine.eventBus.emit('UI:OPEN_SKILL_TREE', { source: 'MAIN_MENU' });
		return true;
	})()`);
	await waitFor(page, 'document.querySelector("#skillTreeOverlay.visible") && document.querySelectorAll(".ui-skilltree__node").length >= 30');
	await sleep(900);
}

async function collectMetrics(page) {
	return evaluate(page, `(() => {
		const root = document.querySelector('.ui-skilltree');
		const transform = document.querySelector('.ui-skilltree__transform');
		const canvas = document.querySelector('.ui-skilltree__connections');
		const viewportRect = document.querySelector('.ui-skilltree__canvasViewport')?.getBoundingClientRect();
		const railText = document.querySelector('.ui-skilltree__routeRail')?.textContent || '';
		const nodes = [...document.querySelectorAll('.ui-skilltree__node')].map(node => {
			const rect = node.getBoundingClientRect();
			const title = node.querySelector('.ui-skilltree__nodeTitle')?.getBoundingClientRect();
			const cost = node.querySelector('.ui-skilltree__nodeCost')?.getBoundingClientRect();
			const action = node.querySelector('.ui-skilltree__nodeAction')?.getBoundingClientRect();
			const status = node.querySelector('.ui-skilltree__nodeStatus')?.getBoundingClientRect();
			return {
				id: node.dataset.skillId || '',
				state: node.dataset.status || '',
				label: node.dataset.stateLabel || '',
				text: node.querySelector('.ui-skilltree__nodeTitle')?.textContent || '',
				rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
				title: title ? { left: title.left, top: title.top, right: title.right, bottom: title.bottom } : null,
				cost: cost ? { left: cost.left, top: cost.top, right: cost.right, bottom: cost.bottom } : null,
				action: action ? { left: action.left, top: action.top, right: action.right, bottom: action.bottom } : null,
				status: status ? { left: status.left, top: status.top, right: status.right, bottom: status.bottom } : null,
				hasAction: !!action
			};
		});
		const intersection = (a, b) => {
			if (!a || !b) return 0;
			const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
			const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
			return x * y;
		};
		const overlaps = [];
		for (let i = 0; i < nodes.length; i += 1) {
			for (let j = i + 1; j < nodes.length; j += 1) {
				const area = intersection(nodes[i].rect, nodes[j].rect);
				if (area > 4) overlaps.push([nodes[i].id, nodes[j].id, Math.round(area)]);
			}
		}
		const stateCounts = nodes.reduce((acc, n) => {
			acc[n.state] = (acc[n.state] || 0) + 1;
			return acc;
		}, {});
		return {
			url: location.href,
			screenshot: 'runtime-skilltree-v3-1920x1080.png',
			viewport: viewportRect ? { width: viewportRect.width, height: viewportRect.height } : null,
			lod: root?.dataset.lod || null,
			transform: transform?.style.transform || '',
			railText,
			learnedEdgeCount: Number(canvas?.dataset.learnedEdgeCount || 0),
			count: nodes.length,
			stateCounts,
			overlapCount: overlaps.length,
			overlaps,
			titleCostOverlaps: nodes.filter(n => intersection(n.title, n.cost) > 1).map(n => n.id),
			titleActionOverlaps: nodes.filter(n => intersection(n.title, n.action) > 1).map(n => n.id),
			titleStatusOverlaps: nodes.filter(n => intersection(n.title, n.status) > 1).map(n => n.id),
			actionCount: nodes.filter(n => n.hasAction).length,
			sample: nodes.slice(0, 10)
		};
	})()`);
}

function verifyMetrics(metrics) {
	assertCondition(metrics.count === 32, `Expected 32 visible skill nodes, got ${metrics.count}`);
	assertCondition(metrics.lod === 'structure', `Expected default LOD to be structure, got ${metrics.lod}`);
	assertCondition(metrics.overlapCount === 0, `Expected no node overlap, got ${metrics.overlapCount}`);
	assertCondition(metrics.titleCostOverlaps.length === 0, `Title/cost overlap: ${metrics.titleCostOverlaps.join(', ')}`);
	assertCondition(metrics.titleActionOverlaps.length === 0, `Title/action overlap: ${metrics.titleActionOverlaps.join(', ')}`);
	assertCondition(metrics.titleStatusOverlaps.length === 0, `Title/status overlap: ${metrics.titleStatusOverlaps.join(', ')}`);
	assertCondition(metrics.actionCount > 0, 'Expected learnable nodes to expose direct plus actions.');
	assertCondition(metrics.learnedEdgeCount > 0, 'Expected learned prerequisite links to be highlighted and counted.');
	assertCondition(/学习状态/.test(metrics.railText), 'Expected side rail to describe learning state.');
	assertCondition(!/构筑路线|稳固前线|破甲重击|流血连段|分支|影响路线/.test(metrics.railText), 'Side rail should not expose fictional route or branch concepts.');
	for (const state of ['LEARNED', 'LEARNABLE', 'LOCKED']) {
		assertCondition(Number(metrics.stateCounts[state]) > 0, `Expected visible ${state} nodes.`);
	}
}

async function main() {
	const { page, chrome } = await createPage();
	try {
		await openRepresentativeSkillTree(page);
		const metrics = await collectMetrics(page);
		verifyMetrics(metrics);
		metrics.imageSize = await writeScreenshot(page, 'runtime-skilltree-v3-1920x1080.png');
		fs.writeFileSync(path.join(outputDir, 'runtime-skilltree-v3-metrics.json'), JSON.stringify(metrics, null, 2));
		console.log(JSON.stringify({ outputDir, metrics }, null, 2));
		page.close();
	} finally {
		chrome.kill('SIGTERM');
		setTimeout(() => chrome.kill('SIGKILL'), 1000).unref();
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
