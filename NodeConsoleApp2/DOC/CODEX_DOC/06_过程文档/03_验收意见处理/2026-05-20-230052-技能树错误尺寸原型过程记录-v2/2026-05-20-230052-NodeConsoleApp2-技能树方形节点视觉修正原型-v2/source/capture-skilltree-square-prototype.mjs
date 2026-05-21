import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const targetUrl = process.env.SKILLTREE_URL || 'http://127.0.0.1:3122/mock_ui_v11.html';
const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const viewport = { width: 1440, height: 920, deviceScaleFactor: 1, mobile: false };

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
	const userDataDir = path.join('/tmp', `skilltree-square-prototype-${Date.now()}`);
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

	let stderr = '';
	chrome.stderr.on('data', data => {
		stderr += data.toString();
	});

	try {
		const target = await waitForChromePage(userDataDir);
		const page = new CDP(target.webSocketDebuggerUrl);
		await page.open();
		await page.send('Page.enable');
		await page.send('Runtime.enable');
		await page.send('DOM.enable');
		await page.send('Emulation.setDeviceMetricsOverride', viewport);
		return { page, chrome, stderr: () => stderr };
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

async function waitFor(page, expression, timeout = 20000) {
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

async function screenshot(page, filename) {
	const shot = await page.send('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	fs.writeFileSync(path.join(packageDir, filename), Buffer.from(shot.data, 'base64'));
}

async function openSkillTree(page) {
	await page.send('Page.navigate', { url: `${targetUrl}?skilltree_prototype=${Date.now()}` });
	await waitFor(page, 'document.readyState === "complete"');
	await waitFor(page, '!!window.GameEngine && !!document.getElementById("btnOpenSkillTree")');
	await sleep(1000);
	await evaluate(page, `(() => {
		const skills = window.GameEngine?.data?.playerData?.skills;
		if (skills) {
			skills.skillTreeId = 'melee_v4_5';
			skills.skillPoints = 4;
			skills.learned = ['skill_block', 'skill_heavy_swing', 'skill_double_thrust'];
		}
		document.getElementById('btnOpenSkillTree')?.click();
		setTimeout(() => window.GameEngine?.eventBus?.emit('UI:OPEN_SKILL_TREE', { source: 'MAIN_MENU' }), 100);
		return true;
	})()`);
	await waitFor(page, 'document.querySelector(".ui-skilltree__node") && document.querySelector("#skillTreeOverlay.visible")');
	await sleep(600);
}

async function collectMetrics(page) {
	return evaluate(page, `(() => {
		const nodes = [...document.querySelectorAll('.ui-skilltree__node')].map(node => ({
			id: node.dataset.skillId || '',
			state: node.dataset.codexState || node.dataset.status || '',
			left: node.getBoundingClientRect().left,
			top: node.getBoundingClientRect().top,
			right: node.getBoundingClientRect().right,
			bottom: node.getBoundingClientRect().bottom,
			title: node.querySelector('.ui-skilltree__nodeTitle')?.textContent || ''
		}));
		const overlaps = [];
		for (let i = 0; i < nodes.length; i += 1) {
			for (let j = i + 1; j < nodes.length; j += 1) {
				const a = nodes[i];
				const b = nodes[j];
				const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
				const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
				if (x * y > 4) overlaps.push([a.id, b.id, Math.round(x * y)]);
			}
		}
		return {
			count: nodes.length,
			overlaps,
			zoom: document.querySelector('.ui-skilltree__transform')?.dataset.codexZoom || null,
			sample: nodes.slice(0, 6)
		};
	})()`);
}

const prototypeCss = `
	.overlay-panel { background:#10171c !important; }
	.ui-skilltree {
		--st-green:#35b7a3; --st-green-bright:#9ef2df; --st-gold:#f0bd45; --st-red:#df704c; --st-muted:#aab7bd;
		background:linear-gradient(180deg,#162029 0%,#10181e 100%) !important;
		color:#f3f7f6 !important;
	}
	.ui-skilltree::before { opacity:.08 !important; }
	.ui-skilltree__topbar { height:72px !important; flex-basis:72px !important; padding:0 24px !important; background:#121a20 !important; border-bottom:1px solid rgba(255,255,255,.11) !important; }
	.ui-skilltree__mark { width:40px !important; height:40px !important; border-radius:8px !important; background:rgba(240,189,69,.12) !important; }
	.ui-skilltree__title { font-size:1.42rem !important; color:#fff8e8 !important; }
	.ui-skilltree__subtitle { margin-top:6px !important; font-size:.78rem !important; color:#aebabe !important; }
	.ui-skilltree__topActions { gap:8px !important; }
	.ui-skilltree__kp,.ui-skilltree__topBtn { min-height:36px !important; padding:0 12px !important; border-radius:6px !important; }
	.ui-skilltree__content { grid-template-columns: 210px minmax(0, 1fr) 282px !important; }
	.ui-skilltree__routeRail { padding:20px 16px !important; background:#111d24 !important; border-right:1px solid rgba(255,255,255,.10) !important; }
	.ui-skilltree__railTitle,.ui-skilltree__detailHeading { margin-bottom:14px !important; }
	.ui-skilltree__routeCard { min-height:54px !important; padding:11px 12px !important; border-radius:7px !important; background:rgba(255,255,255,.045) !important; }
	.ui-skilltree__legend { left:16px !important; right:16px !important; bottom:16px !important; gap:8px !important; opacity:.58 !important; font-size:.72rem !important; }
	.ui-skilltree__canvasViewport {
		background:
			radial-gradient(circle at 20px 20px, rgba(255,255,255,.07) 1px, transparent 1.8px) 0 0/28px 28px,
			linear-gradient(180deg,#31424b 0%,#253540 100%) !important;
		box-shadow:inset 0 0 0 1px rgba(255,255,255,.10) !important;
	}
	.ui-skilltree__canvasMeta { left:22px !important; top:18px !important; color:#d2dbe0 !important; font-size:.76rem !important; }
	.ui-skilltree__decisionPanel { padding:20px 16px !important; background:#121b20 !important; border-left:1px solid rgba(255,255,255,.10) !important; }
	.ui-skilltree__detailCard { padding:16px !important; border-radius:8px !important; background:rgba(240,189,69,.075) !important; }
	.ui-skilltree__detailTitle { font-size:1.28rem !important; }
	.ui-skilltree__statGrid { gap:8px !important; margin-top:14px !important; }
	.ui-skilltree__stat { min-height:54px !important; padding:10px !important; border-radius:7px !important; }
	.ui-skilltree__impact,.ui-skilltree__chain,.ui-skilltree__actions { margin-top:14px !important; }
	.ui-skilltree__chainItem { min-height:44px !important; border-radius:7px !important; }
	.ui-skilltree__node {
		width:72px !important; height:72px !important; min-width:72px !important; min-height:72px !important;
		border-radius:10px !important; box-sizing:border-box !important;
		padding:8px 6px 16px !important; display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:center !important;
		color:#f8fbff !important; overflow:visible !important; cursor:pointer !important;
		border:2px solid #93a0aa !important; background:linear-gradient(180deg,#5a6570 0%,#39444f 100%) !important;
		box-shadow:0 7px 13px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.15) !important;
		transform:none !important; opacity:1 !important;
	}
	.ui-skilltree__node::before { content:'' !important; position:absolute !important; inset:0 !important; width:auto !important; border-radius:8px !important; background:linear-gradient(180deg,rgba(255,255,255,.17),transparent 40%) !important; opacity:1 !important; pointer-events:none !important; }
	.ui-skilltree__node::after { content:attr(data-codex-state-label) !important; position:absolute !important; left:0 !important; right:0 !important; bottom:0 !important; height:16px !important; display:flex !important; align-items:center !important; justify-content:center !important; border-radius:0 0 8px 8px !important; background:rgba(20,25,30,.76) !important; color:#f8fbff !important; font-size:10px !important; font-weight:950 !important; line-height:1 !important; letter-spacing:0 !important; }
	.ui-skilltree__nodeTitle { margin:0 !important; max-width:62px !important; color:#fff !important; text-align:center !important; font-size:15px !important; font-weight:950 !important; line-height:1.05 !important; letter-spacing:0 !important; text-shadow:0 1px 2px rgba(0,0,0,.58) !important; display:-webkit-box !important; -webkit-box-orient:vertical !important; -webkit-line-clamp:2 !important; overflow:hidden !important; }
	.ui-skilltree__nodeCost { position:absolute !important; top:-7px !important; right:-7px !important; min-width:30px !important; height:18px !important; padding:0 5px !important; border-radius:999px !important; display:flex !important; align-items:center !important; justify-content:center !important; border:1px solid rgba(255,255,255,.78) !important; background:#f4d35e !important; color:#15202a !important; box-shadow:0 2px 6px rgba(0,0,0,.38) !important; font-size:10px !important; font-weight:950 !important; line-height:1 !important; z-index:4 !important; }
	.ui-skilltree__nodeStatus { display:none !important; }
	.ui-skilltree__nodeAction { position:absolute !important; right:-8px !important; bottom:-8px !important; width:25px !important; height:25px !important; border-radius:999px !important; border:2px solid #fff7d2 !important; background:#ffd13d !important; color:#16202a !important; font-size:20px !important; font-weight:950 !important; line-height:18px !important; box-shadow:0 5px 10px rgba(0,0,0,.42) !important; z-index:5 !important; }
	.ui-skilltree__node[data-codex-state='learned'] { background:linear-gradient(180deg,#35b7a3 0%,#126f78 100%) !important; border-color:#9ef2df !important; }
	.ui-skilltree__node[data-codex-state='learned']::after { background:rgba(5,78,76,.90) !important; color:#e2fff8 !important; }
	.ui-skilltree__node[data-codex-state='learnable'] { background:linear-gradient(180deg,#e6af38 0%,#9b691c 100%) !important; border-color:#ffe28a !important; box-shadow:0 0 0 3px rgba(255,213,90,.20),0 9px 16px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.22) !important; }
	.ui-skilltree__node[data-codex-state='learnable']::after { background:rgba(108,65,8,.90) !important; color:#fff3c0 !important; }
	.ui-skilltree__node[data-codex-state='pending'] { background:linear-gradient(180deg,#e8754a 0%,#9a392d 100%) !important; border-color:#ffc3a5 !important; }
	.ui-skilltree__node[data-codex-state='pending']::after { background:rgba(101,33,24,.90) !important; color:#fff1e7 !important; }
	.ui-skilltree__node[data-codex-state='locked'] { background:linear-gradient(180deg,#626d77 0%,#38434d 100%) !important; border-color:#8998a5 !important; opacity:.78 !important; }
	.ui-skilltree__node.is-selected { outline:3px solid #fff !important; outline-offset:3px !important; border-color:#ffffff !important; box-shadow:0 0 0 6px rgba(255,255,255,.10),0 12px 22px rgba(0,0,0,.38) !important; z-index:20 !important; }
	.ui-skilltree__node.is-dimmed { opacity:.58 !important; }
	.ui-skilltree__node.is-path-focus { opacity:1 !important; filter:saturate(1.08) brightness(1.04) !important; }
`;

async function applyPrototype(page) {
	await evaluate(page, `(() => {
		const style = document.createElement('style');
		style.id = 'codex-final-skilltree-prototype';
		style.textContent = ${JSON.stringify(prototypeCss)};
		document.head.appendChild(style);
		const stateMap = {
			skill_block: 'learned',
			skill_heavy_swing: 'learned',
			skill_double_thrust: 'learned',
			skill_heal: 'learned',
			skill_iron_hand: 'learnable',
			skill_savage_charge: 'learnable',
			skill_skull_cracker: 'learnable',
			skill_tear: 'learnable',
			skill_artery_slice_copy_1769789197982: 'learnable',
			skill_shockwave: 'pending',
			skill_hold_the_line: 'pending'
		};
		const labelMap = { learned: '已学', learnable: '可学', pending: '待提交', locked: '前置' };
		for (const node of document.querySelectorAll('.ui-skilltree__node')) {
			const state = stateMap[node.dataset.skillId] || 'locked';
			node.dataset.codexState = state;
			node.dataset.codexStateLabel = labelMap[state];
			node.classList.toggle('is-dimmed', state === 'locked');
			let action = node.querySelector('.ui-skilltree__nodeAction');
			if (state === 'learnable' && !action) {
				action = document.createElement('button');
				action.type = 'button';
				action.className = 'ui-skilltree__nodeAction';
				action.textContent = '+';
				node.appendChild(action);
			}
			if (state !== 'learnable') action?.remove();
		}
		const selected = document.querySelector('[data-skill-id="skill_block"]');
		document.querySelectorAll('.ui-skilltree__node.is-selected').forEach(node => node.classList.remove('is-selected'));
		selected?.classList.add('is-selected');
		const learned = document.querySelector('.ui-skilltree__learnedCount');
		if (learned) learned.textContent = '已学习 4 / 32';
		const kp = document.querySelector('.ui-skilltree__kp');
		if (kp) kp.textContent = '可用 KP 4';
		const meta = document.querySelector('.ui-skilltree__canvasMeta');
		if (meta) meta.textContent = '全局结构态 · 方形节点复用编辑器坐标 · 拖拽平移 / 滚轮缩放 / 双击回到全图';
		const detailTitle = document.querySelector('.ui-skilltree__detailTitle');
		if (detailTitle) detailTitle.textContent = '修理护甲';
		const detailDesc = document.querySelector('.ui-skilltree__detailDesc');
		if (detailDesc) detailDesc.textContent = '指定位置获得10点护甲。';
		const statValues = [...document.querySelectorAll('.ui-skilltree__stat b')];
		if (statValues[0]) statValues[0].textContent = '1 KP';
		if (statValues[1]) statValues[1].textContent = '已学习';
		if (statValues[2]) statValues[2].textContent = '无';
		if (statValues[3]) statValues[3].textContent = '铁头、铁手、钢盾、临期食品';
		const impact = document.querySelector('.ui-skilltree__impact');
		if (impact) impact.textContent = '能力已进入战斗技能池。';
		return true;
	})()`);

	await evaluate(page, `(() => {
		const viewport = document.querySelector('.ui-skilltree__canvasViewport');
		const layer = document.querySelector('.ui-skilltree__transform');
		const nodes = [...document.querySelectorAll('.ui-skilltree__node')];
		if (!viewport || !layer || !nodes.length) return false;
		const size = 72;
		const boxes = nodes.map(node => ({ x: parseFloat(node.style.left) || 0, y: parseFloat(node.style.top) || 0 }));
		const minX = Math.min(...boxes.map(box => box.x));
		const minY = Math.min(...boxes.map(box => box.y));
		const maxX = Math.max(...boxes.map(box => box.x + size));
		const maxY = Math.max(...boxes.map(box => box.y + size));
		const rect = viewport.getBoundingClientRect();
		const zoom = Math.max(0.52, Math.min(0.76, (rect.width - 152) / Math.max(1, maxX - minX), (rect.height - 172) / Math.max(1, maxY - minY)));
		const panX = Math.round((rect.width - (maxX - minX) * zoom) / 2 - minX * zoom);
		const panY = Math.round((rect.height - (maxY - minY) * zoom) / 2 - minY * zoom + 12);
		layer.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
		layer.dataset.codexZoom = String(zoom);
		return true;
	})()`);
}

async function main() {
	const { page, chrome } = await createPage();
	try {
		await openSkillTree(page);
		await screenshot(page, '01-current-global-1440x920.png');
		await evaluate(page, `(() => {
			const node = document.querySelector('[data-skill-id="skill_block"]');
			node?.click();
			node?.scrollIntoView({ block: 'center', inline: 'center' });
			return true;
		})()`);
		await sleep(400);
		await screenshot(page, '02-current-selected-block-1440x920.png');

		await applyPrototype(page);
		await sleep(500);
		await screenshot(page, '04-prototype-final-layout-1440x920.png');
		const finalMetrics = await collectMetrics(page);
		fs.writeFileSync(path.join(packageDir, 'prototype-final-metrics.json'), JSON.stringify(finalMetrics, null, 2));
		console.log(JSON.stringify({ packageDir, finalMetrics }, null, 2));
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
