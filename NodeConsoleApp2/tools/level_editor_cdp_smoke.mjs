const DEFAULT_EDITOR_URL = "http://127.0.0.1:3101/test/level_editor_v1.html";
const DEFAULT_PROBE_URL = "http://127.0.0.1:3101/test/level_runtime_probe.html";
const DEFAULT_CDP_ENDPOINT = "http://127.0.0.1:9222";

async function openPage(cdpEndpoint, url) {
    const response = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
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
                    } catch (error) {
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
    return client;
}

async function evaluate(client, expression) {
    const result = await client.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
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

async function main() {
    const cdpEndpoint = process.env.CDP_ENDPOINT || DEFAULT_CDP_ENDPOINT;
    const editorUrl = process.env.LEVEL_EDITOR_URL || DEFAULT_EDITOR_URL;
    const probeUrl = process.env.LEVEL_PROBE_URL || DEFAULT_PROBE_URL;
    const report = {
        cdpEndpoint,
        editorUrl,
        probeUrl,
        editor: null,
        probeAfterOverride: null,
        probeAfterClear: null
    };

    let editorClient = null;
    let probeClient = null;

    try {
        editorClient = await attach(cdpEndpoint, editorUrl);
        await waitFor(
            editorClient,
            `(() => document.querySelectorAll("#levelList .level-list-item").length > 0 && document.getElementById("selectedLevelId")?.textContent.includes("level_1_1"))()`,
            "editor ready"
        );

        report.editor = await evaluate(editorClient, `(() => {
            document.getElementById("levelNameInput").value = "幽暗森林边缘·正式编辑器自测";
            document.getElementById("rewardKpInput").value = "5";
            const nextLevelCheckbox = document.querySelector("#nextLevelList input[type=checkbox]");
            if (nextLevelCheckbox) nextLevelCheckbox.checked = false;
            document.getElementById("saveLevelBtn").click();
            document.getElementById("enemyPoolNameInput").value = "幽暗森林边缘敌人池·自测";
            document.getElementById("enemyMembersInput").value = "goblin_story_headhunter@1\\nenemy_acceptance_guard@2";
            document.getElementById("saveWaveBtn").click();
            document.getElementById("applyOverrideBtn").click();
            return {
                status: document.getElementById("status")?.textContent || "",
                overrideStatus: document.getElementById("overrideStatus")?.textContent || "",
                exported: JSON.parse(document.getElementById("exportOutput")?.value || "{}")
            };
        })()`);

        assertCondition(
            report.editor.exported?.levels?.level_1_1?.name === "幽暗森林边缘·正式编辑器自测",
            "正式编辑器未导出修改后的关卡名"
        );
        assertCondition(
            (report.editor.exported?.levels?.level_1_1?.flow?.nextLevelIds || []).length === 0,
            "正式编辑器未按预期清空 nextLevelIds"
        );
        assertCondition(
            report.editor.exported?.enemyPools?.pool_story_goblin_edge?.members?.length === 2,
            "正式编辑器未导出修改后的敌人池成员"
        );
        assertCondition(
            /Runtime override active/.test(report.editor.overrideStatus || ""),
            "正式编辑器未写入 override 状态"
        );

        probeClient = await attach(cdpEndpoint, probeUrl);
        await waitFor(
            probeClient,
            `(() => document.getElementById("packSource")?.textContent.trim() === "override")()`,
            "probe override source"
        );
        await evaluate(probeClient, `instantiateProbeLevel()`);
        await waitFor(
            probeClient,
            `(() => {
                const value = document.getElementById("instantiatedEnemies")?.textContent.trim() || "";
                return value && value !== "-";
            })()`,
            "probe instantiate"
        );

        report.probeAfterOverride = await evaluate(probeClient, `(() => ({
            packSource: document.getElementById("packSource")?.textContent || "",
            resolvedName: document.getElementById("resolvedName")?.textContent || "",
            resolvedMembers: document.getElementById("resolvedMembers")?.textContent || "",
            instantiatedEnemies: document.getElementById("instantiatedEnemies")?.textContent || "",
            status: document.getElementById("status")?.textContent || ""
        }))()`);

        assertCondition(report.probeAfterOverride.packSource.trim() === "override", "probe 未读取 override 来源");
        assertCondition(report.probeAfterOverride.resolvedName === "幽暗森林边缘·正式编辑器自测", "probe 未读取 override 关卡名");
        assertCondition(
            report.probeAfterOverride.resolvedMembers.includes("goblin_story_headhunter@1")
                && report.probeAfterOverride.resolvedMembers.includes("enemy_acceptance_guard@2"),
            "probe 未读取 override 敌人池成员"
        );

        await evaluate(editorClient, `window.__CODEX_LEVEL_EDITOR_PAGE__.clearRuntimeOverride()`);
        await evaluate(probeClient, `reloadRuntime()`);
        await waitFor(
            probeClient,
            `(() => document.getElementById("packSource")?.textContent.trim() === "file")()`,
            "probe clear override"
        );

        report.probeAfterClear = await evaluate(probeClient, `(() => ({
            packSource: document.getElementById("packSource")?.textContent || "",
            resolvedName: document.getElementById("resolvedName")?.textContent || ""
        }))()`);
        assertCondition(report.probeAfterClear.packSource.trim() === "file", "clear override 后 probe 未回退到 file");

        console.log(JSON.stringify(report, null, 2));
    } finally {
        await closeClient(probeClient);
        await closeClient(editorClient);
    }
}

main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exit(1);
});
