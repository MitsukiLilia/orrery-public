// 门户「Almanac」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 forum/browser 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新/导出)+ 长按/右键反悔。
// 三层结构:首页(板块入口 + 新着)→ 板块(条目一览)→ 条目(点开才生成的一整张页面,可导出)。
import { ICON_BACK, ICON_APP_ALMANAC, ICON_EXPORT } from '../../ui/icons.js';
import { escapeHtml } from '../../core/escape.js';
import { formatClock, formatFullTime } from '../../core/worldtime.js';
import { sanitizeSnapshotHtml, withDateSeps } from '../browser/app.js'; // 消毒管线与日分隔工法的正本,不复制一份

export const ALMANAC_APP_ID = 'almanac';
export const ALMANAC_SKIN_URL = new URL('./skin.css', import.meta.url).href;

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

// 品牌条副标:community 为 null(还没所属)时统一「観測待ち」;二态由 world.community.kind 决定,
// kind 不认识时按 org(イントラネット)兜底——同 core/generator.js modeRule() 的兜底哲学,两处各自实现
// 不共用一个函数(apps 与 core 之间零共享格式化函数,同 browser 的先例)。
function almanacModeLabel(community) {
    if (!community) return '観測待ち';
    const tag = community.kind === 'local' ? '地域ニュース' : (community.kind === 'school' ? 'ポータル' : 'イントラネット');
    return `${community.name}|${tag}`;
}

// 板块角标:该板下 items 里 ts>seenAt 或任一 update 的 ts>seenAt 的条数;seenAt<=0(从没进过)不点——
// 整屏都是新的没必要逐板去数(同 browser/gallery/memo 整 app 一把 seen 快照的判据)。
function sectionBadgeCount(world, section, seenAt) {
    if (seenAt <= 0) return 0;
    let n = 0;
    for (const it of world.almanacItems.values()) {
        if (it.sectionId !== section.sectionId) continue;
        if (it.ts > seenAt || it.updates.some(u => u.ts > seenAt)) n++;
    }
    return n;
}

// 条目行:首页「新着」区与板块页列表共用同一个组件(任务书-M11 §6.1)。
// isNew 判据同 sectionBadgeCount——ts(入账序号)不是 worldTime,新旧看的是「她看过了没有」不是「世界时刻」。
function almanacRowHtml(item, section, seenAt) {
    const isNew = seenAt > 0 && (item.ts > seenAt || item.updates.some(u => u.ts > seenAt));
    const zhLine = item.zh && item.zh !== item.title ? `<div class="or-zh">${escapeHtml(item.zh)}</div>` : '';
    const metaBits = [];
    if (item.signedBy) metaBits.push(escapeHtml(item.signedBy));
    if (item.status) metaBits.push(`<span class="or-alm-status">${escapeHtml(item.status)}</span>`);
    const metaLine = metaBits.length ? `<div class="or-alm-row-meta">${metaBits.join(' · ')}</div>` : '';
    return `<div class="or-alm-row clickable" data-action="open-almanac-item" data-item-id="${escapeHtml(item.itemId)}" data-worldtime="${item.worldTime}">
        ${isNew ? '<span class="or-alm-dot"></span>' : ''}
        <div class="or-alm-row-body">
            <div class="or-alm-row-title">${escapeHtml(item.title)}</div>
            ${zhLine}
            ${item.summary ? `<div class="or-alm-row-summary">${escapeHtml(item.summary)}</div>` : ''}
            ${metaLine}
        </div>
        <span class="or-alm-row-time">${formatClock(item.worldTime)}</span>
    </div>`;
}

/**
 * 门户首页:品牌条(模式标签)+ 板块入口列表 + 「新着」(全部条目按 lastActiveTs 倒序前 5 条)。
 * @param seenAt 进这个 app 那一刻的 seen 快照(整 app 一把,不按板块/条目分——见 core/world.js seenKeyForAlmanac 的长注)
 */
export function renderAlmanacHomeHtml({ world, busy, seenAt = 0 }) {
    const sections = [...world.sections.values()];
    const community = world.community;

    const sectionsHtml = sections.length ? `<div class="or-alm-sections">${sections.map(s => {
        const badge = sectionBadgeCount(world, s, seenAt);
        return `<button class="or-alm-section-row" data-action="open-almanac-section" data-section-id="${escapeHtml(s.sectionId)}">
            <div class="or-alm-section-main">
                <div class="or-alm-section-name">${escapeHtml(s.name)}</div>
                <div class="or-alm-section-desc">${escapeHtml(s.desc || '')}</div>
            </div>
            ${badge ? `<span class="or-alm-section-badge">${badge}</span>` : ''}
        </button>`;
    }).join('')}</div>` : '';

    const recentItems = [...world.almanacItems.values()]
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0))
        .slice(0, 5);
    const recentHtml = recentItems.length ? `<div class="or-alm-recent">
        <div class="or-alm-recent-title">新着</div>
        ${recentItems.map(it => almanacRowHtml(it, world.sections.get(it.sectionId), seenAt)).join('')}
    </div>` : '';

    const body = sections.length
        ? `${sectionsHtml}${recentHtml}`
        : `<div class="or-empty">还没有任何公示。点「刷新」——建前的世界也有它的动静。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">门户</span>
            <button class="or-pill-btn small" data-action="almanac-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        <div class="or-alm-brand">
            <span class="or-alm-brand-icon">${ICON_APP_ALMANAC}</span>
            <span class="or-alm-brand-name">Almanac</span>
            <span class="or-alm-brand-sub">${escapeHtml(almanacModeLabel(community))}</span>
        </div>
        <div class="or-alm-home">${body}</div>`;
}

