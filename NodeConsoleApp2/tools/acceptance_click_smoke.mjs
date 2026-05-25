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

async function runLevelSelectMultiMapSmoke(cdpEndpoint, mainUrl) {
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
            const selectLevelOnMap = async ({ mapId, levelId }) => {
                const switchButton = document.querySelector('.level-map-switcher__button[data-map-id="' + mapId + '"]');
                if (!switchButton) throw new Error("找不到地图切换：" + mapId);
                switchButton.click();
                await waitForPredicate(() => document.querySelector(".level-select-runtime-map")?.dataset.mapId === mapId, "地图切换 " + mapId);
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="' + levelId + '"]'), "关卡节点 " + levelId);

                const node = document.querySelector('.level-map-node[data-level-id="' + levelId + '"]');
                if (!node || node.disabled || node.getAttribute("aria-disabled") === "true") {
                    throw new Error("关卡节点不可点击：" + levelId);
                }
                node.click();
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="' + levelId + '"][data-selected="true"]'), "选中关卡 " + levelId);

                const enterButton = document.querySelector("[data-action='enter-level']");
                if (!enterButton || enterButton.disabled || enterButton.getAttribute("aria-disabled") === "true") {
                    throw new Error("地图详情抽屉没有可用进入按钮：" + levelId);
                }
                const title = document.querySelector(".level-map-drawer__title")?.textContent.trim() || "";
                const label = document.querySelector(".level-map-drawer__label")?.textContent.trim() || "";
                return {
                    mapId,
                    levelId,
                    nodeText: node.textContent.trim().replace(/\\s+/g, " "),
                    title,
                    label,
                    enterText: enterButton.textContent.trim(),
                    selectedLevelId: document.querySelector(".level-map-node[data-selected='true']")?.dataset.levelId || "",
                    rootMapId: document.querySelector(".level-select-runtime-map")?.dataset.mapId || ""
                };
            };

            clickButtonByText("新游戏");
            await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "游戏菜单");

            clickButtonByText("关卡选择");
            await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");
            await waitForPredicate(() => document.querySelector(".level-map-switcher__button"), "地图切换按钮");

            const mapButtons = [...document.querySelectorAll(".level-map-switcher__button")].map(button => ({
                mapId: button.dataset.mapId || "",
                text: button.textContent.trim().replace(/\\s+/g, " "),
                selected: button.getAttribute("aria-selected") === "true"
            }));
            const targets = [
                { mapId: "chapter_1_authoring_map", levelId: "level_1_10" },
                { mapId: "chapter_2_authoring_map", levelId: "level_2_10" },
                { mapId: "chapter_3_authoring_map", levelId: "level_3_10" }
            ];
            const selections = [];
            for (const target of targets) {
                selections.push(await selectLevelOnMap(target));
            }

            return {
                path: "mock_ui_v11.html",
                mapButtons,
                selections,
                finalState: window.GameEngine?.fsm?.currentState || "",
                title: document.getElementById("modalTitle")?.textContent.trim() || ""
            };
        })()`);

        assertCondition(report.mapButtons.length >= 3, "关卡选择页没有暴露三张地图切换按钮");
        assertCondition(
            ["chapter_1_authoring_map", "chapter_2_authoring_map", "chapter_3_authoring_map"]
                .every(mapId => report.mapButtons.some(button => button.mapId === mapId)),
            "关卡选择页缺少第一/二/三章地图切换入口"
        );
        assertCondition(
            ["level_1_10", "level_2_10", "level_3_10"]
                .every(levelId => report.selections.some(selection => selection.levelId === levelId && selection.selectedLevelId === levelId)),
            "关卡选择页未能跨章节选中三个章节 Boss 关"
        );
        assertCondition(report.finalState === "MAIN_MENU", `多地图关卡选择 smoke 不应进入战斗，当前状态：${report.finalState}`);
        assertCondition(client.runtimeExceptions.length === 0, "多地图关卡选择页面出现 Runtime exception");
        return report;
    } finally {
        await closeClient(client);
    }
}

async function runSettlementRewardSmoke(cdpEndpoint, mainUrl) {
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
            const beforeSkillPoints = Number(window.GameEngine?.data?.playerData?.skills?.skillPoints ?? 0) || 0;
            const beforeCompleted = [...(window.GameEngine?.data?.dataConfig?.global?.progress?.completedLevels || [])];
            const beforeUnlocked = [...(window.GameEngine?.data?.dataConfig?.global?.progress?.unlockedLevels || [])];

            clickButtonByText("关卡选择");
            await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");
            await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_1"]'), "level_1_1 节点");
            const levelNode = document.querySelector('.level-map-node[data-level-id="level_1_1"]');
            levelNode.click();
            await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_1"][data-selected="true"]'), "选中 level_1_1");
            document.querySelector("[data-action='enter-level']").click();

            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP", "BATTLE_LOOP");
            await sleep(200);
            window.GameEngine.endBattle(true);
            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_SETTLEMENT"
                && document.getElementById("modalTitle")?.textContent.trim() === "战斗胜利", "战斗胜利结算");

            const settlement = window.GameEngine?.data?.dataConfig?.global?.progress?.lastSettlement || {};
            const modalText = document.getElementById("modalBody")?.textContent.replace(/\\s+/g, " ").trim() || "";
            const afterSkillPoints = Number(window.GameEngine?.data?.playerData?.skills?.skillPoints ?? 0) || 0;
            const afterCompleted = [...(window.GameEngine?.data?.dataConfig?.global?.progress?.completedLevels || [])];
            const afterUnlocked = [...(window.GameEngine?.data?.dataConfig?.global?.progress?.unlockedLevels || [])];

            clickButtonByText("返回主菜单");
            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "MAIN_MENU"
                && document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "返回主菜单");
            const mainMenuText = document.getElementById("modalBody")?.textContent.replace(/\\s+/g, " ").trim() || "";

            return {
                path: "mock_ui_v11.html",
                levelId: settlement.levelId || "",
                victory: settlement.victory === true,
                rewardKp: Number(settlement.rewards?.kp ?? 0) || 0,
                firstClear: settlement.firstClear === true,
                nextLevelId: settlement.nextLevelId || "",
                beforeSkillPoints,
                afterSkillPoints,
                beforeCompleted,
                afterCompleted,
                beforeUnlocked,
                afterUnlocked,
                modalTitle: "战斗胜利",
                modalText,
                mainMenuTitle: document.getElementById("modalTitle")?.textContent.trim() || "",
                mainMenuText,
                currentState: window.GameEngine?.fsm?.currentState || ""
            };
        })()`);

        assertCondition(report.levelId === "level_1_1", `结算关卡异常：${report.levelId}`);
        assertCondition(report.victory === true, "结算没有记录胜利");
        assertCondition(report.rewardKp > 0, "胜利结算没有发放 KP");
        assertCondition(report.afterSkillPoints === report.beforeSkillPoints + report.rewardKp, "胜利结算没有把 KP 写入玩家技能点");
        assertCondition(report.firstClear === true, "首次通关结算没有标记 firstClear");
        assertCondition(report.afterCompleted.includes("level_1_1"), "胜利结算没有写入 completedLevels");
        assertCondition(report.afterUnlocked.includes(report.nextLevelId), "胜利结算没有写入下一关解锁");
        assertCondition(report.modalText.includes("本局奖励"), "结算 UI 缺少本局奖励");
        assertCondition(report.modalText.includes("首次通关"), "结算 UI 缺少首次通关反馈");
        assertCondition(report.currentState === "MAIN_MENU", `返回主菜单后状态异常：${report.currentState}`);
        assertCondition(report.mainMenuText.includes("最近成长来源"), "主菜单没有展示最近成长来源");
        assertCondition(report.mainMenuText.includes("level_1_1") || report.mainMenuText.includes("森林"), "主菜单成长摘要没有体现最近结算关卡");
        assertCondition(client.runtimeExceptions.length === 0, "结算奖励 smoke 页面出现 Runtime exception");
        return report;
    } finally {
        await closeClient(client);
    }
}

