// 论坛:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 apps/messenger/app.js 的模式)。
// 用户只读:帖底的回复框是主人屏幕上的那一格(只读、不可点),观测者唯二操作走 shell 的 data-action(刷新/生成更多)+ 长按/右键反悔。
// castName 只活在 core/世界数据层,这个文件从不读它——住民短 ID 用 world.shortIdFor,不暴露真名。
import { ICON_BACK, ICON_MINUS, ICON_PLUS, ICON_STAR, ICON_STAR_FILL, ICON_PIN, ICON_SEND } from '../../ui/icons.js';
import { escapeHtml } from '../../core/escape.js';
import { shortIdFor, seenKeyForForumThread, newReplyCountOfForumThread, starKeyForForumThread, anonIdFor } from '../../core/world.js';
import { formatRelativeTime } from '../../core/worldtime.js';

export const FORUM_APP_ID = 'forum';
export const FORUM_SKIN_URL = new URL('./skin.css', import.meta.url).href;

// isSameDay/formatRelativeTime 收进 core/worldtime.js(M7c §2)——六个 app 此前各揣一份一模一样
// 的副本,现在都从那里 import。相对时间的参照系是 world.worldClock(整部手机的现在,不是论坛
// 自己的 forumNow;M7c 起六个 app 统一参照同一把钟)。

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

// M7a §4:作者标签——item 是折好的帖子或楼层(authorId/anon 二选一)。次抛匿名现算展示 ID
// (anonIdFor 按 threadId+key 哈希,同一帖同一 key 永远同一个 ID);固定住民沿用旧的 handle #短ID。
function authorLabel(world, item, threadId) {
    if (item.anon) return `${item.anon.name} ID:${anonIdFor(threadId, item.anon.key)}`;
    const r = world.residents.get(item.authorId);
    return r ? `${r.handle} #${shortIdFor(item.authorId)}` : String(item.authorId);
}

// 每页帖数(2026-08-21 月月点单分页,参考 Perigee 论坛):翻页纯本地渲染,不耗生成。
const THREADS_PER_PAGE = 10;

// M5 置顶公告区:单条渲染(头行=图钉+签发方 tag+标题,点击本地展开/收起 body;不进 seen、不可星标、
// 不可单删——它只随「改組」整体消失)。expanded 由 shell 存在 nav 帧上,同分页的做法。
function noticeRowHtml(n, expanded) {
    return `<div class="or-forum-notice ${expanded ? 'open' : ''}">
        <button class="or-forum-notice-head" data-action="toggle-notice" data-notice-id="${escapeHtml(n.noticeId)}">
            ${ICON_PIN}
            ${n.signedBy ? `<span class="or-forum-notice-signer">${escapeHtml(n.signedBy)}</span>` : ''}
            <span class="or-forum-notice-title">${escapeHtml(n.title)}</span>
        </button>
        ${expanded ? `<div class="or-forum-notice-body">${escapeHtml(n.body)}${n.zh && n.zh !== n.body ? `<div class="or-zh">${escapeHtml(n.zh)}</div>` : ''}</div>` : ''}
    </div>`;
}

/**
 * 帖子列表(论坛首屏,板块 chip 过滤 + 按 lastActiveTs 倒序 + 分页)。
 * @param seen 「我看过了」水位表:某帖没有记录=她从没点进去过=新帖(挂 NEW),有记录就比对回复数
 * @param justUpdated 刚这一次刷新里新增/被盖楼的 threadId 集合——只用来播一次入场动效
 * @param page 1 起的页码;越界时钳回有效范围(反悔删帖把最后一页删空也不会白屏)
 * @param expandedNotices 当前展开了 body 的 noticeId 集合(Set,存在 nav 帧上,纯本地 UI 状态)
 * @param pastNoticesOpen 「过去的公告 (N)」折叠区是否展开(同上,纯本地)
 */
