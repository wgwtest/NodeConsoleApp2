const DEFAULT_RUNTIME_ENDPOINTS = Object.freeze([
    {
        appBaseUrl: "http://127.0.0.1:3111",
        cdpEndpoint: "http://127.0.0.1:9223"
    },
    {
        appBaseUrl: "http://127.0.0.1:3101",
        cdpEndpoint: "http://127.0.0.1:9222"
    }
]);

const PAGE_PATHS = Object.freeze({
    main: "/mock_ui_v11.html",
    probe: "/test/battle_presentation_probe.html",
    configurator: "/test/battle_presentation_configurator.html"
});

function buildUrl(baseUrl, path) {
    return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

async function openPage(cdpEndpoint, url) {
    const response = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) {
        throw new Error(`openPage failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function probeRuntimePair(appBaseUrl, cdpEndpoint) {
    try {
        const [appResponse, cdpResponse] = await Promise.all([
            fetch(buildUrl(appBaseUrl, PAGE_PATHS.main), { method: "HEAD" }),
            fetch(`${cdpEndpoint}/json/version`)
        ]);
        if (!appResponse.ok || !cdpResponse.ok) return false;
        const version = await cdpResponse.json().catch(() => null);
        return Boolean(version?.webSocketDebuggerUrl);
    } catch {
        return false;
    }
}

async function resolveRuntimeEndpoints() {
    const envAppBaseUrl = process.env.APP_BASE_URL?.trim();
    const envCdpEndpoint = process.env.CDP_ENDPOINT?.trim();
    const candidates = [];

    if (envAppBaseUrl || envCdpEndpoint) {
        candidates.push({
            appBaseUrl: envAppBaseUrl || DEFAULT_RUNTIME_ENDPOINTS[0].appBaseUrl,
            cdpEndpoint: envCdpEndpoint || DEFAULT_RUNTIME_ENDPOINTS[0].cdpEndpoint
        });
    }

    for (const candidate of DEFAULT_RUNTIME_ENDPOINTS) {
        if (!candidates.some(item => item.appBaseUrl === candidate.appBaseUrl && item.cdpEndpoint === candidate.cdpEndpoint)) {
            candidates.push(candidate);
        }
    }

    for (const candidate of candidates) {
        if (await probeRuntimePair(candidate.appBaseUrl, candidate.cdpEndpoint)) {
            return candidate;
        }
    }

    throw new Error(`Unable to resolve a live app/CDP pair from ${candidates.map(item => `${item.appBaseUrl} + ${item.cdpEndpoint}`).join(", ")}`);
}

function createCdpClient(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let nextId = 1;
        const pending = new Map();
        const consoleMessages = [];
        const runtimeExceptions = [];
        let settled = false;

        const cleanup = (error = null) => {
            for (const { reject: rejectPending } of pending.values()) {
                rejectPending(error || new Error(`WebSocket closed: ${wsUrl}`));
            }
            pending.clear();
        };

        ws.addEventListener("open", () => {
            settled = true;
            resolve({
                consoleMessages,
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
                        await this.send("Page.close");
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

        ws.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            if (message.method === "Runtime.consoleAPICalled") {
                const args = message.params?.args || [];
                consoleMessages.push({
                    type: message.params?.type || "log",
                    text: args.map(arg => arg.value ?? arg.description ?? "").join(" ")
                });
                return;
            }
            if (message.method === "Runtime.exceptionThrown") {
                runtimeExceptions.push(message.params?.exceptionDetails || message.params || {});
                return;
            }
            if (!message.id) return;
            const entry = pending.get(message.id);
            if (!entry) return;
            pending.delete(message.id);
            if (message.error) {
                entry.reject(new Error(message.error.message || "CDP error"));
                return;
            }
            entry.resolve(message.result || {});
        });

        ws.addEventListener("error", () => {
            const error = new Error(`WebSocket failed: ${wsUrl}`);
            cleanup(error);
            if (!settled) {
                reject(error);
            }
        });

        ws.addEventListener("close", () => {
            cleanup();
        });
    });
}

async function attach(cdpEndpoint, url) {
    const pageInfo = await openPage(cdpEndpoint, url);
    const client = await createCdpClient(pageInfo.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Log.enable").catch(() => {});
    return client;
}

async function evaluate(client, expression) {
    const result = await client.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
    });
    if (result.exceptionDetails) {
        const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed";
        throw new Error(detail);
    }
    return result.result ? result.result.value : undefined;
}

async function waitFor(client, expression, label, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const value = await evaluate(client, expression);
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(`Timeout waiting for ${label}`);
}

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function closeClient(client) {
    if (!client) return;
    try {
        await client.closeTarget();
    } finally {
        client.disconnect();
    }
}

async function runMainFlow(cdpEndpoint, mainUrl) {
    let client = null;
    try {
        client = await attach(cdpEndpoint, mainUrl);
        await waitFor(
            client,
            `(() => document.getElementById("modalTitle")?.textContent.trim() === "欢迎"
                && [...document.querySelectorAll("button")].some(btn => btn.textContent.trim() === "新游戏"))()`,
            "mock_ui_v11.html 欢迎页和新游戏按钮"
        );

        const report = await evaluate(client, `(async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const clickButtonByText = text => {
                const btn = [...document.querySelectorAll("button")]
                    .find(item => item.textContent.trim() === text);
                if (!btn) throw new Error("找不到按钮：" + text);
                btn.click();
                return btn.textContent.trim();
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
            await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");

            await waitForPredicate(() => document.querySelector(".level-select-runtime-map .level-map-node"), "关卡地图节点");
            const levelNode = [...document.querySelectorAll(".level-map-node")]
                .find(node => !node.disabled && node.getAttribute("aria-disabled") !== "true");
            if (!levelNode) throw new Error("没有可点击关卡地图节点");
            const selectedLevelText = levelNode.textContent.trim().replace(/\\s+/g, " ");
            levelNode.click();
            await waitForPredicate(() => document.querySelector(".level-map-node[data-selected='true']"), "地图节点选中");
            const enterButton = document.querySelector("[data-action='enter-level']");
            if (!enterButton || enterButton.disabled || enterButton.getAttribute("aria-disabled") === "true") {
                throw new Error("地图详情抽屉没有可用进入按钮");
            }
            enterButton.click();

            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP", "BATTLE_LOOP");
            await waitForPredicate(() => document.getElementById("btnCommitPlanning") && document.getElementById("btnExecute"), "战斗按钮");
            await sleep(400);

            const executeBefore = document.getElementById("btnExecute");
            const disabledBefore = executeBefore.classList.contains("disabled")
                || executeBefore.getAttribute("aria-disabled") === "true";
            const disabledReason = executeBefore.dataset.disabledReason || executeBefore.getAttribute("title") || "";
            executeBefore.click();
            await sleep(150);

            const skillButton = document.querySelector('.skill-icon-button:not(.disabled):not([disabled])');
            if (!skillButton) throw new Error("没有可点击技能按钮");
            const selectedSkill = skillButton.textContent.trim().replace(/\\s+/g, " ");
            skillButton.click();
            await waitForPredicate(() => document.querySelector(".slot-placeholder.highlight-valid"), "可落槽位");

            const slot = document.querySelector(".slot-placeholder.highlight-valid");
            const slotMeta = [
                slot.dataset.targetType,
                slot.dataset.part,
                slot.dataset.slotIndex || "0"
            ].join(":");
            slot.click();
            await waitForPredicate(() => document.querySelector(".slot-placeholder.filled"), "草稿槽位");

            clickButtonByText("提交规划");
            await waitForPredicate(() => {
                const execute = document.getElementById("btnExecute");
                return execute && !execute.classList.contains("disabled") && execute.getAttribute("aria-disabled") !== "true";
            }, "执行回合 可用");

            const timelineBeforeExecute = window.GameEngine?.timeline?.phase || "";
            clickButtonByText("执行回合");
            await waitForPredicate(() => window.GameEngine?.battlePhase === "EXECUTION"
                || window.GameEngine?.timeline?.phase === "PLAYING"
                || window.GameEngine?.timeline?.phase === "FINISHED"
                || window.GameEngine?.currentTurn > 1, "执行回合触发");

            await sleep(1200);
            return {
                path: "mock_ui_v11.html",
                clicked: ["新游戏", "关卡选择", selectedLevelText, selectedSkill, slotMeta, "提交规划", "执行回合"],
                disabledBefore,
                disabledReason,
                level: window.GameEngine?.data?.currentLevelData?.id || "",
                battlePhase: window.GameEngine?.battlePhase || "",
                timelineBeforeExecute,
                timelineAfterExecute: window.GameEngine?.timeline?.phase || "",
                currentTurn: window.GameEngine?.currentTurn || 0,
                queueLength: Array.isArray(window.GameEngine?.playerSkillQueue) ? window.GameEngine.playerSkillQueue.length : null,
                title: document.getElementById("modalTitle")?.textContent || "",
                presentationSource: document.querySelector(".battle-scene")?.dataset?.presentationProfileSource || ""
            };
        })()`);

        assertCondition(report.disabledBefore === true, "执行回合在提交规划前没有呈现禁用状态");
        assertCondition(/提交规划|时间轴|规划/.test(report.disabledReason || ""), "执行回合禁用原因没有提示先提交规划");
        assertCondition(report.level, "主流程未进入具体关卡");
        assertCondition(["EXECUTION", "PLANNING"].includes(report.battlePhase), `主流程执行后 battlePhase 异常：${report.battlePhase}`);
        assertCondition(["PLAYING", "FINISHED", "IDLE", "READY"].includes(report.timelineAfterExecute), `主流程执行后 timelinePhase 异常：${report.timelineAfterExecute}`);
        assertCondition(report.currentTurn >= 1, "主流程没有进入有效回合");
        assertCondition(client.runtimeExceptions.length === 0, "主流程页面出现 Runtime exception");
        return report;
    } finally {
        await closeClient(client);
    }
}

async function runPresentationProbe(cdpEndpoint, probeUrl) {
    let client = null;
    try {
        client = await attach(cdpEndpoint, probeUrl);
        await waitFor(
            client,
            `(() => document.getElementById("btnTplUnknown")
                && document.getElementById("templateProbeState")
                && document.getElementById("presentationSourceState"))()`,
            "battle_presentation_probe.html ready"
        );

        const report = await evaluate(client, `(async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const click = selector => {
                const el = document.querySelector(selector);
                if (!el) throw new Error("找不到按钮：" + selector);
                el.click();
                return el.textContent.trim();
            };
            const buttons = [
                "#btnProbeAction",
                "#btnPlayerHitEnemy",
                "#btnEnemyHitPlayer",
                "#btnPlayerHeal",
                "#btnPlayerBuff",
                "#btnEnemyDebuff",
                "#btnTplMelee",
                "#btnTplGuard",
                "#btnTplHeal",
                "#btnTplStatus",
                "#btnTplUnknown",
                "#btnTogglePresentation",
                "#btnReloadProfile"
            ];
            for (const selector of buttons) {
                click(selector);
                await sleep(120);
            }
            await sleep(500);
            return {
                path: "battle_presentation_probe.html",
                clicked: buttons,
                templateState: document.getElementById("templateProbeState")?.textContent || "",
                presentationState: document.getElementById("presentationSourceState")?.textContent || "",
                profileState: document.getElementById("profileAssetState")?.textContent || "",
                probeLog: document.getElementById("probeLog")?.textContent || "",
                sceneDataset: { ...document.querySelector(".battle-scene")?.dataset }
            };
        })()`);

        assertCondition(report.templateState.includes("default"), "模板：未知类别（降级）未回退到 default");
        assertCondition(report.presentationState.includes("最近降级语义：default"), "未知模板降级语义不可观察");
        assertCondition(report.probeLog.includes("[TPL] 未知模板"), "probe 日志缺少未知模板记录");
        assertCondition(report.profileState.includes("当前演出配置资产"), "probe 未加载演出配置资产");
        assertCondition(client.runtimeExceptions.length === 0, "演出 probe 页面出现 Runtime exception");
        return report;
    } finally {
        await closeClient(client);
    }
}

async function runPresentationConfigurator(cdpEndpoint, configuratorUrl) {
    let client = null;
    try {
        client = await attach(cdpEndpoint, configuratorUrl);
        await waitFor(
            client,
            `(() => document.getElementById("btnApplyPreview")
                && document.getElementById("btnSaveWorkspace")
                && document.getElementById("jsonEditor")?.value.includes("battle_presentation_profiles_v1"))()`,
            "battle_presentation_configurator.html ready"
        );

        const report = await evaluate(client, `(async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const click = selector => {
                const el = document.querySelector(selector);
                if (!el) throw new Error("找不到按钮：" + selector);
                el.click();
                return el.textContent.trim();
            };

            const buttons = [
                "#btnApplyPreview",
                "#btnPreviewAttack",
                "#btnPreviewHit",
                "#btnPreviewHeal",
                "#btnPreviewStatus",
                "#btnSaveWorkspace",
                "#btnLoadWorkspace",
                "#btnExportJson",
                "#btnImportJson",
                "#btnClearWorkspace"
            ];
            for (const selector of buttons) {
                click(selector);
                await sleep(160);
            }
            await sleep(500);
            return {
                path: "battle_presentation_configurator.html",
                clickedLabels: buttons.map(selector => document.querySelector(selector)?.textContent.trim() || selector),
                requiredLabels: ["保存到工作区", "保存到工作区：写入浏览器 workspace", "导出 JSON"],
                jsonLength: document.getElementById("jsonEditor")?.value.length || 0,
                jsonHead: document.getElementById("jsonEditor")?.value.slice(0, 80) || "",
                previewLog: document.getElementById("previewLog")?.textContent || "",
                workspaceState: document.getElementById("workspaceMetaState")?.textContent || "",
                sceneDataset: { ...document.querySelector(".battle-scene")?.dataset }
            };
        })()`);

        assertCondition(report.jsonLength > 100, "导出 JSON 后文本框内容过短");
        assertCondition(report.jsonHead.includes("schemaVersion"), "导出 JSON 缺少 schemaVersion");
        assertCondition(report.previewLog.includes("[EXPORT] 已导出 JSON"), "配置器日志缺少导出记录");
        assertCondition(report.previewLog.includes("[IMPORT] 已从下方 JSON 导入"), "配置器日志缺少导入记录");
        assertCondition(report.previewLog.includes("[CLEAR] 已清空浏览器 workspace"), "配置器日志缺少清空 workspace 记录");
        assertCondition(client.runtimeExceptions.length === 0, "演出配置器页面出现 Runtime exception");
        return report;
    } finally {
        await closeClient(client);
    }
}

async function main() {
    const runtime = await resolveRuntimeEndpoints();
    const cdpEndpoint = runtime.cdpEndpoint;
    const appBaseUrl = runtime.appBaseUrl;
    const urls = {
        main: process.env.ACCEPTANCE_MAIN_URL || buildUrl(appBaseUrl, PAGE_PATHS.main),
        probe: process.env.ACCEPTANCE_PROBE_URL || buildUrl(appBaseUrl, PAGE_PATHS.probe),
        configurator: process.env.ACCEPTANCE_CONFIGURATOR_URL || buildUrl(appBaseUrl, PAGE_PATHS.configurator)
    };

    const report = {
        cdpEndpoint,
        appBaseUrl,
        urls,
        mainFlow: await runMainFlow(cdpEndpoint, urls.main),
        presentationProbe: await runPresentationProbe(cdpEndpoint, urls.probe),
        presentationConfigurator: await runPresentationConfigurator(cdpEndpoint, urls.configurator)
    };

    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exit(1);
});