async function runPostSettlementProgressionSmoke(cdpEndpoint, mainUrl) {
    const runScenario = async (scenario) => {
        let client = null;
        try {
            client = await attach(cdpEndpoint, mainUrl);
            await waitFor(
                client,
                `(() => document.getElementById("modalTitle")?.textContent.trim() === "欢迎"
                    && [...document.querySelectorAll("button")].some(btn => btn.textContent.trim() === "新游戏"))()`,
                `mock_ui_v11.html ${scenario} 欢迎页和新游戏按钮`
            );

            const report = await evaluate(client, `(async () => {
                const scenario = ${JSON.stringify(scenario)};
                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
                const visibleText = el => (el?.textContent || "").replace(/\\s+/g, " ").trim();
                const buttons = () => [...document.querySelectorAll("button")];
                const clickButtonByText = text => {
                    const btn = buttons().find(item => visibleText(item) === text);
                    if (!btn) throw new Error("找不到按钮：" + text);
                    btn.click();
                    return visibleText(btn);
                };
                const clickButtonContaining = text => {
                    const btn = buttons().find(item => visibleText(item).includes(text));
                    if (!btn) throw new Error("找不到包含文本的按钮：" + text);
                    btn.click();
                    return visibleText(btn);
                };
                const waitForPredicate = async (predicate, label, timeoutMs = 12000) => {
                    const started = Date.now();
                    while (Date.now() - started < timeoutMs) {
                        if (predicate()) return true;
                        await sleep(100);
                    }
                    throw new Error("等待超时：" + label);
                };
                const enterLevel111AndWin = async () => {
                    clickButtonByText("新游戏");
                    await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "游戏菜单");
                    clickButtonByText("关卡选择");
                    await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");
                    await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_1"]'), "level_1_1 节点");
                    const levelNode = document.querySelector('.level-map-node[data-level-id="level_1_1"]');
                    levelNode.click();
                    await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_1"][data-selected="true"]'), "选中 level_1_1");
                    document.querySelector("[data-action='enter-level']").click();

                    await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP", "BATTLE_LOOP");
                    await sleep(200);
                    window.GameEngine.endBattle(true);
                    await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_SETTLEMENT"
                        && document.getElementById("modalTitle")?.textContent.trim() === "战斗胜利", "战斗胜利结算");
                    return window.GameEngine?.data?.dataConfig?.global?.progress?.lastSettlement || {};
                };

                const settlement = await enterLevel111AndWin();
                const settlementText = visibleText(document.getElementById("modalBody"));

                if (scenario === "next-level-direct") {
                    const clickedNext = clickButtonContaining("前往下一关");
                    await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                        && window.GameEngine?.data?.currentLevelData?.id === "level_1_2", "进入 level_1_2");
                    await sleep(300);
                    return {
                        scenario,
                        settlementLevelId: settlement.levelId || "",
                        nextLevelId: settlement.nextLevelId || "",
                        clickedNext,
                        currentState: window.GameEngine?.fsm?.currentState || "",
                        currentLevelId: window.GameEngine?.data?.currentLevelData?.id || "",
                        currentLevelName: window.GameEngine?.data?.currentLevelData?.name || "",
                        settlementText
                    };
                }

                if (scenario !== "skill-tree-learn-then-next") {
                    throw new Error("未知 post-settlement progression scenario：" + scenario);
                }

                const beforeSkills = window.GameEngine?.data?.playerData?.skills || {};
                const beforeSkillPoints = Number(beforeSkills.skillPoints ?? 0) || 0;
                const beforeLearned = [...(Array.isArray(beforeSkills.learned) ? beforeSkills.learned : [])];
                const openedSkillTreeBy = clickButtonContaining("前往技能树 / 构筑");
                await waitForPredicate(() => document.getElementById("skillTreeOverlay")?.classList.contains("visible"), "技能树 Overlay 打开");
                await waitForPredicate(() => document.querySelector(".ui-skilltree__nodeAction"), "可学习技能 + 按钮");

                const learnAction = document.querySelector(".ui-skilltree__nodeAction");
                const learnableNode = learnAction.closest(".ui-skilltree__node");
                const learnedSkillId = learnableNode?.dataset.skillId || "";
                const learnedSkillName = learnableNode?.querySelector(".ui-skilltree__nodeTitle")?.textContent.trim() || "";
                learnAction.click();
                await waitForPredicate(() => document.querySelector('.ui-skilltree__node[data-skill-id="' + learnedSkillId + '"][data-status="PENDING"]'), "技能暂存");
                clickButtonByText("提交并关闭");
                await waitForPredicate(() => !document.getElementById("skillTreeOverlay")?.classList.contains("visible"), "技能树关闭");
                await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "MAIN_MENU"
                    && document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "回到游戏菜单");

                const afterSkills = window.GameEngine?.data?.playerData?.skills || {};
                const afterSkillPoints = Number(afterSkills.skillPoints ?? 0) || 0;
                const afterLearned = [...(Array.isArray(afterSkills.learned) ? afterSkills.learned : [])];
                const lastLearnAction = window.GameEngine?.data?.dataConfig?.global?.progress?.lastLearnAction || {};
                const mainMenuTextAfterLearn = visibleText(document.getElementById("modalBody"));

                clickButtonByText("关卡选择");
                await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_2"]'), "level_1_2 节点");
                const nextNode = document.querySelector('.level-map-node[data-level-id="level_1_2"]');
                nextNode.click();
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_2"][data-selected="true"]'), "选中 level_1_2");
                const levelSelectText = visibleText(document.getElementById("modalBody"));
                document.querySelector("[data-action='enter-level']").click();
                await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                    && window.GameEngine?.data?.currentLevelData?.id === "level_1_2", "学习后进入 level_1_2");
                await sleep(300);

                const battleSkillButtons = [...document.querySelectorAll(".skill-icon-button")];
                const battleSkillIds = battleSkillButtons
                    .map(btn => btn.dataset.id || "")
                    .filter(Boolean);
                const battleSkillText = battleSkillButtons.map(btn => visibleText(btn)).join(" ");

                return {
                    scenario,
                    settlementLevelId: settlement.levelId || "",
                    nextLevelId: settlement.nextLevelId || "",
                    openedSkillTreeBy,
                    learnedSkillId,
                    learnedSkillName,
                    beforeSkillPoints,
                    afterSkillPoints,
                    beforeLearned,
                    afterLearned,
                    lastLearnAction,
                    mainMenuTextAfterLearn,
                    levelSelectText,
                    currentState: window.GameEngine?.fsm?.currentState || "",
                    currentLevelId: window.GameEngine?.data?.currentLevelData?.id || "",
                    currentLevelName: window.GameEngine?.data?.currentLevelData?.name || "",
                    battleSkillIds,
                    battleSkillText
                };
            })()`);
            assertCondition(client.runtimeExceptions.length === 0, `${scenario} 页面出现 Runtime exception`);
            return report;
        } finally {
            await closeClient(client);
        }
    };

    const directNextLevel = await runScenario("next-level-direct");
    const skillTreeLearnThenNext = await runScenario("skill-tree-learn-then-next");

    assertCondition(directNextLevel.settlementLevelId === "level_1_1", `下一关 smoke 结算关卡异常：${directNextLevel.settlementLevelId}`);
    assertCondition(directNextLevel.nextLevelId === "level_1_2", `下一关 smoke 结算 nextLevelId 异常：${directNextLevel.nextLevelId}`);
    assertCondition(directNextLevel.clickedNext.includes("前往下一关"), "结算页没有点击前往下一关按钮");
    assertCondition(directNextLevel.currentState === "BATTLE_LOOP", `点击前往下一关后状态异常：${directNextLevel.currentState}`);
    assertCondition(directNextLevel.currentLevelId === "level_1_2", `点击前往下一关后没有进入 level_1_2：${directNextLevel.currentLevelId}`);

    assertCondition(skillTreeLearnThenNext.settlementLevelId === "level_1_1", `技能树 smoke 结算关卡异常：${skillTreeLearnThenNext.settlementLevelId}`);
    assertCondition(skillTreeLearnThenNext.nextLevelId === "level_1_2", `技能树 smoke 结算 nextLevelId 异常：${skillTreeLearnThenNext.nextLevelId}`);
    assertCondition(skillTreeLearnThenNext.openedSkillTreeBy.includes("前往技能树 / 构筑"), "结算页没有点击前往技能树 / 构筑按钮");
    assertCondition(Boolean(skillTreeLearnThenNext.learnedSkillId), "技能树 smoke 没有记录学习技能 ID");
    assertCondition(skillTreeLearnThenNext.afterLearned.includes(skillTreeLearnThenNext.learnedSkillId), "提交并关闭后 learned 没有写入新技能");
    assertCondition(skillTreeLearnThenNext.afterLearned.length === skillTreeLearnThenNext.beforeLearned.length + 1, "提交并关闭后已学技能数量没有增加 1");
    assertCondition(skillTreeLearnThenNext.afterSkillPoints < skillTreeLearnThenNext.beforeSkillPoints, "提交并关闭后 KP 没有扣减");
    assertCondition(skillTreeLearnThenNext.lastLearnAction?.learnedSkillIds?.includes(skillTreeLearnThenNext.learnedSkillId), "lastLearnAction 没有记录新学技能");
    assertCondition(skillTreeLearnThenNext.mainMenuTextAfterLearn.includes("最近学习结果"), "主菜单没有展示最近学习结果");
    assertCondition(
        skillTreeLearnThenNext.mainMenuTextAfterLearn.includes(skillTreeLearnThenNext.learnedSkillName)
            || skillTreeLearnThenNext.mainMenuTextAfterLearn.includes(skillTreeLearnThenNext.learnedSkillId),
        "主菜单最近学习结果没有展示新学技能"
    );
    assertCondition(skillTreeLearnThenNext.currentState === "BATTLE_LOOP", `学习后进入下一关状态异常：${skillTreeLearnThenNext.currentState}`);
    assertCondition(skillTreeLearnThenNext.currentLevelId === "level_1_2", `学习后没有进入 level_1_2：${skillTreeLearnThenNext.currentLevelId}`);
    assertCondition(
        skillTreeLearnThenNext.battleSkillIds.includes(skillTreeLearnThenNext.learnedSkillId)
            || skillTreeLearnThenNext.battleSkillText.includes(skillTreeLearnThenNext.learnedSkillName),
        "学习后的下一场战斗技能面板没有出现新学技能"
    );

    return {
        directNextLevel,
        skillTreeLearnThenNext
    };
}