/**
 * 板块页:该板全部条目按 worldTime 倒序 + 日分隔(withDateSeps,refNow=almanacNow——同 browser 的用法)。
 */
export function renderAlmanacSectionHtml({ world, sectionId, seenAt = 0, almanacNow }) {
    const section = world.sections.get(sectionId);
    const items = [...world.almanacItems.values()]
        .filter(it => it.sectionId === sectionId)
        .sort((a, b) => (b.worldTime || 0) - (a.worldTime || 0));
    const rows = withDateSeps(items, almanacNow);
    const body = items.length
        ? `<div class="or-alm-list">${rows.map(r => r.sep
            ? `<div class="or-alm-date-sep"><span>${escapeHtml(r.sep)}</span></div>`
            : almanacRowHtml(r.row, section, seenAt)).join('')}</div>`
        : `<div class="or-empty">这个板块还没有条目。</div>`;
    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(section?.name || '板块')}</span>
        </div>
        ${body}`;
}

/**
 * 条目页:meta 卡(件名/板块/署名/时刻/状态)+ 正文(点开才生成的页面,消毒后 sandbox iframe 装,
 * 复用 browser 的消毒函数与类名——不重新发明一套沙箱)+ 更新履歴卡(有 updates 才出)。
 */
// community 参数目前不参与渲染(meta 卡只需 section/signedBy/worldTime/status,任务书 §6.1 未点名
// 用它画别的东西)——签名里留着是为了跟 shell.js 调用处传参对齐,不必每次改签名都跟着改调用点。
export function renderAlmanacItemHtml({ item, section, page, community, busy, exportBusy = false }) {
    const exportBtn = page
        ? `<button class="or-export-entry-btn" data-action="export-almanac-page" data-item-id="${escapeHtml(item.itemId)}" title="导出图片" ${exportBusy ? 'disabled' : ''}>${exportBusy ? genSpinnerHtml() : ICON_EXPORT}</button>`
        : '';

    const metaBits = [escapeHtml(section?.name || item.sectionId)];
    if (item.signedBy) metaBits.push(escapeHtml(item.signedBy));
    metaBits.push(escapeHtml(formatFullTime(item.worldTime)));
    const statusBadge = item.status ? `<span class="or-alm-status">${escapeHtml(item.status)}</span>` : '';
    const metaCard = `<div class="or-alm-meta">
        <div class="or-alm-meta-title">${escapeHtml(item.title)}</div>
        <div class="or-alm-meta-line">${metaBits.join(' · ')}${statusBadge ? ` · ${statusBadge}` : ''}</div>
    </div>`;

    let pageHtml;
    if (page) {
        // 兜底样式同 renderWebPageHtml(apps/browser/app.js):html{overflow-x:auto} 让提示词层刻意
        // 保留的桌面版式能整页横向滚动而不是被挤压,img/video max-width 防止图片撑破窄屏容器。
        const clean = sanitizeSnapshotHtml(page.html);
        const srcdoc = `<style>a{cursor:not-allowed !important}body{margin:0;padding:14px;box-sizing:border-box;overflow-wrap:break-word}html{overflow-x:auto}img,video{max-width:100%;height:auto}</style>${clean}`;
        pageHtml = `<iframe class="or-webpage-frame" sandbox="" srcdoc="${escapeHtml(srcdoc)}"></iframe>
            ${page.zh ? `<div class="or-webpage-zh"><div>${escapeHtml(page.zh)}</div></div>` : ''}`;
    } else if (busy) {
        pageHtml = `<div class="or-empty">${genSpinnerHtml()}<br>接收信号中…页面正在跨越次元抵达。</div>`;
    } else {
        pageHtml = `<div class="or-empty">信号中断了。<br><button class="or-pill-btn" data-action="open-almanac-item" data-item-id="${escapeHtml(item.itemId)}">重新接收</button></div>`;
    }

    const updatesHtml = item.updates.length ? `<div class="or-alm-updates">
        <div class="or-alm-updates-title">更新履歴</div>
        ${item.updates.map(u => `<div class="or-alm-update-row">
            <div class="or-alm-update-head">
                <span class="or-alm-update-time">${escapeHtml(formatFullTime(u.worldTime))}</span>
                ${u.status ? `<span class="or-alm-status">${escapeHtml(u.status)}</span>` : ''}
            </div>
            <div class="or-alm-update-note">${escapeHtml(u.note || '')}${u.zh && u.zh !== u.note ? `<div class="or-zh">${escapeHtml(u.zh)}</div>` : ''}</div>
        </div>`).join('')}
    </div>` : '';

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(section?.name || item.sectionId)}</span>
            ${exportBtn}
        </div>
        ${metaCard}
        <div class="or-alm-item-body">${pageHtml}${updatesHtml}</div>`;
}
