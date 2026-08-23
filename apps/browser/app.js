// 浏览器「Astrolabe」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 forum/sns/messenger 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新/切 tab)+ 长按/右键反悔(两 tab 一起倒带)。
// v1 没有详情页——搜索记录/浏览历史都是终点,没有 open-xxx 的事,行本身不可点击,只能长按。
import { ICON_BACK, ICON_APP_BROWSER, ICON_SEARCH_SM } from '../../ui/icons.js';
import { escapeHtml } from '../../core/escape.js';

export const BROWSER_APP_ID = 'browser';
export const BROWSER_SKIN_URL = new URL('./skin.css', import.meta.url).href;

function isSameDay(ts1, ts2) {
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// 按日分组小标题:今天/昨天/M月D日,参照系是浏览器最新世界时刻(browserNow),照 messenger 的
// formatDateSep 思路抄(apps 互相零依赖,不借 messenger/skin.css 的样式也不借它的函数)。
function formatDateSep(ts, refNow) {
    const ref = refNow || Date.now();
    if (isSameDay(ts, ref)) return '今天';
    if (isSameDay(ts, ref - 86400000)) return '昨天';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function formatClock(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

/** 按世界时间倒序输入(已排好序的 items,最新在前),在日期变化处插入分隔标记——每天的标题落在该天最新一条上方。 */
function withDateSeps(items, refNow) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const prev = i > 0 ? items[i - 1] : null;
        if (!prev || !isSameDay(prev.worldTime, it.worldTime)) {
            out.push({ sep: formatDateSep(it.worldTime, refNow) });
        }
        out.push({ row: it });
    }
    return out;
}

/**
 * 单屏双 tab:品牌条(只读装饰,不是输入框)+ tab 切换 + 列表(按世界时间倒序、按日分组)。
 * @param seenAt 进这个 app 那一刻的 seen 快照(整 app 一把,不按条目分——见 core/world.js seenKeyForBrowser 的长注);
 *   条目的入账 ts(不是 worldTime)超过它才挂新内容小圆点,同消息/论坛/SNS 的"用 ts 判新旧、用 worldTime 排序"分工。
 * @param busy 独立生成锁(与消息/论坛/SNS 并行不互斥)
 */
export function renderBrowserHtml({ world, busy, tab = 'search', seenAt = 0, browserNow }) {
    const isSearch = tab !== 'visits';
    const items = isSearch
        ? [...world.searches.values()].sort((a, b) => (b.worldTime || 0) - (a.worldTime || 0))
        : [...world.visits.values()].sort((a, b) => (b.worldTime || 0) - (a.worldTime || 0));

    const rows = withDateSeps(items, browserNow);
    const body = items.length
        ? `<div class="or-browser-list">${rows.map(r => {
            if (r.sep) return `<div class="or-browser-date-sep"><span>${r.sep}</span></div>`;
            const it = r.row;
            const isNew = seenAt > 0 && it.ts > seenAt; // seenAt=0(从没进过)不点,整屏都是新的没必要逐行点
            const dotHtml = isNew ? '<span class="or-browser-dot"></span>' : '';
            if (isSearch) {
                const zhLine = it.zh && it.zh !== it.text ? `<div class="or-zh">${escapeHtml(it.zh)}</div>` : '';
                return `<div class="or-browser-row" data-ts="${it.worldTime}">
                    ${dotHtml}
                    <div class="or-browser-row-icon">${ICON_SEARCH_SM}</div>
                    <div class="or-browser-row-body">
                        <div class="or-browser-row-text">${escapeHtml(it.text)}${zhLine}</div>
                    </div>
                    <span class="or-browser-row-time">${formatClock(it.worldTime)}</span>
                </div>`;
            }
            const zhLine = it.zh && it.zh !== it.title ? `<div class="or-zh">${escapeHtml(it.zh)}</div>` : '';
            const fromTag = it.fromQueryId ? '<span class="or-browser-from-query">←检索</span>' : '';
            return `<div class="or-browser-row" data-ts="${it.worldTime}">
                ${dotHtml}
                <div class="or-browser-row-body">
                    <div class="or-browser-row-text">${escapeHtml(it.title)}${fromTag}${zhLine}</div>
                    <div class="or-browser-row-site">${escapeHtml(it.site)}</div>
                </div>
                <span class="or-browser-row-time">${formatClock(it.worldTime)}</span>
            </div>`;
        }).join('')}</div>`
        : `<div class="or-empty">还没有任何痕迹。点「刷新」——检索栏比日记更诚实。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">浏览器</span>
            <button class="or-pill-btn small" data-action="browser-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        <div class="or-browser-brand"><div class="or-browser-brand-pill">${ICON_APP_BROWSER}<span>Astrolabe</span></div></div>
        <div class="or-browser-tabs">
            <button class="${isSearch ? 'on' : ''}" data-action="browser-select-tab" data-tab="search">搜索记录</button>
            <button class="${!isSearch ? 'on' : ''}" data-action="browser-select-tab" data-tab="visits">浏览历史</button>
        </div>
        ${body}`;
}