async function runLearnedSkillBattleExecutionSmoke(cdpEndpoint, mainUrl) {
    let client = null;
    try {
        client = await attach(cdpEndpoint, mainUrl);
        await waitFor(
            client,
            `(() => document.getElementById("modalTitle")?.textContent.trim() === "欢迎"
                && [...document.querySelectorAll("button")].some(btn => btn.textContent.trim() === "新游戏"))()`,
            "mock_ui_v11.html learned skill battle execution 欢迎页和新游戏按钮"
        );

        const report = await evaluate(client, `(async () => {
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const visibleText = el => (el?.textContent || "").replace(/\\s+/g, " ").trim();
            const buttons = () => [...document.querySelectorAll("button")];
            const clickButtonByText = text => {
                const btn = buttons().find(item => visibleText(item) === text);
                if (!btn) throw new Error("找不到按钮：" + text);
                btn.click();
                return visibleText(btn);
            };
            const clickButtonContaining = text => {
                const btn = buttons().find(item => visibleText(item).includes(text));
                if (!btn) throw new Error("找不到包含文本的按钮：" + text);
                btn.click();
                return visibleText(btn);
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
            await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_1"]'), "level_1_1 节点");
            document.querySelector('.level-map-node[data-level-id="level_1_1"]').click();
            await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_1"][data-selected="true"]'), "选中 level_1_1");
            document.querySelector("[data-action='enter-level']").click();
            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP", "进入 level_1_1 战斗");
            await sleep(200);
            window.GameEngine.endBattle(true);
            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_SETTLEMENT"
                && document.getElementById("modalTitle")?.textContent.trim() === "战斗胜利", "战斗胜利结算");

            const settlement = window.GameEngine?.data?.dataConfig?.global?.progress?.lastSettlement || {};
            clickButtonContaining("前往技能树 / 构筑");
            await waitForPredicate(() => document.getElementById("skillTreeOverlay")?.classList.contains("visible"), "技能树 Overlay 打开");
            await waitForPredicate(() => document.querySelector('.ui-skilltree__node[data-skill-id="skill_block"] .ui-skilltree__nodeAction'), "修理护甲可学习 + 按钮");
            const learnAction = document.querySelector('.ui-skilltree__node[data-skill-id="skill_block"] .ui-skilltree__nodeAction');
            const learnableNode = learnAction.closest(".ui-skilltree__node");
            const newlyLearnedSkill = {
                id: learnableNode?.dataset.skillId || "",
                name: learnableNode?.querySelector(".ui-skilltree__nodeTitle")?.textContent.trim() || ""
            };
            learnAction.click();
            await waitForPredicate(() => document.querySelector('.ui-skilltree__node[data-skill-id="' + newlyLearnedSkill.id + '"][data-status="PENDING"]'), "技能暂存");
            clickButtonByText("提交并关闭");
            await waitForPredicate(() => !document.getElementById("skillTreeOverlay")?.classList.contains("visible"), "技能树关闭");
            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "MAIN_MENU"
                && document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "回到游戏菜单");

            const lastLearnAction = window.GameEngine?.data?.dataConfig?.global?.progress?.lastLearnAction || {};
            clickButtonByText("关卡选择");
            await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");
            await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_2"]'), "level_1_2 节点");
            document.querySelector('.level-map-node[data-level-id="level_1_2"]').click();
            await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="level_1_2"][data-selected="true"]'), "选中 level_1_2");
            document.querySelector("[data-action='enter-level']").click();
            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                && window.GameEngine?.data?.currentLevelData?.id === "level_1_2", "进入 level_1_2 战斗");
            await waitForPredicate(() => document.querySelector('.skill-icon-button[data-id="' + newlyLearnedSkill.id + '"]'), "新学技能按钮");
            await sleep(300);

            const skillButton = document.querySelector('.skill-icon-button[data-id="' + newlyLearnedSkill.id + '"]');
            const selectedSkillText = visibleText(skillButton);
            const disabledBeforeClick = skillButton.classList.contains("disabled") || skillButton.disabled || skillButton.getAttribute("aria-disabled") === "true";
            if (disabledBeforeClick) throw new Error("新学技能按钮不可用：" + newlyLearnedSkill.id);
            skillButton.click();
            await waitForPredicate(() => document.querySelector(".slot-placeholder.highlight-valid"), "新学技能可用槽位");
            const validSlots = [...document.querySelectorAll(".slot-placeholder.highlight-valid")].map(slot => ({
                targetType: slot.dataset.targetType || "",
                part: slot.dataset.part || "",
                slotIndex: slot.dataset.slotIndex || "0"
            }));
            const slot = document.querySelector(".slot-placeholder.highlight-valid");
            const slotKey = [slot.dataset.targetType, slot.dataset.part, slot.dataset.slotIndex || "0"].join(":");
            slot.click();
            await waitForPredicate(() => document.querySelector(".slot-placeholder.filled"), "新学技能已部署槽位");

            clickButtonByText("提交规划");
            await waitForPredicate(() => {
                const execute = document.getElementById("btnExecute");
                return execute && !execute.classList.contains("disabled") && execute.getAttribute("aria-disabled") !== "true";
            }, "执行回合 可用");
            const plannedActions = [...(window.GameEngine?.playerSkillQueue || [])];
            const plannedLearnedSkillAction = plannedActions.find(action => action.skillId === newlyLearnedSkill.id) || null;
            const timelineBeforeExecute = window.GameEngine?.timeline?.phase || "";
            clickButtonByText("执行回合");
            await waitForPredicate(() => window.GameEngine?.battlePhase === "EXECUTION"
                || window.GameEngine?.timeline?.phase === "PLAYING"
                || window.GameEngine?.timeline?.phase === "FINISHED"
                || window.GameEngine?.currentTurn > 1, "新学技能执行触发");
            await sleep(1200);

            const runtimeHistory = [...(window.GameEngine?.data?.dataConfig?.runtime?.history || [])];
            const executedLearnedSkill = runtimeHistory.some(entry => JSON.stringify(entry).includes(newlyLearnedSkill.id))
                || [...(window.GameEngine?.playerSkillQueue || [])].some(action => action.skillId === newlyLearnedSkill.id)
                || Boolean(plannedLearnedSkillAction);

            return {
                path: "mock_ui_v11.html",
                settlementLevelId: settlement.levelId || "",
                nextLevelId: settlement.nextLevelId || "",
                newlyLearnedSkill,
                lastLearnAction,
                currentLevelId: window.GameEngine?.data?.currentLevelData?.id || "",
                selectedSkillText,
                disabledBeforeClick,
                validSlots,
                slotKey,
                plannedLearnedSkillAction,
                plannedActionSkillIds: plannedActions.map(action => action.skillId),
                timelineBeforeExecute,
                timelineAfterExecute: window.GameEngine?.timeline?.phase || "",
                battlePhase: window.GameEngine?.battlePhase || "",
                currentTurn: window.GameEngine?.currentTurn || 0,
                executedLearnedSkill
            };
        })()`);

        assertCondition(report.settlementLevelId === "level_1_1", `新学技能实战 smoke 结算关卡异常：${report.settlementLevelId}`);
        assertCondition(report.nextLevelId === "level_1_2", `新学技能实战 smoke nextLevelId 异常：${report.nextLevelId}`);
        assertCondition(Boolean(report.newlyLearnedSkill?.id), "新学技能实战 smoke 没有记录新学技能");
        assertCondition(report.newlyLearnedSkill.id === "skill_block", `新学技能实战 smoke 未学习稳定可部署技能 skill_block：${report.newlyLearnedSkill.id}`);
        assertCondition(report.lastLearnAction?.learnedSkillIds?.includes(report.newlyLearnedSkill.id), "lastLearnAction 未记录新学技能");
        assertCondition(report.currentLevelId === "level_1_2", `新学技能实战 smoke 未进入 level_1_2：${report.currentLevelId}`);
        assertCondition(report.selectedSkillText.includes(report.newlyLearnedSkill.name), "没有点击新学技能按钮");
        assertCondition(report.disabledBeforeClick === false, "新学技能按钮进入下一关后仍不可用");
        assertCondition(report.validSlots.length > 0, "新学技能没有可部署槽位");
        assertCondition(report.plannedLearnedSkillAction?.skillId === report.newlyLearnedSkill.id, "提交规划没有包含新学技能行动");
        assertCondition(report.executedLearnedSkill === true, "执行回合没有覆盖新学技能行动");
        assertCondition(["PLAYING", "FINISHED", "IDLE", "READY"].includes(report.timelineAfterExecute), `新学技能执行后 timelinePhase 异常：${report.timelineAfterExecute}`);
        assertCondition(report.currentTurn >= 1, "新学技能执行后没有有效回合");
        assertCondition(client.runtimeExceptions.length === 0, "新学技能实战 smoke 页面出现 Runtime exception");
        return report;
    } finally {
        await closeClient(client);
    }
}

