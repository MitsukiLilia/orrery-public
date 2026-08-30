// 备忘录「未发送的真心话」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 forum/sns/browser 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新)+ 长按/右键反悔(倒带)。
// v1 没有「生成更多/续写」——只有主刷新,详情屏只是看,没有任何操作按钮(任务书-M4 §一)。
// 系统自带 app,不起化名——不带品牌条,标题就是「备忘录」。
import { ICON_BACK } from '../../ui/icons.js';
import { escapeHtml } from '../../core/escape.js';
import { formatRelativeTime, formatFullTime } from '../../core/worldtime.js';

export const MEMO_APP_ID = 'memo';
export const MEMO_SKIN_URL = new URL('./skin.css', import.meta.url).href;

// isSameDay/formatRelativeTime/formatFullTime 收进 core/worldtime.js(M7c §2)——六个 app 此前
// 各揣一份一模一样的副本,现在都从那里 import。

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

// 备忘的第一行当标题、其余当预览(任务书-M4 §一:「每行=标题(text 首行,稍重)+ 预览(其余内容一行截断)」)。
// 与 core/generator.js 的 splitMemoFirstLine 是同一个切法,但两处各自独立实现——apps 与 core 之间
// 零共享格式化函数,同 browser 的先例(不为了不重复几行代码就打破分层)。
function splitFirstLine(text) {
    const s = String(text || '');
    const idx = s.indexOf('\n');
    return idx === -1 ? { title: s, rest: '' } : { title: s.slice(0, idx), rest: s.slice(idx + 1).replace(/\n+/g, ' ').trim() };
}

function renderRow(n, seenAt, memoNow) {
    const isNew = seenAt > 0 && n.ts > seenAt; // seenAt=0(从没进过)不点,整屏都是新的没必要逐行点
    const { title, rest } = splitFirstLine(n.text);
    return `<button class="or-memo-row" data-worldtime="${n.latestTs}" data-action="open-memo-note" data-note-id="${escapeHtml(n.noteId)}">
        ${isNew ? '<span class="or-memo-new-dot"></span>' : ''}
        <div class="or-memo-row-body">
            <div class="or-memo-row-title">${escapeHtml(title)}</div>
            ${rest ? `<div class="or-memo-row-preview">${escapeHtml(rest)}</div>` : ''}
        </div>
        <span class="or-memo-row-time">${formatRelativeTime(n.latestTs, memoNow)}</span>
    </button>`;
}

/**
 * 备忘录列表屏(便签行列表,按最近活动时间倒序)。
 * @param seenAt 进这个 app 那一刻的 seen 快照(整 app 一把,不按条目分——见 core/world.js seenKeyForMemo 的长注)
 * @param busy 独立生成锁(与其他 app 并行不互斥)
 */
export function renderMemoListHtml({ world, busy, seenAt = 0, memoNow }) {
    const notes = [...world.memos.values()].sort((a, b) => (b.latestTs || 0) - (a.latestTs || 0));
    const body = notes.length
        ? `<div class="or-memo-list">${notes.map(n => renderRow(n, seenAt, memoNow)).join('')}</div>`
        : `<div class="or-empty">备忘录还是空的。点「刷新」——没有观众的地方最诚实。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">备忘录</span>
            <button class="or-pill-btn small" data-action="memo-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${body}`;
}

/**
 * 备忘详情屏(nav push):全文(pre-wrap 保留换行)+ zh + 元信息行(创建于…,被改写过追加「· 编辑于…」)。
 * 返回箭头,无任何操作按钮(v1 没有可续写的详情语义,也不做删除线/历史版本视图——任务书-M4 §一)。
 */
export function renderMemoNoteHtml({ note }) {
    const zhLine = note.zh && note.zh !== note.text ? `<div class="or-zh">${escapeHtml(note.zh)}</div>` : '';
    const metaLine = `创建于 ${formatFullTime(note.createdTime)}`
        + (note.editedTime ? ` · 编辑于 ${formatFullTime(note.editedTime)}` : '');
    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">备忘录</span>
        </div>
        <div class="or-memo-detail-scroll">
            <div class="or-memo-detail-text">${escapeHtml(note.text)}</div>
            ${zhLine}
            <div class="or-memo-detail-meta">${metaLine}</div>
        </div>`;
}