export function renderForumListHtml({
    world, busy, boardId, page = 1, seen = {}, justUpdated = null,
    expandedNotices = new Set(), pastNoticesOpen = false,
}) {
    const boards = [...world.boards.values()];
    const threads = [...world.forumThreads.values()]
        .filter(t => t.title && (!boardId || t.boardId === boardId))
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));
    const totalPages = Math.max(1, Math.ceil(threads.length / THREADS_PER_PAGE));
    const curPage = Math.min(Math.max(1, page), totalPages);
    const pageThreads = threads.slice((curPage - 1) * THREADS_PER_PAGE, curPage * THREADS_PER_PAGE);

    const headerTitle = world.community?.name || '论坛';

    // 旧式提示条(任务书-M5 §5):只在「有板块但没有所属」的旧世界出现——新世界一开始就带所属,永远不会走到这里。
    const legacyNote = (boards.length > 0 && !world.community) ? `<div class="or-forum-legacy-note">
        <p>这个论坛还是旧式(全世界型)。改組会清空论坛数据,按主人的所属重新建板。</p>
        <button class="or-pill-btn small" data-action="forum-reorganize">改組</button>
    </div>` : '';

    const chips = `<div class="or-forum-chips">
        <button class="or-forum-chip ${!boardId ? 'on' : ''}" data-action="select-forum-board" data-board-id="">全部</button>
        ${boards.map(b => `<button class="or-forum-chip ${boardId === b.boardId ? 'on' : ''}" data-action="select-forum-board" data-board-id="${escapeHtml(b.boardId)}">${escapeHtml(b.name)}</button>`).join('')}
    </div>`;

    // 置顶公告区:按 worldTime 倒序,前 3 条常驻,其余折进「过去的公告 (N)」(任务书-M5 §5)。
    const allNotices = [...world.notices.values()].sort((a, b) => (b.worldTime || 0) - (a.worldTime || 0));
    const pinnedNotices = allNotices.slice(0, 3);
    const pastNotices = allNotices.slice(3);
    const noticesHtml = allNotices.length ? `<div class="or-forum-notices">
        ${pinnedNotices.map(n => noticeRowHtml(n, expandedNotices.has(n.noticeId))).join('')}
        ${pastNotices.length
            ? (pastNoticesOpen
                ? `<button class="or-forum-notice-toggle" data-action="toggle-past-notices">收起过去的公告</button>${pastNotices.map(n => noticeRowHtml(n, expandedNotices.has(n.noticeId))).join('')}`
                : `<button class="or-forum-notice-toggle" data-action="toggle-past-notices">过去的公告 (${pastNotices.length})</button>`)
            : ''}
    </div>` : '';

    const body = threads.length
        ? `<div class="or-forum-list">${pageThreads.map(t => {
            const board = world.boards.get(t.boardId);
            const seenTs = seen[seenKeyForForumThread(t.threadId)];
            const neverOpened = seenTs === undefined;              // 一次都没点进去过 = 这帖对她来说是新的
            const newReplies = neverOpened ? 0 : newReplyCountOfForumThread(t, seenTs);
            const cls = ['or-forum-row', justUpdated?.has(t.threadId) ? 'just-arrived' : ''].filter(Boolean).join(' ');
            return `<button class="${cls}" data-action="open-forum-thread" data-thread-id="${escapeHtml(t.threadId)}">
                <div class="or-forum-row-tags">
                    ${board ? `<span class="or-forum-tag">${escapeHtml(board.name)}</span>` : ''}
                    ${neverOpened ? '<span class="or-forum-new">NEW</span>' : ''}
                </div>
                <div class="or-forum-title">${escapeHtml(t.title)}</div>
                <div class="or-forum-meta">${escapeHtml(authorLabel(world, t, t.threadId))} · ${t.replyCount} 回复 · ${formatRelativeTime(t.lastActiveTs, world.worldClock)}${newReplies ? `<span class="or-forum-newreply">+${newReplies} 新回复</span>` : ''}</div>
            </button>`;
        }).join('')}</div>`
        : `<div class="or-empty">论坛还是空的,点「刷新」按主人的所属建板。</div>`;

    // 分页条:单页时不占地方;prev/next 给绝对页码,shell 侧不做相对运算
    const pager = totalPages > 1 ? `<div class="or-forum-pager">
        <button class="or-forum-page-btn" data-action="forum-page" data-page="${curPage - 1}" ${curPage <= 1 ? 'disabled' : ''}>${ICON_BACK}</button>
        <span class="or-forum-page-num">${curPage} / ${totalPages}</span>
        <button class="or-forum-page-btn next" data-action="forum-page" data-page="${curPage + 1}" ${curPage >= totalPages ? 'disabled' : ''}>${ICON_BACK}</button>
    </div>` : '';

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(headerTitle)}</span>
            <button class="or-pill-btn small" data-action="forum-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${legacyNote}
        ${chips}
        ${noticesHtml}
        ${body}
        ${pager}`;
}

/**
 * 帖内视图:楼主块 + 分隔 + 回复楼(细分隔线,不用气泡——论坛不是聊天)。
 * @param seenAt 进这个帖那一刻的 seen 快照(同消息线程,用快照而非实时水位,否则分界线当场消失)
 * @param replyBatch 「生成回复」这一次要点单几楼
 */
export function renderForumThreadHtml({ thread, world, busy, forumNow, seenAt = 0, starred = {}, replyBatch = 3 }) {
    // Asterism 星标(task-007):整帖收藏,挂在楼主块作者行右端(观测者的标记,住民看不见)
    const starKey = starKeyForForumThread(thread.threadId);
    const starOn = !!starred[starKey];
    const starBtn = `<button class="or-star ${starOn ? 'on' : ''}" data-action="toggle-star" data-star-key="${escapeHtml(starKey)}" title="${starOn ? '从星图移除' : '加入星图'}">${starOn ? ICON_STAR_FILL : ICON_STAR}</button>`;
    let repliesHtml = '';
    let sepDone = false;
    thread.replies.forEach((r, i) => {
        if (!sepDone && seenAt > 0 && r.ts > seenAt) {
            repliesHtml += `<div class="or-new-sep" data-new-anchor><span>以下是新回复</span></div>`;
            sepDone = true;
        }
        repliesHtml += `<div class="or-forum-floor-row" data-seq="${r.ts}">
            <div class="or-forum-floor-head">
                <span class="or-forum-floor-num">${i + 1}F</span>
                <span class="or-forum-floor-author">${escapeHtml(authorLabel(world, r, thread.threadId))}</span>
                <span class="or-forum-floor-time">${formatRelativeTime(r.worldTime, forumNow)}</span>
            </div>
            ${Number.isFinite(r.replyToFloor) && r.replyToFloor > 0 ? `<div class="or-forum-quote">&gt;&gt;${r.replyToFloor}</div>` : ''}
            <div class="or-forum-floor-body">${escapeHtml(r.body)}${r.zh && r.zh !== r.body ? `<div class="or-zh">${escapeHtml(r.zh)}</div>` : ''}</div>
        </div>`;
    });
    if (!thread.replies.length) repliesHtml = `<div class="or-empty">还没有人回复。</div>`;

    // M7a §4 输入框常驻(草案 3A):删掉原来帖内散落的「未发送回复」卡片,改成帖底一条只读的
    // 「回复框」——它不是聊天输入框,没有 input/contenteditable/data-action,观测者点不动、
    // 编辑不了,只是在还原主人此刻屏幕上真实存在的那一格。有草稿时显示草稿原文+送出前的光标,
    // 没有草稿就是空占位符;生成按钮的文案由它决定(有草稿=先发出再续写)。
    const d = thread.myDraft;
    const hasDraft = !!d?.text;
    const composerHtml = `<div class="or-forum-composer ${hasDraft ? 'has-draft' : ''}">
            <div class="or-forum-composer-box">${hasDraft
        ? `<span class="or-forum-composer-text">${escapeHtml(d.text)}</span><span class="or-forum-caret"></span>`
        : `<span class="or-forum-composer-placeholder">回复这个帖子…</span>`}</div>
            <span class="or-forum-composer-send ${hasDraft ? 'on' : ''}">${ICON_SEND}</span>
        </div>
        ${hasDraft && d.zh && d.zh !== d.text ? `<div class="or-forum-composer-zh">${escapeHtml(d.zh)}</div>` : ''}`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(thread.title)}</span>
        </div>
        <div class="or-forum-scroll">
            <div class="or-forum-op">
                <div class="or-forum-op-title">${escapeHtml(thread.title)}</div>
                <div class="or-forum-op-author">${escapeHtml(authorLabel(world, thread, thread.threadId))} · ${formatRelativeTime(thread.worldTime, forumNow)}${starBtn}</div>
                <div class="or-forum-op-body">${escapeHtml(thread.body)}${thread.zh && thread.zh !== thread.body ? `<div class="or-zh">${escapeHtml(thread.zh)}</div>` : ''}</div>
            </div>
            <div class="or-forum-replies">${repliesHtml}</div>
        </div>
        ${composerHtml}
        <div class="or-chat-footer">
            <div class="or-batch">
                <button data-action="stepper" data-field="forumReplyBatch" data-delta="-1" ${busy ? 'disabled' : ''}>${ICON_MINUS}</button>
                <span class="or-batch-value">${replyBatch}</span>
                <button data-action="stepper" data-field="forumReplyBatch" data-delta="1" ${busy ? 'disabled' : ''}>${ICON_PLUS}</button>
            </div>
            <button class="or-pill-btn" data-action="forum-generate-more" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : (hasDraft ? '发出并生成回复' : '生成回复')}</button>
        </div>`;
}