async function runChapterProgressionSmoke(cdpEndpoint, mainUrl, options) {
    const {
        label,
        mapId,
        targetLevelIds,
        learnSkillBlockAfterFirst = false,
        finalCompletionMessage,
        expectedFinalUnlockedLevelId = ""
    } = options;
    let client = null;
    try {
        client = await attach(cdpEndpoint, mainUrl);
        await waitFor(
            client,
            `(() => document.getElementById("modalTitle")?.textContent.trim() === "欢迎"
                && [...document.querySelectorAll("button")].some(btn => btn.textContent.trim() === "新游戏"))()`,
            `mock_ui_v11.html ${label} progression 欢迎页和新游戏按钮`
        );

        const report = await evaluate(client, `(async () => {
            const mapId = ${JSON.stringify(mapId || "")};
            const targetLevelIds = ${JSON.stringify(targetLevelIds)};
            const learnSkillBlockAfterFirst = ${learnSkillBlockAfterFirst ? "true" : "false"};
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const visibleText = el => (el?.textContent || "").replace(/\\s+/g, " ").trim();
            const buttons = () => [...document.querySelectorAll("button")];
            const clickButtonByText = text => {
                const btn = buttons().find(item => visibleText(item) === text);
                if (!btn) throw new Error("找不到按钮：" + text);
                btn.click();
                return visibleText(btn);
            };
            const clickButtonContaining = text => {
                const btn = buttons().find(item => visibleText(item).includes(text));
                if (!btn) throw new Error("找不到包含文本的按钮：" + text);
                btn.click();
                return visibleText(btn);
            };
            const waitForPredicate = async (predicate, label, timeoutMs = 12000) => {
                const started = Date.now();
                while (Date.now() - started < timeoutMs) {
                    if (predicate()) return true;
                    await sleep(100);
                }
                throw new Error("等待超时：" + label);
            };
            const enterLevelFromMenu = async (levelId) => {
                clickButtonByText("关卡选择");
                await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");
                if (mapId) {
                    await waitForPredicate(() => document.querySelector('.level-map-switcher__button[data-map-id="' + mapId + '"]'), "地图切换按钮 " + mapId);
                    const switchButton = document.querySelector('.level-map-switcher__button[data-map-id="' + mapId + '"]');
                    switchButton.click();
                    await waitForPredicate(() => document.querySelector(".level-select-runtime-map")?.dataset.mapId === mapId, "地图切换 " + mapId);
                }
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="' + levelId + '"]'), levelId + " 节点");
                const node = document.querySelector('.level-map-node[data-level-id="' + levelId + '"]');
                if (!node || node.disabled || node.getAttribute("aria-disabled") === "true") {
                    throw new Error("关卡节点不可进入：" + levelId);
                }
                node.click();
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="' + levelId + '"][data-selected="true"]'), "选中 " + levelId);
                const enterButton = document.querySelector("[data-action='enter-level']");
                if (!enterButton || enterButton.disabled || enterButton.getAttribute("aria-disabled") === "true") {
                    throw new Error("进入关卡按钮不可用：" + levelId);
                }
                const drawerTitle = document.querySelector(".level-map-drawer__title")?.textContent.trim() || "";
                enterButton.click();
                await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                    && window.GameEngine?.data?.currentLevelData?.id === levelId, "进入 " + levelId);
                await sleep(250);
                return drawerTitle;
            };
            const executeOneRound = async (levelId) => {
                await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                    && window.GameEngine?.data?.currentLevelData?.id === levelId, levelId + " 战斗中");
                await waitForPredicate(() => document.getElementById("btnCommitPlanning") && document.getElementById("btnExecute"), levelId + " 战斗按钮");
                const turnBefore = Number(window.GameEngine?.currentTurn ?? 0) || 0;
                let selectedSkill = null;
                let slotKey = "";
                const skillButtons = [...document.querySelectorAll(".skill-icon-button")]
                    .filter(btn => !btn.classList.contains("disabled") && !btn.disabled && btn.getAttribute("aria-disabled") !== "true");
                for (const skillButton of skillButtons) {
                    skillButton.click();
                    await sleep(150);
                    const slot = document.querySelector(".slot-placeholder.highlight-valid");
                    if (!slot) continue;
                    selectedSkill = {
                        id: skillButton.dataset.id || "",
                        text: visibleText(skillButton)
                    };
                    slotKey = [slot.dataset.targetType, slot.dataset.part, slot.dataset.slotIndex || "0"].join(":");
                    slot.click();
                    break;
                }
                if (!selectedSkill) {
                    throw new Error(levelId + " 没有可部署技能");
                }
                await waitForPredicate(() => document.querySelector(".slot-placeholder.filled"), levelId + " 草稿槽位");
                clickButtonByText("提交规划");
                await waitForPredicate(() => {
                    const execute = document.getElementById("btnExecute");
                    return execute && !execute.classList.contains("disabled") && execute.getAttribute("aria-disabled") !== "true";
                }, levelId + " 执行回合可用");
                const plannedActions = [...(window.GameEngine?.playerSkillQueue || [])].map(action => ({
                    skillId: action.skillId,
                    bodyPart: action.bodyPart || "",
                    targetId: action.targetId || ""
                }));
                const timelineBeforeExecute = window.GameEngine?.timeline?.phase || "";
                clickButtonByText("执行回合");
                await waitForPredicate(() => window.GameEngine?.battlePhase === "EXECUTION"
                    || window.GameEngine?.timeline?.phase === "PLAYING"
                    || window.GameEngine?.timeline?.phase === "FINISHED"
                    || Number(window.GameEngine?.currentTurn ?? 0) > turnBefore, levelId + " 执行回合触发");
                await sleep(1100);
                const currentTurn = Number(window.GameEngine?.currentTurn ?? 0) || 0;
                const timelineAfterExecute = window.GameEngine?.timeline?.phase || "";
                return {
                    levelId,
                    selectedSkill,
                    slotKey,
                    plannedActions,
                    turnBefore,
                    currentTurn,
                    timelineBeforeExecute,
                    timelineAfterExecute,
                    battlePhase: window.GameEngine?.battlePhase || "",
                    roundExecuted: currentTurn > turnBefore || ["PLAYING", "FINISHED", "IDLE", "READY"].includes(timelineAfterExecute)
                };
            };
            const forceVictorySettlement = async (levelId) => {
                window.GameEngine.endBattle(true);
                await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_SETTLEMENT"
                    && document.getElementById("modalTitle")?.textContent.trim() === "战斗胜利", levelId + " 胜利结算");
                const settlement = window.GameEngine?.data?.dataConfig?.global?.progress?.lastSettlement || {};
                const progress = window.GameEngine?.data?.dataConfig?.global?.progress || {};
                return {
                    levelId: settlement.levelId || "",
                    victory: settlement.victory === true,
                    rewardKp: Number(settlement.rewards?.kp ?? 0) || 0,
                    firstClear: settlement.firstClear === true,
                    nextLevelId: settlement.nextLevelId || "",
                    skillPoints: Number(window.GameEngine?.data?.playerData?.skills?.skillPoints ?? 0) || 0,
                    completedLevels: [...(progress.completedLevels || [])],
                    unlockedLevels: [...(progress.unlockedLevels || [])],
                    modalText: visibleText(document.getElementById("modalBody"))
                };
            };
            const learnSkillBlockFromSettlement = async () => {
                const openedBy = clickButtonContaining("前往技能树 / 构筑");
                await waitForPredicate(() => document.getElementById("skillTreeOverlay")?.classList.contains("visible"), "技能树 Overlay 打开");
                await waitForPredicate(() => document.querySelector('.ui-skilltree__node[data-skill-id="skill_block"]'), "skill_block 节点");
                const beforeSkills = window.GameEngine?.data?.playerData?.skills || {};
                const beforeSkillPoints = Number(beforeSkills.skillPoints ?? 0) || 0;
                const beforeLearned = [...(beforeSkills.learned || [])];
                const learnAction = document.querySelector('.ui-skilltree__node[data-skill-id="skill_block"] .ui-skilltree__nodeAction');
                if (!learnAction) {
                    throw new Error("连续推进 smoke 找不到 skill_block 学习按钮");
                }
                learnAction.click();
                await waitForPredicate(() => document.querySelector('.ui-skilltree__node[data-skill-id="skill_block"][data-status="PENDING"]'), "skill_block 暂存");
                clickButtonByText("提交并关闭");
                await waitForPredicate(() => !document.getElementById("skillTreeOverlay")?.classList.contains("visible"), "技能树关闭");
                await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "MAIN_MENU"
                    && document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "学习后回到主菜单");
                const afterSkills = window.GameEngine?.data?.playerData?.skills || {};
                const afterLearned = [...(afterSkills.learned || [])];
                const afterSkillPoints = Number(afterSkills.skillPoints ?? 0) || 0;
                const lastLearnAction = window.GameEngine?.data?.dataConfig?.global?.progress?.lastLearnAction || {};
                return {
                    openedBy,
                    learnedSkillId: "skill_block",
                    beforeSkillPoints,
                    afterSkillPoints,
                    beforeLearned,
                    afterLearned,
                    lastLearnAction,
                    mainMenuText: visibleText(document.getElementById("modalBody"))
                };
            };

            clickButtonByText("新游戏");
            await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "游戏菜单");
            const levelEntries = [];
            const roundSnapshots = [];
            const settlementSnapshots = [];
            const learnedSnapshots = [];

            const firstDrawerTitle = await enterLevelFromMenu(targetLevelIds[0]);
            levelEntries.push({ levelId: targetLevelIds[0], enteredBy: "level-select", drawerTitle: firstDrawerTitle });

            for (let index = 0; index < targetLevelIds.length; index += 1) {
                const levelId = targetLevelIds[index];
                roundSnapshots.push(await executeOneRound(levelId));
                const settlement = await forceVictorySettlement(levelId);
                settlementSnapshots.push(settlement);

                if (index === 0 && learnSkillBlockAfterFirst) {
                    learnedSnapshots.push(await learnSkillBlockFromSettlement());
                    const nextLevelId = targetLevelIds[index + 1];
                    const drawerTitle = await enterLevelFromMenu(nextLevelId);
                    levelEntries.push({ levelId: nextLevelId, enteredBy: "level-select-after-learning", drawerTitle });
                    continue;
                }

                if (index < targetLevelIds.length - 1) {
                    const nextLevelId = targetLevelIds[index + 1];
                    const clickedNext = clickButtonContaining("前往下一关");
                    await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                        && window.GameEngine?.data?.currentLevelData?.id === nextLevelId, "前往下一关 " + nextLevelId);
                    await sleep(250);
                    levelEntries.push({ levelId: nextLevelId, enteredBy: "settlement-next", clickedNext });
                }
            }

            return {
                path: "mock_ui_v11.html",
                mapId,
                targetLevelIds,
                levelEntries,
                roundSnapshots,
                settlementSnapshots,
                learnedSnapshots,
                completedLevels: [...(window.GameEngine?.data?.dataConfig?.global?.progress?.completedLevels || [])],
                unlockedLevels: [...(window.GameEngine?.data?.dataConfig?.global?.progress?.unlockedLevels || [])],
                finalState: window.GameEngine?.fsm?.currentState || "",
                finalTitle: document.getElementById("modalTitle")?.textContent.trim() || ""
            };
        })()`);

        const expectedLevelIds = targetLevelIds;
        assertCondition(
            JSON.stringify(report.targetLevelIds) === JSON.stringify(expectedLevelIds),
            `${label} 连续推进 smoke 目标关卡异常：${JSON.stringify(report.targetLevelIds)}`
        );
        assertCondition(report.levelEntries.length === expectedLevelIds.length, `${label} 连续推进 smoke 没有进入 ${expectedLevelIds.length} 个关卡`);
        assertCondition(report.roundSnapshots.length === expectedLevelIds.length, `${label} 连续推进 smoke 没有记录 ${expectedLevelIds.length} 个回合执行`);
        assertCondition(report.settlementSnapshots.length === expectedLevelIds.length, `${label} 连续推进 smoke 没有记录 ${expectedLevelIds.length} 个结算`);
        for (const levelId of expectedLevelIds) {
            const round = report.roundSnapshots.find(item => item.levelId === levelId);
            const settlement = report.settlementSnapshots.find(item => item.levelId === levelId);
            assertCondition(round?.roundExecuted === true, `${levelId} 没有执行至少一回合`);
            assertCondition(Boolean(round?.selectedSkill?.id), `${levelId} 没有记录已部署技能`);
            assertCondition(round?.plannedActions?.length > 0, `${levelId} 没有提交玩家规划`);
            assertCondition(settlement?.victory === true, `${levelId} 没有胜利结算`);
            assertCondition(settlement?.completedLevels?.includes(levelId), `${levelId} 没有写入 completedLevels`);
            const levelIndex = expectedLevelIds.indexOf(levelId);
            const expectedNextLevelId = expectedLevelIds[levelIndex + 1] || expectedFinalUnlockedLevelId;
            if (expectedNextLevelId) {
                assertCondition(settlement?.nextLevelId === expectedNextLevelId, `${levelId} nextLevelId 异常：${settlement?.nextLevelId}`);
            }
        }
        if (learnSkillBlockAfterFirst) {
            assertCondition(
                report.learnedSnapshots.some(item => item.learnedSkillId === "skill_block" && item.afterLearned.includes("skill_block")),
                `${label} 连续推进 smoke 没有在结算后学习 skill_block`
            );
        }
        assertCondition(
            expectedLevelIds.every(levelId => report.completedLevels.includes(levelId)),
            finalCompletionMessage
        );
        if (expectedFinalUnlockedLevelId) {
            assertCondition(
                report.unlockedLevels.includes(expectedFinalUnlockedLevelId),
                `${label} 连续推进 smoke 最终未解锁 ${expectedFinalUnlockedLevelId}`
            );
        }
        assertCondition(report.finalState === "BATTLE_SETTLEMENT", `连续推进 smoke 结束状态异常：${report.finalState}`);
        assertCondition(client.runtimeExceptions.length === 0, "连续推进 smoke 页面出现 Runtime exception");
        return report;
    } finally {
        await closeClient(client);
    }
}

