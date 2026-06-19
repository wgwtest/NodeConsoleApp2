import AnimationSetWorkspace from './AnimationSetWorkspace.js';
import { buildAnimationCatalog } from './AnimationSetCatalog.js';

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) element.className = className;
    return element;
}

function clearElement(element) {
    if (!element) return;
    if (typeof element.replaceChildren === 'function') {
        element.replaceChildren();
        return;
    }
    element.innerHTML = '';
    element.textContent = '';
}

function normalizeString(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function statusLabel(status) {
    if (status === 'ready') return 'ready';
    if (status === 'error') return 'error';
    if (status === 'missing') return 'missing';
    if (status === 'planned') return 'planned';
    return status || 'warning';
}

function badgeClass(status) {
    if (status === 'ready' || status === 'ok') return 'badge ready';
    if (status === 'error') return 'badge error';
    return 'badge warn';
}

function ownerTypeLabel(ownerType) {
    const labels = {
        player: '玩家',
        enemy: '敌人',
        ally: '友军',
        effect: '特效',
        unknown: '未分类'
    };
    return labels[ownerType] || ownerType || '未分类';
}

function relativeAssetUrl(value) {
    const source = normalizeString(value, '');
    if (!source) return '';
    if (/^(?:https?:)?\/\//u.test(source) || source.startsWith('data:')) return source;
    if (source.startsWith('../')) return source;
    return `../${source}`;
}

function formatOffset(offset) {
    const source = offset && typeof offset === 'object' ? offset : {};
    return `${Number(source.x || 0)}, ${Number(source.y || 0)}`;
}

function sanitizeClipPrefix(value) {
    return String(value || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizeAssetDeletePath(value) {
    return normalizeString(value, '').replace(/\\/g, '/').replace(/^(\.\.\/)+/u, '');
}

function clipOwnsSourceDir(clip) {
    return Boolean(clip?.assetManagement?.ownsSourceDir);
}

function setClipBuildError(animationSet, clip, error) {
    const message = error?.message || String(error || '构建失败。');
    clip.status = 'error';
    clip.buildState = {
        ...(clip.buildState && typeof clip.buildState === 'object' ? clip.buildState : {}),
        status: 'error',
        errors: [message],
        updatedAt: new Date().toISOString()
    };
    animationSet.status = 'error';
    return message;
}

function compareFrameNames(left, right) {
    const leftNumber = Number((String(left).match(/(\d+)(?=\.png$)/iu) || [])[1]);
    const rightNumber = Number((String(right).match(/(\d+)(?=\.png$)/iu) || [])[1]);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
    }
    return String(left).localeCompare(String(right), 'zh-CN', { numeric: true });
}

function deriveClipKeyFromSourceDir(sourceDir) {
    const basename = normalizeString(String(sourceDir || '').split('/').pop(), '');
    if (!basename) return '';
    const parts = basename.split(/[-_]/u).filter(Boolean);
    const candidate = parts[parts.length - 1] || basename;
    const sanitized = candidate.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    return sanitized || sanitizeClipPrefix(basename);
}

function basenameFromPath(value) {
    return String(value || '').replace(/\\/g, '/').split('/').pop() || '';
}

function directoryNameFromLocalPath(value) {
    return basenameFromPath(String(value || '').replace(/[\\/]+$/u, ''));
}

export class AnimationSetManagerPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.confirmImpl = options.confirmImpl || globalThis.confirm?.bind(globalThis) || (() => false);
        this.ImageCtor = options.ImageCtor || globalThis.Image;
        this.requestAnimationFrameImpl = options.requestAnimationFrameImpl
            || globalThis.requestAnimationFrame?.bind(globalThis)
            || ((callback) => setTimeout(() => callback(Date.now()), 16));
        this.cancelAnimationFrameImpl = options.cancelAnimationFrameImpl
            || globalThis.cancelAnimationFrame?.bind(globalThis)
            || clearTimeout;
        this.defaultDataPath = options.defaultDataPath || 'assets/data/animation_sets_v1.json';
        this.catalogDataPath = options.catalogDataPath || 'assets/data/animation_catalog_v1.json';
        this.currentDataPath = this.defaultDataPath;
        this.workspace = null;
        this.catalogPublishState = {
            status: 'idle',
            message: 'catalog idle'
        };
        this.selectedOwnerType = '';
        this.selectedOwnerId = '';
        this.selectedSetId = '';
        this.selectedClipKey = '';
        this.elements = {};
        this.previewState = {
            image: null,
            imageSrc: '',
            frameIndex: 0,
            isPlaying: false,
            rafId: null,
            lastTick: 0,
            clip: null
        };
    }

    bind() {
        [
            'status',
            'catalogPublishStatus',
            'configFileLabel',
            'animationSetPathInput',
            'buildSelectedBtn',
            'validateAllBtn',
            'validationSummary',
            'animationSetSearchInput',
            'ownerTypeFilter',
            'statusFilter',
            'ownerTree',
            'selectedOwnerTitle',
            'selectedOwnerDescription',
            'ownerStatusBadge',
            'metricOwnerCount',
            'metricSetCount',
            'metricClipCount',
            'metricIssueCount',
            'ownerAnimationSetList',
            'clipTableBody',
            'clipPreviewTitle',
            'clipPreviewMeta',
            'clipPreviewCanvas',
            'playPreviewBtn',
            'pausePreviewBtn',
            'resetPreviewBtn',
            'previewTimeline',
            'previewFrameLabel',
            'previewFrameCount',
            'referenceList',
            'issueList',
            'manifestOutput',
            'newClipKeyInput',
            'localFrameDirectoryInput',
            'importClipBtn',
            'selectedClipPropertyTitle',
            'selectedClipFpsInput',
            'selectedClipLoopInput',
            'selectedClipReturnToInput',
            'newOwnerTypeInput',
            'newOwnerDisplayNameInput',
            'createOwnerBtn'
        ].forEach((id) => {
            this.elements[id] = this.document.getElementById(id);
        });

        this.elements.buildSelectedBtn?.addEventListener('click', () => {
            this.buildSelectedClip().catch(error => this.setStatus(`重建失败：${error.message}`));
        });
        this.elements.validateAllBtn?.addEventListener('click', () => {
            this.runFullValidation();
        });
        this.elements.importClipBtn?.addEventListener('click', () => {
            this.importClipForSelectedOwner().catch(error => this.setStatus(`导入失败：${error.message}`));
        });
        this.elements.createOwnerBtn?.addEventListener('click', () => {
            this.createOwnerFromForm().catch(error => this.setStatus(`新建对象失败：${error.message}`));
        });
        this.elements.selectedClipFpsInput?.addEventListener('change', () => this.updateSelectedClipPropertiesFromForm().catch(error => this.setStatus(`动作属性保存失败：${error.message}`)));
        this.elements.selectedClipLoopInput?.addEventListener('change', () => this.updateSelectedClipPropertiesFromForm().catch(error => this.setStatus(`动作属性保存失败：${error.message}`)));
        this.elements.selectedClipReturnToInput?.addEventListener('change', () => this.updateSelectedClipPropertiesFromForm().catch(error => this.setStatus(`动作属性保存失败：${error.message}`)));
        this.elements.playPreviewBtn?.addEventListener('click', () => this.playPreview());
        this.elements.pausePreviewBtn?.addEventListener('click', () => this.pausePreview());
        this.elements.resetPreviewBtn?.addEventListener('click', () => this.resetPreview());
        this.elements.animationSetSearchInput?.addEventListener('input', () => this.render());
        this.elements.ownerTypeFilter?.addEventListener('change', () => this.render());
        this.elements.statusFilter?.addEventListener('change', () => this.render());
    }

    async loadDefault() {
        if (typeof this.fetchImpl !== 'function') throw new Error('缺少 fetch 实现。');
        const path = this.elements.animationSetPathInput?.value || this.defaultDataPath;
        const response = await this.fetchImpl(`/__skill_editor_file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
        if (!response?.ok) throw new Error(`配置读取失败：${response?.status || 'unknown'}`);
        const body = await response.json();
        const document = JSON.parse(body.content);
        this.currentDataPath = body.path || path;
        this.loadDocument(document);
        this.setConfigFileLabel(this.currentDataPath);
        this.updateCatalogPublishStatus('idle', 'catalog idle');
        this.setStatus('动画资源库已就绪；后续变更会自动保存。');
    }

    loadDocument(document) {
        this.workspace = new AnimationSetWorkspace(document);
        const firstOwner = this.workspace.listOwners()[0];
        this.selectedOwnerType = firstOwner?.ownerType || '';
        this.selectedOwnerId = firstOwner?.ownerId || '';
        const firstSet = firstOwner?.animationSets[0] || null;
        this.selectedSetId = firstSet?.id || '';
        this.selectedClipKey = firstSet ? (firstSet.defaultAnimation || Object.keys(firstSet.clips)[0] || '') : '';
        this.render();
    }

    setStatus(message) {
        if (this.elements.status) this.elements.status.textContent = message;
    }

    setConfigFileLabel(path = this.currentDataPath) {
        if (this.elements.configFileLabel) this.elements.configFileLabel.textContent = `配置文件：${path}`;
    }

    updateCatalogPublishStatus(status, message) {
        this.catalogPublishState = {
            status,
            message: message || status
        };
        const element = this.elements.catalogPublishStatus;
        if (!element) return;
        element.className = badgeClass(status === 'ready' ? 'ready' : status === 'error' ? 'error' : 'warning');
        element.textContent = this.catalogPublishState.message;
    }

    getFilter() {
        return {
            query: this.elements.animationSetSearchInput?.value || '',
            ownerType: this.elements.ownerTypeFilter?.value || '',
            status: this.elements.statusFilter?.value || ''
        };
    }

    getSelectedOwner() {
        if (!this.workspace) return null;
        return this.workspace.getOwnerSummary(this.selectedOwnerType, this.selectedOwnerId)
            || this.workspace.listOwners(this.getFilter())[0]
            || this.workspace.listOwners()[0]
            || null;
    }

    getSelectedSet() {
        const owner = this.getSelectedOwner();
        if (!owner) return null;
        return owner.animationSets.find(set => set.id === this.selectedSetId)
            || this.workspace.findPrimarySetForOwner(owner.ownerType, owner.ownerId)
            || owner.animationSets[0]
            || null;
    }

    render() {
        if (!this.workspace) return;
        this.renderSummary();
        this.renderOwnerTree();
        this.renderSelectedOwner();
    }

    renderSummary() {
        const summary = this.workspace.getSummary();
        const issues = this.workspace.animationSets.flatMap(set => this.workspace.validateAnimationSet(set.id))
            .filter(issue => issue.severity !== 'ok');
        if (this.elements.metricOwnerCount) this.elements.metricOwnerCount.textContent = String(summary.totalOwners);
        if (this.elements.metricSetCount) this.elements.metricSetCount.textContent = String(summary.totalSets);
        if (this.elements.metricClipCount) this.elements.metricClipCount.textContent = String(summary.totalClips);
        if (this.elements.metricIssueCount) this.elements.metricIssueCount.textContent = String(issues.length);
    }

    runFullValidation() {
        if (!this.workspace) return null;
        const report = this.workspace.validateAllAnimationSets();
        if (this.elements.validationSummary) {
            this.elements.validationSummary.textContent = `sets ${report.totalSets} / clips ${report.totalClips} / ready ${report.readyClipCount} / issues ${report.issueCount}`;
            this.elements.validationSummary.className = badgeClass(report.status);
        }
        this.setStatus(`Full animation validation: ${report.status}, issues ${report.issueCount}.`);
        return report;
    }

    renderOwnerTree() {
        const tree = this.elements.ownerTree;
        clearElement(tree);
        if (!tree) return;
        const owners = this.workspace.listOwners(this.getFilter());
        const grouped = new Map();
        owners.forEach((owner) => {
            if (!grouped.has(owner.ownerType)) grouped.set(owner.ownerType, []);
            grouped.get(owner.ownerType).push(owner);
        });
        ['player', 'enemy', 'ally', 'effect', 'unknown'].forEach((type) => {
            const groupOwners = grouped.get(type) || [];
            if (!groupOwners.length) return;
            const group = createElement(this.document, 'section', 'owner-group');
            const heading = createElement(this.document, 'h3');
            heading.textContent = `${ownerTypeLabel(type)} ${groupOwners.length}`;
            group.appendChild(heading);
            groupOwners.forEach((owner) => {
                const item = createElement(this.document, 'button', `owner-card${owner.ownerType === this.selectedOwnerType && owner.ownerId === this.selectedOwnerId ? ' active' : ''}`);
                item.type = 'button';
                item.addEventListener('click', () => {
                    this.selectedOwnerType = owner.ownerType;
                    this.selectedOwnerId = owner.ownerId;
                    const set = this.workspace.findPrimarySetForOwner(owner.ownerType, owner.ownerId);
                    this.selectedSetId = set?.id || '';
                    this.selectedClipKey = set ? (set.defaultAnimation || Object.keys(set.clips)[0] || '') : '';
                    this.render();
                });

                const main = createElement(this.document, 'span', 'asset-main');
                const title = createElement(this.document, 'strong');
                title.textContent = owner.ownerId;
                const subtitle = createElement(this.document, 'span');
                subtitle.textContent = owner.displayName;
                main.appendChild(title);
                main.appendChild(subtitle);

                const badge = createElement(this.document, 'span', badgeClass(owner.status));
                badge.textContent = statusLabel(owner.status);
                const meta = createElement(this.document, 'span', 'asset-meta');
                [`动画集 ${owner.setCount}`, `动作 ${owner.clipCount}`, `ready ${owner.readyClipCount}`].forEach((text) => {
                    const chip = createElement(this.document, 'span', 'chip');
                    chip.textContent = text;
                    meta.appendChild(chip);
                });

                item.appendChild(main);
                item.appendChild(badge);
                item.appendChild(meta);
                group.appendChild(item);
            });
            tree.appendChild(group);
        });
    }

    renderSelectedOwner() {
        const owner = this.getSelectedOwner();
        if (!owner) return;
        this.selectedOwnerType = owner.ownerType;
        this.selectedOwnerId = owner.ownerId;

        const animationSet = this.getSelectedSet();
        if (!animationSet) return;
        this.selectedSetId = animationSet.id;
        if (!animationSet.clips[this.selectedClipKey]) {
            this.selectedClipKey = animationSet.defaultAnimation || Object.keys(animationSet.clips)[0] || '';
        }

        if (this.elements.selectedOwnerTitle) this.elements.selectedOwnerTitle.textContent = `${ownerTypeLabel(owner.ownerType)} / ${owner.ownerId}`;
        if (this.elements.selectedOwnerDescription) {
            this.elements.selectedOwnerDescription.textContent = `${owner.displayName}，动画集 ${owner.setCount} 个，动作 ${owner.clipCount} 个。运行时只引用 animationSetRef / animationKey，资源路径由动画配置管理。`;
        }
        if (this.elements.ownerStatusBadge) {
            this.elements.ownerStatusBadge.className = badgeClass(owner.status);
            this.elements.ownerStatusBadge.textContent = statusLabel(owner.status);
        }
        this.renderOwnerAnimationSets(owner);
        this.renderClipTable(animationSet);
        this.renderClipProperties(animationSet);
        if (Object.keys(animationSet.clips).length) {
            this.renderPreview(animationSet);
        } else {
            this.clearPreview('当前对象还没有动作');
        }
        this.renderReferences(animationSet);
        this.renderIssues(animationSet);
        this.renderManifest(animationSet);
    }

    renderOwnerAnimationSets(owner) {
        const list = this.elements.ownerAnimationSetList;
        clearElement(list);
        if (!list) return;
        list.hidden = owner.animationSets.length <= 1;
        if (list.hidden) return;
        owner.animationSets.forEach((animationSet) => {
            const item = createElement(this.document, 'button', `set-pill${animationSet.id === this.selectedSetId ? ' active' : ''}`);
            item.type = 'button';
            item.textContent = `${animationSet.id} / default ${animationSet.defaultAnimation || '-'}`;
            item.addEventListener('click', () => {
                this.selectedSetId = animationSet.id;
                this.selectedClipKey = animationSet.defaultAnimation || Object.keys(animationSet.clips)[0] || '';
                this.renderSelectedOwner();
            });
            list.appendChild(item);
        });
    }

    renderClipTable(animationSet) {
        const body = this.elements.clipTableBody;
        clearElement(body);
        if (!body) return;
        Object.values(animationSet.clips).forEach((clip) => {
            const row = createElement(this.document, 'tr');
            row.addEventListener('click', () => {
                this.selectedClipKey = clip.key;
                this.renderSelectedOwner();
            });
            if (clip.key === this.selectedClipKey) row.className = 'selected-row';
            [
                clip.key,
                statusLabel(clip.status),
                clip.sourceDir || '未配置',
                clip.sheetRef ? clip.sheetRef.split('/').pop() : '未构建',
                String(clip.frameCount || '-'),
                String(clip.fps || '-'),
                String(Boolean(clip.loop)),
                clip.returnTo || '-',
                formatOffset(clip.offset)
            ].forEach((value, index) => {
                const cell = createElement(this.document, 'td', index === 1 ? '' : 'mono');
                if (index === 1) {
                    const badge = createElement(this.document, 'span', badgeClass(clip.status));
                    badge.textContent = value;
                    cell.appendChild(badge);
                } else {
                    cell.textContent = value;
                }
                row.appendChild(cell);
            });
            const actionCell = createElement(this.document, 'td');
            const deleteButton = createElement(this.document, 'button', 'btn delete-clip-btn');
            deleteButton.type = 'button';
            deleteButton.textContent = '删除';
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.deleteClipWithConfirmation(animationSet.id, clip.key).catch(error => this.setStatus(`删除失败：${error.message}`));
            });
            actionCell.appendChild(deleteButton);
            row.appendChild(actionCell);
            body.appendChild(row);
        });
    }

    renderClipProperties(animationSet) {
        const clip = this.workspace.resolveClip(animationSet.id, this.selectedClipKey);
        const hasClip = Boolean(clip);
        if (this.elements.selectedClipPropertyTitle) {
            this.elements.selectedClipPropertyTitle.textContent = hasClip ? clip.key : '未选择动作';
        }
        if (this.elements.selectedClipFpsInput) {
            this.elements.selectedClipFpsInput.disabled = !hasClip;
            this.elements.selectedClipFpsInput.value = hasClip ? String(clip.fps || 12) : '';
        }
        if (this.elements.selectedClipLoopInput) {
            this.elements.selectedClipLoopInput.disabled = !hasClip;
            this.elements.selectedClipLoopInput.checked = hasClip ? Boolean(clip.loop) : false;
        }
        if (this.elements.selectedClipReturnToInput) {
            this.elements.selectedClipReturnToInput.disabled = !hasClip;
            this.elements.selectedClipReturnToInput.value = hasClip ? normalizeString(clip.returnTo, '') : '';
        }
    }

    renderPreview(animationSet) {
        const clip = this.workspace.resolveClip(animationSet.id, this.selectedClipKey);
        if (!clip) return;
        this.previewState.clip = clip;
        this.previewState.frameIndex = Math.min(this.previewState.frameIndex, Math.max(0, Number(clip.frameCount || 1) - 1));
        if (this.elements.clipPreviewTitle) this.elements.clipPreviewTitle.textContent = `动作预览：${clip.key}`;
        if (this.elements.clipPreviewMeta) this.elements.clipPreviewMeta.textContent = `${clip.frameCount || '-'} frames / ${clip.fps || '-'} fps / ${clip.loop ? 'loop' : 'once'}`;
        if (this.elements.previewFrameCount) this.elements.previewFrameCount.textContent = `${clip.frameCount || '-'} frames`;
        this.ensurePreviewImage(clip).catch(error => this.setStatus(`预览加载失败：${error.message}`));
        this.drawPreviewFrame();
        this.updateTransportState();
    }

    clearPreview(title = '动作预览') {
        this.pausePreview();
        this.previewState.clip = null;
        this.previewState.image = null;
        this.previewState.imageSrc = '';
        this.previewState.frameIndex = 0;
        if (this.elements.clipPreviewTitle) this.elements.clipPreviewTitle.textContent = title;
        if (this.elements.clipPreviewMeta) this.elements.clipPreviewMeta.textContent = '未选择动作';
        if (this.elements.previewFrameCount) this.elements.previewFrameCount.textContent = '0 frames';
        if (this.elements.previewFrameLabel) this.elements.previewFrameLabel.textContent = '0 / 0';
        if (this.elements.previewTimeline) {
            this.elements.previewTimeline.max = 0;
            this.elements.previewTimeline.value = 0;
        }
        const canvas = this.elements.clipPreviewCanvas;
        const context = canvas?.getContext?.('2d');
        if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
        this.updateTransportState();
    }

    async ensurePreviewImage(clip) {
        const source = relativeAssetUrl(clip.sheetRef || '');
        if (!source || this.previewState.imageSrc === source) return this.previewState.image;
        const ImageCtor = this.ImageCtor;
        if (typeof ImageCtor !== 'function') throw new Error('当前环境缺少 Image 构造器。');
        const image = await new Promise((resolve, reject) => {
            const next = new ImageCtor();
            next.onload = () => resolve(next);
            next.onerror = () => reject(new Error(`图片加载失败：${source}`));
            next.src = source;
        });
        this.previewState.image = image;
        this.previewState.imageSrc = source;
        this.previewState.frameIndex = 0;
        this.drawPreviewFrame();
        return image;
    }

    drawPreviewFrame() {
        const canvas = this.elements.clipPreviewCanvas;
        const clip = this.previewState.clip;
        if (!canvas || !clip) return;
        const context = canvas.getContext?.('2d');
        if (!context) return;
        const frameWidth = Number(clip.frameWidth || 512);
        const frameHeight = Number(clip.frameHeight || 512);
        const frameCount = Math.max(1, Number(clip.frameCount || 1));
        const columns = Math.max(1, Number(clip.columns || Math.ceil(Math.sqrt(frameCount))));
        const frameIndex = Math.max(0, Math.min(this.previewState.frameIndex, frameCount - 1));
        const sx = (frameIndex % columns) * frameWidth;
        const sy = Math.floor(frameIndex / columns) * frameHeight;
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        context.clearRect(0, 0, frameWidth, frameHeight);
        if (this.previewState.image) {
            context.drawImage(this.previewState.image, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
        }
        if (this.elements.previewFrameLabel) this.elements.previewFrameLabel.textContent = `${frameIndex + 1} / ${frameCount}`;
        this.updatePreviewProgress(frameIndex, frameCount);
    }

    playPreview() {
        const clip = this.previewState.clip;
        if (!clip || this.previewState.isPlaying) return;
        const frameCount = Math.max(1, Number(clip.frameCount || 1));
        if (!clip.loop && this.previewState.frameIndex >= frameCount - 1) {
            this.previewState.frameIndex = 0;
            this.drawPreviewFrame();
        }
        this.previewState.isPlaying = true;
        this.previewState.lastTick = 0;
        this.updateTransportState();
        const tick = (time) => {
            if (!this.previewState.isPlaying) return;
            const currentClip = this.previewState.clip;
            const fps = Math.max(1, Number(currentClip?.fps || 12));
            if (!this.previewState.lastTick || time - this.previewState.lastTick >= 1000 / fps) {
                this.advancePreviewFrame();
                if (!this.previewState.isPlaying) return;
                this.previewState.lastTick = time;
            }
            this.previewState.rafId = this.requestAnimationFrameImpl(tick);
        };
        this.previewState.rafId = this.requestAnimationFrameImpl(tick);
    }

    pausePreview() {
        this.previewState.isPlaying = false;
        if (this.previewState.rafId !== null) {
            this.cancelAnimationFrameImpl(this.previewState.rafId);
            this.previewState.rafId = null;
        }
        this.updateTransportState();
    }

    resetPreview() {
        this.pausePreview();
        this.previewState.frameIndex = 0;
        this.drawPreviewFrame();
        this.updateTransportState();
    }

    advancePreviewFrame() {
        const clip = this.previewState.clip;
        const frameCount = Math.max(1, Number(clip?.frameCount || 1));
        const next = this.previewState.frameIndex + 1;
        if (next >= frameCount) {
            if (clip?.loop) {
                this.previewState.frameIndex = 0;
            } else {
                this.previewState.frameIndex = frameCount - 1;
                this.drawPreviewFrame();
                this.pausePreview();
                return;
            }
        } else {
            this.previewState.frameIndex = next;
        }
        this.drawPreviewFrame();
    }

    updatePreviewProgress(frameIndex, frameCount) {
        const timeline = this.elements.previewTimeline;
        if (!timeline) return;
        const max = Math.max(0, frameCount - 1);
        const value = Math.max(0, Math.min(frameIndex, frameCount - 1));
        timeline.max = max;
        timeline.value = value;
        timeline.setAttribute('max', String(max));
        timeline.setAttribute('value', String(value));
        timeline.setAttribute('aria-valuetext', `${frameIndex + 1} / ${frameCount}`);
    }

    updateTransportState() {
        const hasClip = Boolean(this.previewState.clip);
        const isPlaying = Boolean(this.previewState.isPlaying);
        if (this.elements.playPreviewBtn) {
            this.elements.playPreviewBtn.disabled = !hasClip || isPlaying;
            this.elements.playPreviewBtn.classList.toggle('active', isPlaying);
            this.elements.playPreviewBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
            this.elements.playPreviewBtn.title = isPlaying ? '正在播放' : '播放';
        }
        if (this.elements.pausePreviewBtn) {
            this.elements.pausePreviewBtn.disabled = !hasClip || !isPlaying;
            this.elements.pausePreviewBtn.classList.remove('active');
            this.elements.pausePreviewBtn.setAttribute('aria-pressed', 'false');
            this.elements.pausePreviewBtn.title = isPlaying ? '暂停' : '已暂停';
        }
        if (this.elements.resetPreviewBtn) {
            this.elements.resetPreviewBtn.disabled = !hasClip;
        }
    }

    renderReferences(animationSet) {
        const list = this.elements.referenceList;
        clearElement(list);
        if (!list) return;
        const references = this.workspace.listReferences(animationSet.id);
        references.forEach((reference) => {
            const row = createElement(this.document, 'div', 'ref-row');
            const dot = createElement(this.document, 'span', 'dot');
            const label = createElement(this.document, 'strong');
            label.textContent = reference.id || reference.type || 'unknown';
            const meta = createElement(this.document, 'span', 'muted');
            meta.textContent = reference.animationKey || reference.field || reference.type || '';
            row.appendChild(dot);
            row.appendChild(label);
            row.appendChild(meta);
            list.appendChild(row);
        });
    }

    renderIssues(animationSet) {
        const list = this.elements.issueList;
        clearElement(list);
        if (!list) return;
        this.workspace.validateAnimationSet(animationSet.id).forEach((issue) => {
            const row = createElement(this.document, 'div', 'issue-row');
            const dot = createElement(this.document, 'span', issue.severity === 'error' ? 'dot error' : issue.severity === 'ok' ? 'dot' : 'dot warn');
            const label = createElement(this.document, 'strong');
            label.textContent = issue.clipKey || issue.message;
            const meta = createElement(this.document, 'span', 'muted');
            meta.textContent = issue.clipKey ? issue.message : issue.severity;
            row.appendChild(dot);
            row.appendChild(label);
            row.appendChild(meta);
            list.appendChild(row);
        });
    }

    renderManifest(animationSet) {
        if (!this.elements.manifestOutput) return;
        this.elements.manifestOutput.textContent = JSON.stringify(animationSet, null, 2);
    }

    async importClipForSelectedOwner() {
        const owner = this.getSelectedOwner();
        if (!owner) throw new Error('必须先选择对象。');
        const sourceDirectory = normalizeString(this.elements.localFrameDirectoryInput?.value, '');
        const key = normalizeString(this.elements.newClipKeyInput?.value, '');
        if (!key) throw new Error('请填写动作 key。');
        if (!sourceDirectory) throw new Error('请填写本地帧目录路径。');
        const animationSet = this.workspace.findPrimarySetForOwner(owner.ownerType, owner.ownerId);
        if (animationSet?.clips[key]) throw new Error(`${owner.ownerId}/${key} 已存在，请使用新的动作 key。`);

        const targetName = sanitizeClipPrefix(`${owner.ownerId}-${key}`);
        this.setStatus(`正在导入本地帧目录：${sourceDirectory}`);
        const response = await this.fetchImpl('/api/animation-assets/import-local-directory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceDirectory, targetName })
        });
        if (!response?.ok) throw new Error(`本地帧目录导入失败：${response?.status || 'unknown'}`);
        const body = await response.json();
        if (!body.ok) throw new Error(body.error || '本地帧目录导入失败。');

        const clip = this.workspace.addClipToOwner(owner.ownerType, owner.ownerId, {
            key,
            sourceDir: body.directory,
            fps: 12,
            loop: true,
            returnTo: null,
            status: 'planned',
            assetManagement: {
                importedBy: 'animation_set_manager',
                ownsSourceDir: true
            }
        });
        this.selectedSetId = animationSet.id;
        this.selectedClipKey = clip.key;
        const built = await this.buildSelectedClip();
        if (this.elements.newClipKeyInput) this.elements.newClipKeyInput.value = '';
        if (this.elements.localFrameDirectoryInput) this.elements.localFrameDirectoryInput.value = '';
        return built;
    }

    async updateSelectedClipPropertiesFromForm() {
        const animationSet = this.getSelectedSet();
        if (!animationSet) throw new Error('未选择动画集。');
        const clip = this.workspace.resolveClip(animationSet.id, this.selectedClipKey);
        if (!clip) throw new Error('未选择 clip。');
        clip.fps = Number(this.elements.selectedClipFpsInput?.value || clip.fps || 12);
        clip.loop = Boolean(this.elements.selectedClipLoopInput?.checked);
        clip.returnTo = normalizeString(this.elements.selectedClipReturnToInput?.value, null);
        animationSet.updatedAt = new Date().toISOString();
        await this.saveLedger('动作属性已自动保存');
        this.render();
        this.setStatus(`动作属性已自动保存：${animationSet.id}/${clip.key}`);
        return clip;
    }

    collectClipAssetPaths(clip) {
        const paths = [
            normalizeAssetDeletePath(clip?.sheetRef),
            normalizeAssetDeletePath(clip?.manifestRef)
        ].filter(Boolean);
        const sourceDir = normalizeAssetDeletePath(clip?.sourceDir);
        if (sourceDir && clipOwnsSourceDir(clip)) paths.push(sourceDir);
        return paths;
    }

    async deleteClipWithConfirmation(animationSetId, clipKey) {
        const animationSet = this.workspace?.getAnimationSet(animationSetId);
        if (!animationSet) throw new Error('未找到动画集。');
        const clip = animationSet.clips[clipKey];
        if (!clip) throw new Error('未找到动作。');
        const sourceDirNote = clipOwnsSourceDir(clip) ? '，并删除由管理器导入的项目内帧目录' : '';
        const confirmed = this.confirmImpl(`确认删除 ${animationSet.id}/${clip.key}？这会删除构建产物${sourceDirNote}。`);
        if (!confirmed) return null;
        const assetPaths = this.collectClipAssetPaths(clip);
        if (assetPaths.length) {
            const response = await this.fetchImpl('/api/animation-assets/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths: assetPaths })
            });
            if (!response?.ok) throw new Error(`动画资源删除失败：${response?.status || 'unknown'}`);
            const body = await response.json();
            if (!body.ok) throw new Error(body.error || '动画资源删除失败。');
        }
        this.workspace.removeClip(animationSet.id, clip.key);
        if (this.selectedClipKey === clip.key) {
            this.selectedClipKey = animationSet.defaultAnimation || Object.keys(animationSet.clips)[0] || '';
        }
        await this.saveLedger('动作已删除并自动保存');
        this.render();
        this.setStatus(`动作已删除：${animationSet.id}/${clip.key}`);
        return clip;
    }

    async createOwnerFromForm() {
        if (!this.workspace) throw new Error('请先读取动画配置。');
        const ownerType = normalizeString(this.elements.newOwnerTypeInput?.value, '');
        const displayName = normalizeString(this.elements.newOwnerDisplayNameInput?.value, '');
        const animationSet = this.workspace.createOwner({ ownerType, displayName });
        this.selectedOwnerType = animationSet.ownerType;
        this.selectedOwnerId = animationSet.ownerId;
        this.selectedSetId = animationSet.id;
        this.selectedClipKey = '';
        await this.saveLedger('对象已自动保存');
        if (this.elements.newOwnerDisplayNameInput) this.elements.newOwnerDisplayNameInput.value = '';
        this.render();
        this.setStatus(`对象已自动保存，自动分配 ID：${animationSet.ownerId}`);
        return animationSet;
    }

    async buildSelectedClip() {
        const animationSet = this.getSelectedSet();
        if (!animationSet) throw new Error('未选择动画集。');
        const clip = this.workspace.resolveClip(animationSet.id, this.selectedClipKey);
        if (!clip) throw new Error('未选择 clip。');
        if (!clip.sourceDir) throw new Error(`${clip.key} 缺少 sourceDir。`);
        try {
            this.setStatus(`正在扫描 ${clip.sourceDir}`);
            const frameInfo = await this.fetchFrameInfo(clip.sourceDir);
            if (!frameInfo.frames.length) throw new Error(`${clip.sourceDir} 未找到 PNG 帧。`);
            this.setStatus(`正在构建 ${clip.key}：${frameInfo.frameCount} 帧`);
            const built = await this.buildSheetFromFrames(clip, frameInfo);
            await this.writeBuiltAssets(built);
            this.applyBuiltClip(animationSet, clip, built, frameInfo);
            await this.saveLedger('动作资源已自动保存');
            this.render();
            this.setStatus(`动作资源已自动保存：${animationSet.id}/${clip.key}，${frameInfo.frameCount} 帧`);
            return built;
        } catch (error) {
            const message = setClipBuildError(animationSet, clip, error);
            this.render();
            this.setStatus(`动作资源构建失败：${message}`);
            throw error;
        }
    }

    async fetchFrameInfo(sourceDir) {
        const response = await this.fetchImpl(`/api/animation-assets/frames?dir=${encodeURIComponent(sourceDir)}`, { cache: 'no-store' });
        if (!response?.ok) throw new Error(`帧目录扫描失败：${response?.status || 'unknown'}`);
        const body = await response.json();
        if (!body.ok) throw new Error(body.error || '帧目录扫描失败。');
        return {
            directory: body.directory,
            frameCount: Number(body.frameCount || 0),
            frames: Array.isArray(body.frames) ? body.frames : []
        };
    }

    async loadImage(src) {
        const ImageCtor = this.ImageCtor;
        if (typeof ImageCtor !== 'function') throw new Error('当前环境缺少 Image 构造器。');
        return new Promise((resolve, reject) => {
            const image = new ImageCtor();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`图片加载失败：${src}`));
            image.src = src;
        });
    }

    async buildSheetFromFrames(clip, frameInfo) {
        const frameImages = [];
        for (const frame of frameInfo.frames) {
            frameImages.push(await this.loadImage(relativeAssetUrl(frame.path)));
        }
        const firstImage = frameImages[0];
        const frameWidth = Number(firstImage.naturalWidth || firstImage.width || clip.frameWidth || 512);
        const frameHeight = Number(firstImage.naturalHeight || firstImage.height || clip.frameHeight || 512);
        const frameCount = frameInfo.frames.length;
        frameImages.forEach((image, index) => {
            const width = Number(image.naturalWidth || image.width || 0);
            const height = Number(image.naturalHeight || image.height || 0);
            if (width !== frameWidth || height !== frameHeight) {
                const frameName = frameInfo.frames[index]?.name || `#${index + 1}`;
                throw new Error(`帧尺寸不一致：${frameName} 为 ${width}x${height}，期望 ${frameWidth}x${frameHeight}。`);
            }
        });
        const columns = Math.max(1, Number(clip.columns || Math.ceil(Math.sqrt(frameCount))));
        const rows = Math.max(1, Math.ceil(frameCount / columns));
        const canvas = this.document.createElement('canvas');
        canvas.width = frameWidth * columns;
        canvas.height = frameHeight * rows;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法创建 canvas 2D context。');
        context.drawImage(firstImage, 0, 0, frameWidth, frameHeight);
        for (let index = 1; index < frameImages.length; index += 1) {
            const image = frameImages[index];
            const x = (index % columns) * frameWidth;
            const y = Math.floor(index / columns) * frameHeight;
            context.drawImage(image, x, y, frameWidth, frameHeight);
        }
        const prefix = sanitizeClipPrefix(clip.key);
        const outputBase = `${frameInfo.directory}/${prefix}_sheet`;
        const manifest = {
            id: `${frameInfo.directory.split('/').pop()}_${clip.key}`,
            sheet: `${prefix}_sheet.png`,
            frameWidth,
            frameHeight,
            frameCount,
            columns,
            rows,
            width: canvas.width,
            height: canvas.height
        };
        const dataUrl = canvas.toDataURL('image/png');
        const pngBase64 = dataUrl.split(',')[1] || '';
        return {
            sheetPath: `${outputBase}.png`,
            manifestPath: `${outputBase}.json`,
            pngBase64,
            pngByteSize: Math.floor((pngBase64.length * 3) / 4),
            manifest
        };
    }

    async writeBuiltAssets(built) {
        const response = await this.fetchImpl('/api/animation-assets/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: [
                    {
                        path: built.sheetPath,
                        encoding: 'base64',
                        content: built.pngBase64
                    },
                    {
                        path: built.manifestPath,
                        encoding: 'utf8',
                        content: JSON.stringify(built.manifest, null, 2)
                    }
                ]
            })
        });
        if (!response?.ok) throw new Error(`动画产物写入失败：${response?.status || 'unknown'}`);
        const body = await response.json();
        if (!body.ok) throw new Error(body.error || '动画产物写入失败。');
        return body;
    }

    applyBuiltClip(animationSet, clip, built, frameInfo) {
        const target = animationSet.clips[clip.key];
        target.sheetRef = `../${built.sheetPath}`;
        target.manifestRef = `../${built.manifestPath}`;
        target.frameWidth = built.manifest.frameWidth;
        target.frameHeight = built.manifest.frameHeight;
        target.columns = built.manifest.columns;
        target.rows = built.manifest.rows;
        target.frameCount = frameInfo.frameCount;
        target.status = 'ready';
        target.runtimePackage = {
            kind: 'spritesheet',
            imageRef: target.sheetRef,
            manifestRef: target.manifestRef,
            imageFormat: 'png',
            compression: 'png',
            byteSize: Number(built.pngByteSize || 0)
        };
        target.buildState = {
            status: 'ready',
            errors: [],
            updatedAt: new Date().toISOString()
        };
        animationSet.status = Object.values(animationSet.clips).some(item => item.status !== 'ready') ? 'warning' : 'ready';
    }

    async saveLedger(reason = '配置已自动保存') {
        if (!this.workspace) return null;
        const document = this.workspace.exportDocument();
        const response = await this.fetchImpl('/__skill_editor_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: this.currentDataPath,
                content: JSON.stringify(document, null, 2)
            })
        });
        if (!response?.ok) throw new Error(`动画配置写回失败：${response?.status || 'unknown'}`);
        const body = await response.json();
        if (body.ok === false) throw new Error(body.error || '动画配置写回失败。');
        this.setConfigFileLabel(body.path || this.currentDataPath);
        try {
            this.updateCatalogPublishStatus('publishing', 'catalog publishing');
            await this.publishCatalog(document);
            this.updateCatalogPublishStatus('ready', 'catalog ready');
        } catch (error) {
            this.updateCatalogPublishStatus('error', `catalog publish failed: ${error.message}`);
        }
        this.setStatus(`${reason}。`);
        return body;
    }

    async publishCatalog(document) {
        const catalog = buildAnimationCatalog(document);
        const response = await this.fetchImpl('/__skill_editor_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: this.catalogDataPath,
                content: JSON.stringify(catalog, null, 2)
            })
        });
        if (!response?.ok) throw new Error(`animation catalog write failed: ${response?.status || 'unknown'}`);
        const body = await response.json();
        if (body.ok === false) throw new Error(body.error || 'animation catalog write failed.');
        return body;
    }
}

export default AnimationSetManagerPage;
