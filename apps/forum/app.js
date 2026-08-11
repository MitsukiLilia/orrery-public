// 论坛:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 apps/messenger/app.js 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新/生成更多)+ 长按/右键反悔。
// castName 只活在 core/世界数据层,这个文件从不读它——住民短 ID 用 world.shortIdFor,不暴露真名。
import { ICON_BACK } from '../../ui/icons.js';
import { shortIdFor } from '../../core/world.js';

export const FORUM_APP_ID = 'forum';
export const FORUM_SKIN_URL = new URL('./skin.css', import.meta.url).href;

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
}

function isSameDay(ts1, ts2) {
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 相对时间:x分钟前/x小时前/昨天/M月D日,参照系是论坛最新世界时刻(forumNow),不是现实时钟。
function formatRelativeTime(ts, refNow) {
    const ref = refNow || Date.now();
    const diffMin = Math.max(0, Math.floor((ref - ts) / 60000));
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    if (isSameDay(ts, ref - 86400000)) return '昨天';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function genDotsHtml() {
    return '<span class="or-generating-dots"><span></span><span></span><span></span></span>';
}

function handleWithId(world, residentId) {
    const r = world.residents.get(residentId);
    return r ? `${r.handle} #${shortIdFor(residentId)}` : String(residentId);
}

/** 帖子列表(论坛首屏,板块 chip 过滤 + 按 lastActiveTs 倒序)。 */
export function renderForumListHtml({ world, busy, boardId }) {
    const boards = [...world.boards.values()];
    const threads = [...world.forumThreads.values()]
        .filter(t => t.title && (!boardId || t.boardId === boardId))
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));

    const chips = `<div class="or-forum-chips">
        <button class="or-forum-chip ${!boardId ? 'on' : ''}" data-action="select-forum-board" data-board-id="">全部</button>
        ${boards.map(b => `<button class="or-forum-chip ${boardId === b.boardId ? 'on' : ''}" data-action="select-forum-board" data-board-id="${escapeHtml(b.boardId)}">${escapeHtml(b.name)}</button>`).join('')}
    </div>`;

    const body = threads.length
        ? `<div class="or-forum-list">${threads.map(t => {
            const board = world.boards.get(t.boardId);
            return `<button class="or-forum-row" data-action="open-forum-thread" data-thread-id="${escapeHtml(t.threadId)}">
                ${board ? `<span class="or-forum-tag">${escapeHtml(board.name)}</span>` : ''}
                <div class="or-forum-title">${escapeHtml(t.title)}</div>
                <div class="or-forum-meta">${escapeHtml(handleWithId(world, t.authorId))} · ${t.replyCount} 回复 · ${formatRelativeTime(t.lastActiveTs, world.forumNow)}</div>
            </button>`;
        }).join('')}</div>`
        : `<div class="or-empty">论坛还没有人气。点「刷新」,让这个世界开始说话。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">论坛</span>
            <button class="or-pill-btn small" data-action="forum-refresh" ${busy ? 'disabled' : ''}>${busy ? genDotsHtml() : '刷新'}</button>
        </div>
        ${chips}
        ${body}`;
}

/** 帖内视图:楼主块 + 分隔 + 回复楼(细分隔线,不用气泡——论坛不是聊天)。 */
export function renderForumThreadHtml({ thread, world, busy, forumNow }) {
    let repliesHtml = '';
    thread.replies.forEach((r, i) => {
        repliesHtml += `<div class="or-forum-floor-row" data-ts="${r.ts}">
            <div class="or-forum-floor-head">
                <span class="or-forum-floor-num">${i + 1}F</span>
                <span class="or-forum-floor-author">${escapeHtml(handleWithId(world, r.authorId))}</span>
                <span class="or-forum-floor-time">${formatRelativeTime(r.worldTime, forumNow)}</span>
            </div>
            ${Number.isFinite(r.replyToFloor) && r.replyToFloor > 0 ? `<div class="or-forum-quote">&gt;&gt;${r.replyToFloor}</div>` : ''}
            <div class="or-forum-floor-body">${escapeHtml(r.body)}${r.zh && r.zh !== r.body ? `<div class="or-zh">${escapeHtml(r.zh)}</div>` : ''}</div>
        </div>`;
    });
    if (!thread.replies.length) repliesHtml = `<div class="or-empty">还没有人回复。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(thread.title)}</span>
        </div>
        <div class="or-forum-scroll">
            <div class="or-forum-op">
                <div class="or-forum-op-title">${escapeHtml(thread.title)}</div>
                <div class="or-forum-op-author">${escapeHtml(handleWithId(world, thread.authorId))} · ${formatRelativeTime(thread.worldTime, forumNow)}</div>
                <div class="or-forum-op-body">${escapeHtml(thread.body)}${thread.zh && thread.zh !== thread.body ? `<div class="or-zh">${escapeHtml(thread.zh)}</div>` : ''}</div>
            </div>
            <div class="or-forum-replies">${repliesHtml}</div>
        </div>
        <div class="or-chat-footer">
            <button class="or-pill-btn" data-action="forum-generate-more" ${busy ? 'disabled' : ''}>${busy ? genDotsHtml() : '生成更多'}</button>
        </div>`;
}
