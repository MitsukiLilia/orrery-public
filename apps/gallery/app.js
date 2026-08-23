// 相册「无声的日记」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 forum/sns/browser 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新)+ 长按/右键反悔(倒带)。
// v1 没有「生成更多/续写」——只有主刷新,详情屏只是看,没有任何操作按钮(任务书-M4 §一)。
// 系统自带 app,不起化名(Pulsar/Astrolabe 是世界内品牌,相册没有品牌才拟真)——不带品牌条,标题就是「相册」。
import { ICON_BACK, ICON_SCREENSHOT_BADGE } from '../../ui/icons.js';
import { GALLERY_TONES } from '../../core/world.js';

export const GALLERY_APP_ID = 'gallery';
export const GALLERY_SKIN_URL = new URL('./skin.css', import.meta.url).href;

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
}

// tone 白名单再校验一遍(双保险,任务书-M4 §二/§四):即便 generator.js 消化时已经白名单过一次,
// 渲染层落笔进 data-tone 属性前仍要自己再查一遍——绝不假设上游数据一定干净(IndexedDB 里可能躺着
// 旧版本/手工改过的记录),非法值落 street,同 generator 的兜底值保持一致。
function safeTone(tone) {
    return GALLERY_TONES.includes(tone) ? tone : 'street';
}

function isSameDay(ts1, ts2) {
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// 按日分组小标题:今天/昨天/M月D日,参照系是相册最新世界时刻(galleryNow)——照 browser 的
// formatDateSep 思路抄(apps 互相零依赖,不借 browser/skin.css 的样式也不借它的函数)。
function formatDateSep(ts, refNow) {
    const ref = refNow || Date.now();
    if (isSameDay(ts, ref)) return '今天';
    if (isSameDay(ts, ref - 86400000)) return '昨天';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function formatFullTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

/** 按世界时间倒序输入(已排好序,最新在前)的照片按日分组:每组一个日期小标题 + 一份该天的方块网格。 */
function groupByDay(photos, refNow) {
    const groups = [];
    for (const p of photos) {
        const last = groups[groups.length - 1];
        if (!last || !isSameDay(last.items[last.items.length - 1].worldTime, p.worldTime)) {
            groups.push({ sep: formatDateSep(p.worldTime, refNow), items: [p] });
        } else {
            last.items.push(p);
        }
    }
    return groups;
}

function renderThumb(p, seenAt) {
    const tone = safeTone(p.tone);
    const isScreenshot = p.kind === 'screenshot';
    const isNew = seenAt > 0 && p.ts > seenAt; // seenAt=0(从没进过)不点,整屏都是新的没必要逐块点
    return `<button class="or-ph or-tone-block" data-tone="${tone}" data-ts="${p.worldTime}" data-action="open-gallery-photo" data-photo-id="${escapeHtml(p.photoId)}">
        ${isScreenshot ? `<span class="or-ph-kind-badge">${ICON_SCREENSHOT_BADGE}</span>` : ''}
        ${isNew ? '<span class="or-ph-new-dot"></span>' : ''}
        <span class="or-ph-label">${escapeHtml(p.label)}</span>
    </button>`;
}

/**
 * 相册列表屏(相机胶卷式方块网格,3 列,按世界时间倒序、按日分组)。
 * @param seenAt 进这个 app 那一刻的 seen 快照(整 app 一把,不按条目分——见 core/world.js seenKeyForGallery 的长注)
 * @param busy 独立生成锁(与其他 app 并行不互斥)
 */
export function renderGalleryListHtml({ world, busy, seenAt = 0, galleryNow }) {
    // world.photos 是 foldWorld 按 worldTime 升序输出的(任务书-M4 §二契约),这里倒序一遍给列表展示。
    const photos = [...world.photos].sort((a, b) => (b.worldTime || 0) - (a.worldTime || 0));
    const groups = groupByDay(photos, galleryNow);

    const body = photos.length
        ? `<div class="or-gallery-list">${groups.map(g => `
            <div class="or-gallery-date-sep"><span>${g.sep}</span></div>
            <div class="or-gallery-grid">${g.items.map(p => renderThumb(p, seenAt)).join('')}</div>
        `).join('')}</div>`
        : `<div class="or-empty">相册还是空的。点「刷新」——相册是无声的日记。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">相册</span>
            <button class="or-pill-btn small" data-action="gallery-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${body}`;
}

/**
 * 相册详情屏(nav push):大 tone 色块(约 4:3)+ label + 完整 desc(+ zh)+ 元信息行。
 * 返回箭头,无任何操作按钮(v1 没有可续写的详情语义——任务书-M4 §一)。
 */
export function renderGalleryPhotoHtml({ photo }) {
    const tone = safeTone(photo.tone);
    const zhLine = photo.zh && photo.zh !== photo.desc ? `<div class="or-zh">${escapeHtml(photo.zh)}</div>` : '';
    const metaLine = photo.kind === 'screenshot'
        ? `截图 · ${formatFullTime(photo.worldTime)}`
        : `拍摄于 ${formatFullTime(photo.worldTime)}`;
    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">相册</span>
        </div>
        <div class="or-gallery-detail-scroll">
            <div class="or-ph-hero or-tone-block" data-tone="${tone}"></div>
            <div class="or-gallery-detail-label">${escapeHtml(photo.label)}</div>
            <div class="or-gallery-detail-desc">${escapeHtml(photo.desc)}${zhLine}</div>
            <div class="or-gallery-detail-meta">${metaLine}</div>
        </div>`;
}
