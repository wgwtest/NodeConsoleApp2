import fs from 'node:fs/promises';
import path from 'node:path';

const appUrl = process.env.ACCEPTANCE_MAIN_URL || 'http://127.0.0.1:3111/mock_ui_v11.html';
const cdpEndpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9223';
const outputPath = process.env.OUTPUT_PATH || path.resolve('test-results', 'level-select-map-1920x1080.png');

async function openPage(url) {
    const response = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
    if (!response.ok) {
        throw new Error(`openPage failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

function createCdpClient(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let nextId = 1;
        const pending = new Map();
        const runtimeExceptions = [];
        let settled = false;

        const cleanup = (error = null) => {
            for (const { reject: rejectPending } of pending.values()) {
                rejectPending(error || new Error(`WebSocket closed: ${wsUrl}`));
            }
            pending.clear();
        };

        ws.addEventListener('open', () => {
            settled = true;
            resolve({
                runtimeExceptions,
                async send(method, params = {}) {
                    const id = nextId++;
                    return new Promise((resolveSend, rejectSend) => {
                        pending.set(id, { resolve: resolveSend, reject: rejectSend });
                        ws.send(JSON.stringify({ id, method, params }));
                    });
                },
                async closeTarget() {
                    try {
                        await this.send('Page.close');
                    } catch {
                        return false;
                    }
                    return true;
                },
                disconnect() {
                    ws.close();
                }
            });
        });

        ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.method === 'Runtime.exceptionThrown') {
                runtimeExceptions.push(message.params?.exceptionDetails || message.params || {});
                return;
            }
            if (!message.id) return;
            const entry = pending.get(message.id);
            if (!entry) return;
            pending.delete(message.id);
            if (message.error) {
                entry.reject(new Error(message.error.message || 'CDP error'));
                return;
            }
            entry.resolve(message.result || {});
        });

        ws.addEventListener('error', () => {
            const error = new Error(`WebSocket failed: ${wsUrl}`);
            cleanup(error);
            if (!settled) reject(error);
        });

        ws.addEventListener('close', () => cleanup());
    });
}

async function evaluate(client, expression) {
    const result = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
    });
    if (result.exceptionDetails) {
        const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate failed';
        throw new Error(detail);
    }
    return result.result ? result.result.value : undefined;
}

async function waitFor(client, expression, label, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const value = await evaluate(client, expression);
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    throw new Error(`Timeout waiting for ${label}`);
}

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

let client = null;

try {
    const pageInfo = await openPage(appUrl);
    client = await createCdpClient(pageInfo.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false
    });

    await waitFor(
        client,
        `(() => document.getElementById("modalTitle")?.textContent.trim() === "欢迎"
            && [...document.querySelectorAll("button")].some(btn => btn.textContent.trim() === "新游戏"))()`,
        'welcome modal'
    );

    const report = await evaluate(client, `(async () => {
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const clickButtonByText = text => {
            const btn = [...document.querySelectorAll("button")]
                .find(item => item.textContent.trim() === text);
            if (!btn) throw new Error("找不到按钮：" + text);
            btn.click();
        };
        const waitForPredicate = async (predicate, label, timeoutMs = 12000) => {
            const started = Date.now();
            while (Date.now() - started < timeoutMs) {
                if (predicate()) return true;
                await sleep(100);
            }
            throw new Error("等待超时：" + label);
        };

        clickButtonByText("新游戏");
        await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "游戏菜单");
        clickButtonByText("关卡选择");
        await waitForPredicate(() => document.querySelector(".level-select-runtime-map .level-map-node"), "运行时地图节点");
        await sleep(800);

        const rectOf = selector => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom)
            };
        };
        const nodes = [...document.querySelectorAll(".level-map-node")].map(node => ({
            id: node.dataset.nodeId,
            levelId: node.dataset.levelId,
            text: node.textContent.trim().replace(/\\s+/g, " "),
            status: [...node.classList].find(item => item.startsWith("is-")) || "",
            disabled: node.disabled || node.getAttribute("aria-disabled") === "true",
            selected: node.getAttribute("data-selected") === "true",
            rect: (() => {
                const rect = node.getBoundingClientRect();
                return {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    right: Math.round(rect.right),
                    bottom: Math.round(rect.bottom)
                };
            })()
        }));
        const mapButtons = [...document.querySelectorAll(".level-map-switcher__button")].map(button => ({
            mapId: button.dataset.mapId,
            text: button.textContent.trim().replace(/\\s+/g, " "),
            pressed: button.getAttribute("aria-pressed") === "true",
            rect: (() => {
                const rect = button.getBoundingClientRect();
                return {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    right: Math.round(rect.right),
                    bottom: Math.round(rect.bottom)
                };
            })()
        }));
        const stageRect = rectOf(".level-select-runtime-map__stage");
        const modalRect = rectOf(".modal-panel--level-select");
        const mapRect = rectOf(".level-select-runtime-map");
        const switcherRect = rectOf(".level-map-switcher");
        const listRect = rectOf(".level-list-panel");
        const screenshotText = document.querySelector(".level-select-runtime-map")?.textContent || "";
        const style = getComputedStyle(document.querySelector(".level-select-runtime-map__stage"));
        return {
            title: document.getElementById("modalTitle")?.textContent.trim(),
            viewport: { width: window.innerWidth, height: window.innerHeight },
            modalRect,
            listRect,
            mapRect,
            switcherRect,
            stageRect,
            mapButtonCount: mapButtons.length,
            pressedMapButtonCount: mapButtons.filter(button => button.pressed).length,
            mapButtons,
            nodeCount: nodes.length,
            edgeCount: document.querySelectorAll(".level-map-edge").length,
            selectedNodeCount: nodes.filter(node => node.selected).length,
            lockedNodeCount: nodes.filter(node => node.disabled).length,
            nodes,
            stageBackgroundImage: style.backgroundImage,
            mapText: screenshotText.trim().replace(/\\s+/g, " ")
        };
    })()`);

    assertCondition(report.title === '选择关卡', '未停留在关卡选择弹窗');
    assertCondition(report.viewport.width === 1920 && report.viewport.height === 1080, '视口不是 1920x1080');
    assertCondition(report.nodeCount >= 3, '地图节点数量不足');
    assertCondition(report.mapButtonCount === 3, `地图切换入口数量不是 3：${report.mapButtonCount}`);
    assertCondition(report.pressedMapButtonCount === 1, `当前地图切换状态数量异常：${report.pressedMapButtonCount}`);
    assertCondition(report.edgeCount >= 2, '地图连线数量不足');
    assertCondition(report.selectedNodeCount >= 1, '缺少选中或推荐节点');
    assertCondition(report.stageBackgroundImage.includes('image_w2752_h1536_map-bg-01'), '地图背景图未加载到舞台');
    assertCondition(report.stageRect.width >= 850, `地图舞台过窄：${report.stageRect.width}`);
    assertCondition(report.stageRect.height >= 470, `地图舞台过矮：${report.stageRect.height}`);
    assertCondition(report.mapRect.right <= report.modalRect.right && report.mapRect.bottom <= report.modalRect.bottom, '地图区域溢出弹窗');
    assertCondition(report.switcherRect.right <= report.mapRect.right && report.switcherRect.bottom <= report.mapRect.bottom, '地图切换控件溢出地图区域');
    for (const button of report.mapButtons) {
        assertCondition(button.rect.x >= report.mapRect.x - 8, `地图切换按钮 ${button.mapId} 左侧溢出地图区域`);
        assertCondition(button.rect.right <= report.mapRect.right + 8, `地图切换按钮 ${button.mapId} 右侧溢出地图区域`);
    }
    for (const node of report.nodes) {
        assertCondition(node.rect.x >= report.stageRect.x - 8, `节点 ${node.id} 左侧溢出舞台`);
        assertCondition(node.rect.right <= report.stageRect.right + 8, `节点 ${node.id} 右侧溢出舞台`);
        assertCondition(node.rect.y >= report.stageRect.y - 8, `节点 ${node.id} 顶部溢出舞台`);
        assertCondition(node.rect.bottom <= report.stageRect.bottom + 8, `节点 ${node.id} 底部溢出舞台`);
    }

    const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true
    });
    await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));

    console.log(JSON.stringify({ outputPath, report }, null, 2));
} finally {
    if (client) {
        try {
            await client.closeTarget();
        } finally {
            client.disconnect();
        }
    }
}