async function runChapterOneProgressionSmoke(cdpEndpoint, mainUrl) {
    const targetLevelIds = ["level_1_1", "level_1_2", "level_1_3", "level_1_4", "level_1_5", "level_1_6", "level_1_7", "level_1_8", "level_1_9", "level_1_10"];
    return runChapterProgressionSmoke(cdpEndpoint, mainUrl, {
        label: "chapter one",
        mapId: "chapter_1_authoring_map",
        targetLevelIds,
        learnSkillBlockAfterFirst: true,
        finalCompletionMessage: "连续推进 smoke 最终 completedLevels 未覆盖第一章完整 10 关",
        expectedFinalUnlockedLevelId: "level_2_1"
    });
}

async function runChapterTwoProgressionSmoke(cdpEndpoint, mainUrl) {
    const targetLevelIds = ["level_2_1", "level_2_2", "level_2_3", "level_2_4", "level_2_5", "level_2_6", "level_2_7", "level_2_8", "level_2_9", "level_2_10"];
    return runChapterProgressionSmoke(cdpEndpoint, mainUrl, {
        label: "chapter two",
        mapId: "chapter_2_authoring_map",
        targetLevelIds,
        finalCompletionMessage: "连续推进 smoke 最终 completedLevels 未覆盖第二章完整 10 关",
        expectedFinalUnlockedLevelId: "level_3_1"
    });
}

async function runChapterThreeProgressionSmoke(cdpEndpoint, mainUrl) {
    const targetLevelIds = ["level_3_1", "level_3_2", "level_3_3", "level_3_4", "level_3_5", "level_3_6", "level_3_7", "level_3_8", "level_3_9", "level_3_10"];
    return runChapterProgressionSmoke(cdpEndpoint, mainUrl, {
        label: "chapter three",
        mapId: "chapter_3_authoring_map",
        targetLevelIds,
        finalCompletionMessage: "连续推进 smoke 最终 completedLevels 未覆盖第三章完整 10 关"
    });
}

async function runNaturalBattleAutoplaySmoke(cdpEndpoint, mainUrl) {
    const naturalBalanceProbeBuild = Object.freeze({
        id: "recommended",
        label: "推荐构筑",
        learned: [
            "skill_heal",
            "skill_block",
            "skill_heavy_swing",
            "skill_skull_cracker",
            "skill_shockwave_copy_1770042951717",
            "skill_execute",
            "skill_execute_copy_1770043820577",
            "skill_1771769351059",
            "skill_leftover_lunchbox"
        ],
        maxAp: 8,
        hpBonus: 20
    });
    const naturalCheckpoints = [
        {
            levelId: "level_1_1",
            mapId: "chapter_1_authoring_map",
            label: "第一章开局自然基线",
            maxNaturalTurns: 12,
            skillLoadoutSource: "default_starting_skills",
            requireVictory: true
        },
        {
            levelId: "level_1_4",
            mapId: "chapter_1_authoring_map",
            label: "第一章中段压力检查",
            maxNaturalTurns: 12,
            skillLoadoutSource: "naturalBalanceProbeBuild",
            requireVictory: false
        },
        {
            levelId: "level_1_10",
            mapId: "chapter_1_authoring_map",
            label: "第一章 Boss 压力检查",
            maxNaturalTurns: 14,
            skillLoadoutSource: "naturalBalanceProbeBuild",
            requireVictory: false
        },
        {
            levelId: "level_2_5",
            mapId: "chapter_2_authoring_map",
            label: "第二章护甲检查点",
            maxNaturalTurns: 14,
            skillLoadoutSource: "naturalBalanceProbeBuild",
            requireVictory: false
        },
        {
            levelId: "level_2_10",
            mapId: "chapter_2_authoring_map",
            label: "第二章 Boss 压力检查",
            maxNaturalTurns: 16,
            skillLoadoutSource: "naturalBalanceProbeBuild",
            requireVictory: false
        },
        {
            levelId: "level_3_10",
            mapId: "chapter_3_authoring_map",
            label: "第三章终局 Boss 压力检查",
            maxNaturalTurns: 18,
            skillLoadoutSource: "naturalBalanceProbeBuild",
            requireVictory: false
        }
    ];

    const readNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const buildLethalFailureDiagnosis = report => {
        const turns = Array.isArray(report?.naturalTurnSnapshots) ? report.naturalTurnSnapshots : [];
        const finalTurn = turns.at(-1) || {};
        const before = finalTurn.before || {};
        const after = finalTurn.after || report?.finalVitals || {};
        const playerHpBeforeFinalTurn = readNumber(before.playerHp);
        const enemyRemainingHpBeforeFinalTurn = readNumber(before.enemyRemainingHp);
        const playerHpAfterFinalTurn = readNumber(after.playerHp ?? report?.finalVitals?.playerHp);
        const enemyRemainingHpAfterFinalTurn = readNumber(after.enemyRemainingHp ?? report?.finalVitals?.enemyRemainingHp);
        const mutualKill = report?.naturalOutcome === "defeat"
            && playerHpAfterFinalTurn <= 0
            && enemyRemainingHpAfterFinalTurn <= 0;
        let diagnosisCode = "not_failed";
        if (mutualKill) {
            diagnosisCode = "mutual_kill_settlement_loss";
        } else if (report?.naturalOutcome === "defeat" && playerHpAfterFinalTurn <= 0) {
            diagnosisCode = "lethal_enemy_pressure";
        } else if (["turn_limit", "turn_wait_timeout"].includes(report?.naturalOutcome)) {
            diagnosisCode = "timeout_pressure_or_damage_gap";
        } else if (report?.naturalOutcome === "no_deployable_skill") {
            diagnosisCode = "no_player_action";
        }
        return {
            diagnosisCode,
            mutualKill,
            playerHpBeforeFinalTurn,
            enemyRemainingHpBeforeFinalTurn,
            playerHpAfterFinalTurn,
            enemyRemainingHpAfterFinalTurn,
            turnsTaken: turns.length,
            finalPlannedSkillIds: Array.isArray(finalTurn.plannedActions)
                ? finalTurn.plannedActions.map(action => action.skillId || "").filter(Boolean)
                : []
        };
    };

    const runNaturalCheckpoint = async (checkpoint) => {
        let client = null;
        try {
            client = await attach(cdpEndpoint, mainUrl);
            await waitFor(
                client,
                `(() => document.getElementById("modalTitle")?.textContent.trim() === "欢迎"
                    && [...document.querySelectorAll("button")].some(btn => btn.textContent.trim() === "新游戏"))()`,
                `mock_ui_v11.html natural battle autoplay ${checkpoint.levelId} 欢迎页和新游戏按钮`
            );

            const report = await evaluate(client, `(async () => {
            const checkpoint = ${JSON.stringify(checkpoint)};
            const naturalBalanceProbeBuild = ${JSON.stringify(naturalBalanceProbeBuild)};
            const targetLevelId = checkpoint.levelId;
            const maxNaturalTurns = Number(checkpoint.maxNaturalTurns ?? 12) || 12;
            const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
            const visibleText = el => (el?.textContent || "").replace(/\\s+/g, " ").trim();
            const buttons = () => [...document.querySelectorAll("button")];
            const clickButtonByText = text => {
                const btn = buttons().find(item => visibleText(item) === text);
                if (!btn) throw new Error("找不到按钮：" + text);
                btn.click();
                return visibleText(btn);
            };
            const waitForPredicate = async (predicate, label, timeoutMs = 15000) => {
                const started = Date.now();
                while (Date.now() - started < timeoutMs) {
                    if (predicate()) return true;
                    await sleep(100);
                }
                throw new Error("等待超时：" + label);
            };
            const getEntityHp = entity => Number(entity?.hp ?? entity?.stats?.hp ?? 0) || 0;
            const getEntityMaxHp = entity => Number(entity?.maxHp ?? entity?.stats?.maxHp ?? entity?.stats?.hp ?? entity?.hp ?? 0) || 0;
            const getSkillAp = skill => Number(skill?.costs?.ap ?? skill?.cost?.ap ?? skill?.apCost ?? 0) || 0;
            const getSkillEffects = skill => [
                ...(Array.isArray(skill?.effects) ? skill.effects : []),
                ...(Array.isArray(skill?.actions) ? skill.actions.map(action => action?.effect).filter(Boolean) : [])
            ];
            const summarizeSkill = skill => {
                const summary = { damageHp: 0, damageArmor: 0, heal: 0, armorAdd: 0, dot: 0, control: 0 };
                for (const effect of getSkillEffects(skill)) {
                    const amount = Math.max(0, Number(effect?.amount ?? effect?.value ?? 0) || 0);
                    if (effect?.effectType === "DMG_HP") summary.damageHp += amount;
                    if (effect?.effectType === "DMG_ARMOR") summary.damageArmor += amount;
                    if (effect?.effectType === "HEAL") summary.heal += amount;
                    if (effect?.effectType === "ARMOR_ADD") summary.armorAdd += amount;
                }
                const appliedBuffs = [
                    ...(Array.isArray(skill?.buffRefs?.apply) ? skill.buffRefs.apply : []),
                    ...(Array.isArray(skill?.buffRefs?.applySelf) ? skill.buffRefs.applySelf : [])
                ];
                for (const row of appliedBuffs) {
                    if (["buff_bleed", "buff_poison", "buff_tear_wound"].includes(row?.buffId)) summary.dot += 10;
                    if (["buff_slow", "buff_vulnerable"].includes(row?.buffId)) summary.control += 6;
                }
                return summary;
            };
            const getCandidateParts = (skill, target) => {
                const fromSkill = Array.isArray(skill?.target?.selection?.candidateParts) ? skill.target.selection.candidateParts : [];
                if (fromSkill.length > 0) return fromSkill;
                return Object.keys(target?.bodyParts || {});
            };
            const pickWeakestPart = (target, skill) => {
                const candidates = getCandidateParts(skill, target)
                    .map(part => ({ part, data: target?.bodyParts?.[part] }))
                    .filter(entry => entry.data);
                if (candidates.length === 0) return null;
                candidates.sort((a, b) => {
                    const armorA = Number(a.data.current ?? 0) || 0;
                    const armorB = Number(b.data.current ?? 0) || 0;
                    if (armorA !== armorB) return armorA - armorB;
                    const weakA = Number(a.data.weakness ?? 1) || 1;
                    const weakB = Number(b.data.weakness ?? 1) || 1;
                    return weakB - weakA;
                });
                return candidates[0].part;
            };
            const pickMostDamagedSelfPart = player => {
                const damaged = Object.entries(player?.bodyParts || {})
                    .map(([part, data]) => ({
                        part,
                        missing: Math.max(0, (Number(data?.max ?? 0) || 0) - (Number(data?.current ?? 0) || 0))
                    }))
                    .filter(row => row.missing > 0)
                    .sort((a, b) => b.missing - a.missing);
                return damaged[0]?.part || "chest";
            };
            const findPrimaryEnemy = () => [...(window.GameEngine?.data?.currentLevelData?.enemies || [])]
                .filter(enemy => getEntityHp(enemy) > 0)
                .sort((a, b) => {
                    const hpA = getEntityHp(a);
                    const hpB = getEntityHp(b);
                    if (hpA !== hpB) return hpA - hpB;
                    return String(a.id).localeCompare(String(b.id));
                })[0] || null;
            const scoreSkill = ({ skill, player, target }) => {
                const subject = skill?.target?.subject || "";
                const summary = summarizeSkill(skill);
                const playerHpRatio = getEntityMaxHp(player) > 0 ? getEntityHp(player) / getEntityMaxHp(player) : 1;
                const missingHp = Math.max(0, getEntityMaxHp(player) - getEntityHp(player));
                if (subject === "SUBJECT_SELF") {
                    const missingArmor = Object.values(player?.bodyParts || {})
                        .reduce((sum, part) => sum + Math.max(0, (Number(part?.max ?? 0) || 0) - (Number(part?.current ?? 0) || 0)), 0);
                    let score = 0;
                    if (summary.heal > 0 && missingHp > 0) score += Math.min(missingHp, summary.heal) * (playerHpRatio < 0.7 ? 3.2 : 1.2);
                    if (summary.armorAdd > 0 && missingArmor > 0) score += Math.min(missingArmor, summary.armorAdd) * (playerHpRatio < 0.75 ? 2.2 : 1.1);
                    return score;
                }

                const selectedPart = pickWeakestPart(target, skill);
                const selectedArmor = Math.max(0, Number(target?.bodyParts?.[selectedPart]?.current ?? 0) || 0);
                const hpThroughArmor = Math.max(0, summary.damageHp - selectedArmor);
                const armorFromHpSkill = Math.min(selectedArmor, summary.damageHp);
                const armorFromArmorSkill = Math.min(selectedArmor, summary.damageArmor);
                let score = hpThroughArmor * 3 + armorFromHpSkill * 0.8 + armorFromArmorSkill * 1.6 + summary.dot + summary.control;
                if (getEntityHp(target) <= Math.max(summary.damageHp, hpThroughArmor)) score += 120;
                if (selectedPart === "head") score += 8;
                return score;
            };
            const snapshotVitals = () => {
                const player = window.GameEngine?.data?.playerData || {};
                const enemies = [...(window.GameEngine?.data?.currentLevelData?.enemies || [])].map(enemy => ({
                    id: enemy.id || "",
                    name: enemy.name || "",
                    hp: getEntityHp(enemy),
                    maxHp: getEntityMaxHp(enemy),
                    bodyParts: JSON.parse(JSON.stringify(enemy.bodyParts || {}))
                }));
                return {
                    playerHp: getEntityHp(player),
                    playerMaxHp: getEntityMaxHp(player),
                    playerBodyParts: JSON.parse(JSON.stringify(player.bodyParts || {})),
                    enemies,
                    enemyRemainingHp: enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0)
                };
            };
            const chooseAndPlaceSkills = async () => {
                await waitForPredicate(() => document.getElementById("btnCommitPlanning") && document.getElementById("btnExecute"), "自然战斗按钮");
                const player = window.GameEngine?.data?.playerData || {};
                const target = findPrimaryEnemy();
                if (!target) return { placed: [], reason: "no_live_enemy" };

                const candidates = [...document.querySelectorAll(".skill-icon-button")]
                    .filter(btn => !btn.classList.contains("disabled") && !btn.disabled && btn.getAttribute("aria-disabled") !== "true")
                    .map(btn => {
                        const skill = window.GameEngine?.data?.getSkillConfig?.(btn.dataset.id);
                        return { btn, skill, score: skill ? scoreSkill({ skill, player, target }) : 0 };
                    })
                    .filter(row => row.skill && row.score > 0)
                    .sort((a, b) => b.score - a.score);

                const placed = [];
                let remainingAp = Number(player?.stats?.ap ?? 0) || 0;
                for (const row of candidates) {
                    const ap = getSkillAp(row.skill);
                    if (ap > remainingAp) continue;
                    row.btn.click();
                    await sleep(120);
                    const subject = row.skill?.target?.subject || "";
                    const desiredPart = subject === "SUBJECT_SELF" ? pickMostDamagedSelfPart(player) : pickWeakestPart(target, row.skill);
                    const desiredTargetType = subject === "SUBJECT_SELF" ? "self" : "enemy";
                    const slots = [...document.querySelectorAll(".slot-placeholder.highlight-valid:not(.filled)")];
                    const slot = slots.find(item => item.dataset.targetType === desiredTargetType && item.dataset.part === desiredPart)
                        || slots.find(item => item.dataset.targetType === desiredTargetType)
                        || slots[0];
                    if (!slot) {
                        row.btn.click();
                        await sleep(80);
                        continue;
                    }
                    const slotKey = [slot.dataset.targetType, slot.dataset.part, slot.dataset.slotIndex || "0"].join(":");
                    slot.click();
                    await sleep(160);
                    if (!document.querySelector('.slot-placeholder.filled[data-occupied-skill-id="' + row.skill.id + '"]')) {
                        continue;
                    }
                    placed.push({
                        skillId: row.skill.id,
                        skillName: row.skill.name || row.skill.id,
                        score: row.score,
                        ap,
                        slotKey
                    });
                    remainingAp -= ap;
                }
                return {
                    placed,
                    reason: placed.length > 0 ? "planned" : "no_deployable_skill"
                };
            };
            const applyCheckpointSkillLoadout = () => {
                const player = window.GameEngine?.data?.playerData;
                if (!player || !player.stats || !player.skills) {
                    return { skillLoadoutSource: "missing_player_data", learned: [], maxAp: 0, maxHp: 0 };
                }

                if (checkpoint.skillLoadoutSource !== "naturalBalanceProbeBuild") {
                    return {
                        skillLoadoutSource: checkpoint.skillLoadoutSource || "default_starting_skills",
                        learned: [...(Array.isArray(player.skills.learned) ? player.skills.learned : [])],
                        maxAp: Number(player.stats.maxAp ?? player.stats.ap ?? 0) || 0,
                        maxHp: Number(player.stats.maxHp ?? player.stats.hp ?? 0) || 0
                    };
                }

                const baseMaxHp = Number(player.stats.maxHp ?? player.stats.hp ?? 100) || 100;
                const nextMaxHp = Math.max(1, baseMaxHp + (Number(naturalBalanceProbeBuild.hpBonus) || 0));
                const nextMaxAp = Math.max(1, Number(naturalBalanceProbeBuild.maxAp ?? player.stats.maxAp ?? player.stats.ap ?? 6) || 6);
                player.skills.learned = [...new Set(naturalBalanceProbeBuild.learned || [])];
                player.stats.maxHp = nextMaxHp;
                player.stats.hp = nextMaxHp;
                player.stats.maxAp = nextMaxAp;
                player.stats.ap = nextMaxAp;
                return {
                    skillLoadoutSource: "naturalBalanceProbeBuild",
                    buildId: naturalBalanceProbeBuild.id || "",
                    buildLabel: naturalBalanceProbeBuild.label || "",
                    learned: [...player.skills.learned],
                    maxAp: nextMaxAp,
                    maxHp: nextMaxHp
                };
            };
            const ensureLevelUnlocked = levelId => {
                const progress = window.GameEngine?.data?.dataConfig?.global?.progress;
                if (!progress) return [];
                if (!Array.isArray(progress.unlockedLevels)) progress.unlockedLevels = [];
                if (!progress.unlockedLevels.includes(levelId)) progress.unlockedLevels.push(levelId);
                return [...progress.unlockedLevels];
            };
            const selectCheckpointLevel = async () => {
                clickButtonByText("关卡选择");
                await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "选择关卡", "选择关卡");
                if (checkpoint.mapId) {
                    await waitForPredicate(() => document.querySelector('.level-map-switcher__button[data-map-id="' + checkpoint.mapId + '"]'), "地图切换 " + checkpoint.mapId);
                    const switchButton = document.querySelector('.level-map-switcher__button[data-map-id="' + checkpoint.mapId + '"]');
                    switchButton.click();
                    await waitForPredicate(() => document.querySelector(".level-select-runtime-map")?.dataset.mapId === checkpoint.mapId, "地图已切换 " + checkpoint.mapId);
                }
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="' + targetLevelId + '"]'), targetLevelId + " 节点");
                const levelNode = document.querySelector('.level-map-node[data-level-id="' + targetLevelId + '"]');
                if (!levelNode || levelNode.disabled || levelNode.getAttribute("aria-disabled") === "true") {
                    throw new Error("自然战斗检查点关卡节点不可进入：" + targetLevelId);
                }
                levelNode.click();
                await waitForPredicate(() => document.querySelector('.level-map-node[data-level-id="' + targetLevelId + '"][data-selected="true"]'), "选中 " + targetLevelId);
                const drawerTitle = document.querySelector(".level-map-drawer__title")?.textContent.trim() || "";
                const enterButton = document.querySelector("[data-action='enter-level']");
                if (!enterButton || enterButton.disabled || enterButton.getAttribute("aria-disabled") === "true") {
                    throw new Error("自然战斗检查点进入按钮不可用：" + targetLevelId);
                }
                enterButton.click();
                return drawerTitle;
            };
            const waitForTurnOrSettlement = async turnBefore => {
                const started = Date.now();
                while (Date.now() - started < 20000) {
                    const state = window.GameEngine?.fsm?.currentState || "";
                    if (state === "BATTLE_SETTLEMENT") return "settled";
                    if (state === "BATTLE_LOOP"
                        && window.GameEngine?.battlePhase === "PLANNING"
                        && Number(window.GameEngine?.currentTurn ?? 0) > turnBefore) {
                        return "next_turn";
                    }
                    await sleep(120);
                }
                return "turn_wait_timeout";
            };

            clickButtonByText("新游戏");
            await waitForPredicate(() => document.getElementById("modalTitle")?.textContent.trim() === "游戏菜单", "游戏菜单");
            const appliedSkillLoadout = applyCheckpointSkillLoadout();
            const unlockedLevels = ensureLevelUnlocked(targetLevelId);
            const drawerTitle = await selectCheckpointLevel();
            await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                && window.GameEngine?.data?.currentLevelData?.id === targetLevelId, "进入自然战斗 " + targetLevelId);
            await sleep(400);

            const naturalTurnSnapshots = [];
            let naturalOutcome = "turn_limit";
            let failureReason = "";
            for (let i = 0; i < maxNaturalTurns; i += 1) {
                if (window.GameEngine?.fsm?.currentState === "BATTLE_SETTLEMENT") break;
                await waitForPredicate(() => window.GameEngine?.fsm?.currentState === "BATTLE_LOOP"
                    && window.GameEngine?.battlePhase === "PLANNING", "自然战斗规划阶段");
                const turnBefore = Number(window.GameEngine?.currentTurn ?? 0) || 0;
                const before = snapshotVitals();
                const planning = await chooseAndPlaceSkills();
                if (planning.placed.length === 0) {
                    failureReason = planning.reason;
                    naturalTurnSnapshots.push({ turnBefore, before, planning, after: snapshotVitals(), waitResult: "not_executed" });
                    break;
                }

                clickButtonByText("提交规划");
                await waitForPredicate(() => {
                    const execute = document.getElementById("btnExecute");
                    return execute && !execute.classList.contains("disabled") && execute.getAttribute("aria-disabled") !== "true";
                }, "自然战斗执行回合可用");
                const plannedActions = [...(window.GameEngine?.playerSkillQueue || [])].map(action => ({
                    skillId: action.skillId || "",
                    bodyPart: action.bodyPart || "",
                    targetId: action.targetId || "",
                    slotKey: action.slotKey || ""
                }));
                clickButtonByText("执行回合");
                const waitResult = await waitForTurnOrSettlement(turnBefore);
                const after = snapshotVitals();
                naturalTurnSnapshots.push({
                    turnBefore,
                    currentTurn: Number(window.GameEngine?.currentTurn ?? 0) || 0,
                    before,
                    planning,
                    plannedActions,
                    waitResult,
                    after,
                    state: window.GameEngine?.fsm?.currentState || "",
                    battlePhase: window.GameEngine?.battlePhase || ""
                });
                if (waitResult === "turn_wait_timeout") {
                    failureReason = waitResult;
                    break;
                }
                if (window.GameEngine?.fsm?.currentState === "BATTLE_SETTLEMENT") break;
                await sleep(250);
            }

            const settlement = window.GameEngine?.data?.dataConfig?.global?.progress?.lastSettlement || {};
            const finalState = window.GameEngine?.fsm?.currentState || "";
            if (finalState === "BATTLE_SETTLEMENT") {
                naturalOutcome = settlement.victory === true ? "victory" : "defeat";
            } else if (failureReason) {
                naturalOutcome = failureReason;
            }
            const finalVitals = snapshotVitals();

            return {
                path: "mock_ui_v11.html",
                levelId: targetLevelId,
                checkpointLabel: checkpoint.label || "",
                mapId: checkpoint.mapId || "",
                maxNaturalTurns,
                skillLoadoutSource: appliedSkillLoadout.skillLoadoutSource,
                appliedSkillLoadout,
                unlockedLevels,
                drawerTitle,
                naturalTurnSnapshots,
                naturalOutcome,
                forcedSettlementUsed: false,
                finalState,
                finalTitle: document.getElementById("modalTitle")?.textContent.trim() || "",
                settlement: {
                    levelId: settlement.levelId || "",
                    victory: settlement.victory === true,
                    nextLevelId: settlement.nextLevelId || "",
                    rewards: settlement.rewards || null
                },
                finalVitals
            };
        })()`);

            assertCondition(report.levelId === checkpoint.levelId, `自然战斗检查点关卡异常：${report.levelId}`);
            report.lethalFailureDiagnosis = buildLethalFailureDiagnosis(report);
            assertCondition(report.forcedSettlementUsed === false, "自然战斗 smoke 不应使用强制结算");
            assertCondition(report.maxNaturalTurns === checkpoint.maxNaturalTurns, `自然战斗最大回合数异常：${report.maxNaturalTurns}`);
            assertCondition(report.skillLoadoutSource === checkpoint.skillLoadoutSource, `自然战斗技能配置来源异常：${report.skillLoadoutSource}`);
            assertCondition(report.naturalTurnSnapshots.length > 0, `${checkpoint.levelId} 没有记录任何自然回合`);
            assertCondition(
                report.naturalTurnSnapshots.some(turn => Array.isArray(turn.planning?.placed) && turn.planning.placed.length > 0),
                `${checkpoint.levelId} 没有部署任何玩家技能`
            );
            assertCondition(
                report.naturalTurnSnapshots.some(turn => Array.isArray(turn.plannedActions) && turn.plannedActions.length > 0),
                `${checkpoint.levelId} 没有提交任何玩家规划`
            );
            assertCondition(
                ["victory", "defeat", "turn_limit", "no_deployable_skill", "turn_wait_timeout"].includes(report.naturalOutcome),
                `${checkpoint.levelId} 自然战斗结果不可识别：${report.naturalOutcome}`
            );
            assertCondition(
                ["not_failed", "mutual_kill_settlement_loss", "lethal_enemy_pressure", "timeout_pressure_or_damage_gap", "no_player_action"].includes(report.lethalFailureDiagnosis.diagnosisCode),
                `${checkpoint.levelId} 自然战斗失败诊断不可识别：${report.lethalFailureDiagnosis.diagnosisCode}`
            );
            if (checkpoint.requireVictory) {
                assertCondition(report.naturalOutcome === "victory", `${checkpoint.levelId} 未能在自然战斗中取胜：${report.naturalOutcome}`);
                assertCondition(report.finalState === "BATTLE_SETTLEMENT", `${checkpoint.levelId} 自然胜利后状态异常：${report.finalState}`);
                assertCondition(report.settlement?.victory === true, `${checkpoint.levelId} 自然胜利没有写入胜利结算`);
            }
            assertCondition(client.runtimeExceptions.length === 0, `${checkpoint.levelId} 自然战斗 smoke 页面出现 Runtime exception`);
            return report;
        } finally {
            await closeClient(client);
        }
    };

    const naturalCheckpointResults = [];
    for (const checkpoint of naturalCheckpoints) {
        naturalCheckpointResults.push(await runNaturalCheckpoint(checkpoint));
    }

    const recognizedOutcomes = ["victory", "defeat", "turn_limit", "no_deployable_skill", "turn_wait_timeout"];
    const naturalCheckpointSummary = {
        total: naturalCheckpointResults.length,
        victories: naturalCheckpointResults.filter(item => item.naturalOutcome === "victory").length,
        defeats: naturalCheckpointResults.filter(item => item.naturalOutcome === "defeat").length,
        turnLimits: naturalCheckpointResults.filter(item => item.naturalOutcome === "turn_limit").length,
        forcedSettlementUsed: naturalCheckpointResults.some(item => item.forcedSettlementUsed === true),
        requiredVictoriesOk: naturalCheckpoints
            .filter(item => item.requireVictory)
            .every(item => naturalCheckpointResults.some(result => result.levelId === item.levelId && result.naturalOutcome === "victory")),
        outcomesByLevel: Object.fromEntries(naturalCheckpointResults.map(item => [item.levelId, item.naturalOutcome])),
        skillLoadoutSourcesByLevel: Object.fromEntries(naturalCheckpointResults.map(item => [item.levelId, item.skillLoadoutSource])),
        lethalFailureDiagnosisByLevel: Object.fromEntries(naturalCheckpointResults.map(item => [item.levelId, item.lethalFailureDiagnosis])),
        terminalBossDiagnosis: naturalCheckpointResults.find(item => item.levelId === "level_3_10")?.lethalFailureDiagnosis || null
    };
    const primary = naturalCheckpointResults.find(item => item.levelId === "level_1_1") || naturalCheckpointResults[0];

    assertCondition(naturalCheckpointResults.length === naturalCheckpoints.length, "自然战斗检查点数量异常");
    assertCondition(naturalCheckpointSummary.forcedSettlementUsed === false, "自然战斗检查点不应使用强制结算");
    assertCondition(naturalCheckpointSummary.requiredVictoriesOk === true, "自然战斗必胜检查点未全部通过");
    assertCondition(
        naturalCheckpoints.every(checkpoint => naturalCheckpointResults.some(result => result.levelId === checkpoint.levelId)),
        "自然战斗检查点结果缺少目标关卡"
    );
    assertCondition(
        naturalCheckpointResults.every(result => recognizedOutcomes.includes(result.naturalOutcome)),
        "自然战斗检查点存在不可识别结果"
    );
    assertCondition(
        naturalCheckpointResults.every(result => result.lethalFailureDiagnosis && result.lethalFailureDiagnosis.diagnosisCode),
        "自然战斗检查点缺少失败诊断"
    );
    const terminalBossResult = naturalCheckpointResults.find(result => result.levelId === "level_3_10");
    assertCondition(terminalBossResult?.lethalFailureDiagnosis, "第三章终局 Boss 缺少失败诊断");

    return {
        ...primary,
        naturalBalanceProbeBuild,
        naturalCheckpointResults,
        naturalCheckpointSummary
    };
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
        levelSelectMultiMap: await runLevelSelectMultiMapSmoke(cdpEndpoint, urls.main),
        settlementReward: await runSettlementRewardSmoke(cdpEndpoint, urls.main),
        postSettlementProgression: await runPostSettlementProgressionSmoke(cdpEndpoint, urls.main),
        learnedSkillBattleExecution: await runLearnedSkillBattleExecutionSmoke(cdpEndpoint, urls.main),
        chapterOneProgression: await runChapterOneProgressionSmoke(cdpEndpoint, urls.main),
        chapterTwoProgression: await runChapterTwoProgressionSmoke(cdpEndpoint, urls.main),
        chapterThreeProgression: await runChapterThreeProgressionSmoke(cdpEndpoint, urls.main),
        naturalBattleAutoplay: await runNaturalBattleAutoplaySmoke(cdpEndpoint, urls.main),
        presentationProbe: await runPresentationProbe(cdpEndpoint, urls.probe),
        presentationConfigurator: await runPresentationConfigurator(cdpEndpoint, urls.configurator)
    };

    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exit(1);
});
