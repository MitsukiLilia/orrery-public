// 论坛:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 apps/messenger/app.js 的模式)。
// 用户只读:帖底的回复框是主人屏幕上的那一格(只读、不可点),观测者唯二操作走 shell 的 data-action(刷新/生成更多)+ 长按/右键反悔。
// 真身字段只活在 core/世界数据层,这个文件从不读它——UI 读的是 displayName/affiliation/kind,
// 旧世界没有 displayName 的老住民才退回 world.shortIdFor 的短 ID,不暴露真名。
import { ICON_BACK, ICON_MINUS, ICON_PLUS, ICON_STAR, ICON_STAR_FILL, ICON_SEND, ICON_EXPORT, ICON_CHECK } from '../../ui/icons.js';
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
// (anonIdFor 按 threadId+key 哈希,同一帖同一 key 永远同一个 ID)。
// M13(任务书-M13 §2.4):表板改実名制——有 displayName 的住民显示「実名 · 所属」(ゲスト 再挂一个
// 小标),旧世界没有 displayName 的老住民原样退回旧式 handle #短ID,不迁移、不强改历史数据。
// M10 导出:ui/exporter.js 的论坛模板复用这份逻辑(离屏渲染的楼层作者名与 app 内必须完全一致),
// 故导出——两处哈希算法不能各揣一份、悄悄漂开。
export function authorLabel(world, item, threadId) {
    if (item.anon) return `${item.anon.name} ID:${anonIdFor(threadId, item.anon.key)}`;
    const r = world.residents.get(item.authorId);
    if (r?.displayName) return `${r.displayName}${r.affiliation ? ` · ${r.affiliation}` : ''}${r.kind === 'guest' ? ' · ゲスト' : ''}`;
    return r ? `${r.handle} #${shortIdFor(item.authorId)}` : String(item.authorId);
}

// 每页帖数(2026-08-21 月月点单分页,参考 Perigee 论坛):翻页纯本地渲染,不耗生成。
const THREADS_PER_PAGE = 10;

/**
 * 帖子列表(论坛首屏,按 lastActiveTs 倒序 + 分页;M12 起板块 chip 过滤降级为表裏 tab 切换——
 * 她从不按板块看帖,都是直接开首页,板块只留在每行的小标签上当帖子的属性)。
 * @param side 'omote'(表,缺省)| 'ura'(裏サイト)——过滤态,同旧 boardId 的哲学,不入导航栈
 * @param seen 「我看过了」水位表:某帖没有记录=她从没点进去过=新帖(挂 NEW),有记录就比对回复数
 * @param justUpdated 刚这一次刷新里新增/被盖楼的 threadId 集合——只用来播一次入场动效
 * @param page 1 起的页码;越界时钳回有效范围(反悔删帖把最后一页删空也不会白屏)
 */
export function renderForumListHtml({ world, busy, side = 'omote', page = 1, seen = {}, justUpdated = null }) {
    const boards = [...world.boards.values()];
    const isUra = side === 'ura';
    const threads = [...world.forumThreads.values()]
        .filter(t => t.title && (isUra ? t.side === 'ura' : t.side !== 'ura'))
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

    // M12:表裏切换条,样式照 apps/browser/skin.css 的 .or-browser-tabs 两钮切换,独立一份
    // (不复用同一个类名——两个 app 的 tab 语义不同,改一处不该悄悄漂到另一处)。
    const tabs = `<div class="or-forum-tabs">
        <button class="${!isUra ? 'on' : ''}" data-action="forum-select-side" data-side="omote">表</button>
        <button class="${isUra ? 'on' : ''}" data-action="forum-select-side" data-side="ura">裏</button>
    </div>`;

    const body = threads.length
        ? `<div class="or-forum-list${isUra ? ' ura' : ''}">${pageThreads.map(t => {
            const board = world.boards.get(t.boardId);
            const seenTs = seen[seenKeyForForumThread(t.threadId)];
            const neverOpened = seenTs === undefined;              // 一次都没点进去过 = 这帖对她来说是新的
            const newReplies = neverOpened ? 0 : newReplyCountOfForumThread(t, seenTs);
            const cls = ['or-forum-row', justUpdated?.has(t.threadId) ? 'just-arrived' : ''].filter(Boolean).join(' ');
            // 裏帖没有板块——标签位换成固定的「裏」小标(与板块名同一个视觉位置,风格另加 ura 修饰类)。
            const tag = isUra ? '<span class="or-forum-tag ura">裏</span>' : (board ? `<span class="or-forum-tag">${escapeHtml(board.name)}</span>` : '');
            return `<button class="${cls}" data-action="open-forum-thread" data-thread-id="${escapeHtml(t.threadId)}">
                <div class="or-forum-row-tags">
                    ${tag}
                    ${neverOpened ? '<span class="or-forum-new">NEW</span>' : ''}
                </div>
                <div class="or-forum-title">${escapeHtml(t.title)}</div>
                <div class="or-forum-meta">${escapeHtml(authorLabel(world, t, t.threadId))} · ${t.replyCount} 回复 · ${formatRelativeTime(t.lastActiveTs, world.worldClock)}${newReplies ? `<span class="or-forum-newreply">+${newReplies} 新回复</span>` : ''}</div>
            </button>`;
        }).join('')}</div>`
        : `<div class="or-empty">${isUra ? '裏サイト还是空的。点「刷新」——这里没有上面的人。' : '论坛还是空的,点「刷新」按主人的所属建板。'}</div>`;

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
        ${tabs}
        ${body}
        ${pager}`;
}

// M10 导出:楼层/OP 复选圈,与 or-forum-floor-row/or-forum-op 组合成一枚横排(圈在最前,
// 原内容整块让到旁边的 body-wrap 里)——只在 exportMode 时才套这层,平时的结构原样不动。
function exportCheckHtml(action, key, selected) {
    return `<button class="or-export-check ${selected ? 'on' : ''}" data-action="${action}" data-key="${escapeHtml(String(key))}">${selected ? ICON_CHECK : ''}</button>`;
}

/**
 * 帖内视图:楼主块 + 分隔 + 回复楼(细分隔线,不用气泡——论坛不是聊天)。
 * @param seenAt 进这个帖那一刻的 seen 快照(同消息线程,用快照而非实时水位,否则分界线当场消失)
 * @param replyBatch 「生成回复」这一次要点单几楼
 * @param exportMode M10:导出选楼模式——开着时楼层/OP 各挂一枚复选圈,header 换成选择工具条,
 *   帖底生成按钮隐藏(避免误触发生成)。
 * @param exportSel M10:null=默认全选;否则 Set(元素是楼层 r.ts 或固定字符串 'op')。
 * @param exportBusy M10:导出图片正在生成(与 busy 的 LLM 生成锁互不相扰,各自的按钮各自转 spinner)。
 */
export function renderForumThreadHtml({
    thread, world, busy, forumNow, seenAt = 0, starred = {}, replyBatch = 3,
    exportMode = false, exportSel = null, exportBusy = false,
}) {
    // Asterism 星标(task-007):整帖收藏,挂在楼主块作者行右端(观测者的标记,住民看不见)
    const starKey = starKeyForForumThread(thread.threadId);
    const starOn = !!starred[starKey];
    const starBtn = `<button class="or-star ${starOn ? 'on' : ''}" data-action="toggle-star" data-star-key="${escapeHtml(starKey)}" title="${starOn ? '从星图移除' : '加入星图'}">${starOn ? ICON_STAR_FILL : ICON_STAR}</button>`;

    const allKeys = ['op', ...thread.replies.map(r => r.ts)];
    const isSelected = (key) => exportSel === null || exportSel.has(key);
    const selectedCount = exportSel === null ? allKeys.length : exportSel.size;

    let repliesHtml = '';
    let sepDone = false;
    thread.replies.forEach((r, i) => {
        if (!sepDone && seenAt > 0 && r.ts > seenAt) {
            repliesHtml += `<div class="or-new-sep" data-new-anchor><span>以下是新回复</span></div>`;
            sepDone = true;
        }
        const floorBody = `<div class="or-forum-floor-head">
                <span class="or-forum-floor-num">${i + 1}F</span>
                <span class="or-forum-floor-author">${escapeHtml(authorLabel(world, r, thread.threadId))}</span>
                <span class="or-forum-floor-time">${formatRelativeTime(r.worldTime, forumNow)}</span>
            </div>
            ${Number.isFinite(r.replyToFloor) && r.replyToFloor > 0 ? `<div class="or-forum-quote">&gt;&gt;${r.replyToFloor}</div>` : ''}
            <div class="or-forum-floor-body">${escapeHtml(r.body)}${r.zh && r.zh !== r.body ? `<div class="or-zh">${escapeHtml(r.zh)}</div>` : ''}</div>`;
        repliesHtml += exportMode
            ? `<div class="or-forum-floor-row or-export-row" data-seq="${r.ts}">${exportCheckHtml('forum-export-pick', r.ts, isSelected(r.ts))}<div class="or-export-row-body">${floorBody}</div></div>`
            : `<div class="or-forum-floor-row" data-seq="${r.ts}">${floorBody}</div>`;
    });
    if (!thread.replies.length) repliesHtml = `<div class="or-empty">还没有人回复。</div>`;

    // M7a §4 输入框常驻(草案 3A):删掉原来帖内散落的「未发送回复」卡片,改成帖底一条只读的
    // 「回复框」——它不是聊天输入框,没有 input/contenteditable/data-action,观测者点不动、
    // 编辑不了,只是在还原主人此刻屏幕上真实存在的那一格。有草稿时显示草稿原文+送出前的光标,
    // 没有草稿就是空占位符;生成按钮的文案由它决定(有草稿=先发出再续写)。
    const d = thread.myDraft;
    const hasDraft = !!d?.text;
    // M12.1(她 2026-09-03 拍板):裏帖的草稿永远发不出去——回复框里照样显示「写了又删」的那句话
    // 与光标(余波本体),但发送图标不点亮、按钮只剩「生成回复」;领导在裏一开口,打工人的嗅觉会把
    // 这块地也毁掉,里版从此听不到实话。
    const canSend = hasDraft && thread.side !== 'ura';
    const composerHtml = `<div class="or-forum-composer ${hasDraft ? 'has-draft' : ''}">
            <div class="or-forum-composer-box">${hasDraft
        ? `<span class="or-forum-composer-text">${escapeHtml(d.text)}</span><span class="or-forum-caret"></span>`
        : `<span class="or-forum-composer-placeholder">回复这个帖子…</span>`}</div>
            <span class="or-forum-composer-send ${canSend ? 'on' : ''}">${ICON_SEND}</span>
        </div>
        ${hasDraft && d.zh && d.zh !== d.text ? `<div class="or-forum-composer-zh">${escapeHtml(d.zh)}</div>` : ''}`;

    // M12:裏サイト的帖子在作者行前挂一枚「裏サイト」小标——她进屏第一眼就知道自己在哪个 lane,
    // 不必回头看列表页的表裏切换条。
    const opBody = `<div class="or-forum-op-title">${escapeHtml(thread.title)}</div>
                ${thread.side === 'ura' ? '<span class="or-forum-tag ura">裏サイト</span>' : ''}
                <div class="or-forum-op-author">${escapeHtml(authorLabel(world, thread, thread.threadId))} · ${formatRelativeTime(thread.worldTime, forumNow)}${exportMode ? '' : starBtn}</div>
                <div class="or-forum-op-body">${escapeHtml(thread.body)}${thread.zh && thread.zh !== thread.body ? `<div class="or-zh">${escapeHtml(thread.zh)}</div>` : ''}</div>`;
    const opHtml = exportMode
        ? `<div class="or-forum-op or-export-row">${exportCheckHtml('forum-export-pick', 'op', isSelected('op'))}<div class="or-export-row-body">${opBody}</div></div>`
        : `<div class="or-forum-op">${opBody}</div>`;

    // M10:导出选楼模式的 header 换成三件套(取消/全选或清空/导出(N)),不出现回到列表的返回箭头——
    // 取消本身就是回到普通帖内视图,同一个按钮身兼两用没有歧义。
    const headerHtml = exportMode
        ? `<div class="or-header">
            <button class="or-pill-btn small" data-action="forum-export-toggle">取消</button>
            <button class="or-pill-btn small" data-action="forum-export-all">${selectedCount >= allKeys.length ? '清空' : '全选'}</button>
            <button class="or-pill-btn" data-action="forum-export-run" ${selectedCount === 0 ? 'disabled' : ''}>${exportBusy ? genSpinnerHtml() : `导出(${selectedCount})`}</button>
        </div>`
        : `<div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(thread.title)}</span>
            <button class="or-export-entry-btn" data-action="forum-export-toggle" title="导出图片">${ICON_EXPORT}</button>
        </div>`;

    return `
        ${headerHtml}
        <div class="or-forum-scroll">
            ${opHtml}
            <div class="or-forum-replies">${repliesHtml}</div>
        </div>
        ${exportMode ? '' : composerHtml}
        ${exportMode ? '' : `<div class="or-chat-footer">
            <div class="or-batch">
                <button data-action="stepper" data-field="forumReplyBatch" data-delta="-1" ${busy ? 'disabled' : ''}>${ICON_MINUS}</button>
                <span class="or-batch-value">${replyBatch}</span>
                <button data-action="stepper" data-field="forumReplyBatch" data-delta="1" ${busy ? 'disabled' : ''}>${ICON_PLUS}</button>
            </div>
            <button class="or-pill-btn" data-action="forum-generate-more" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : (canSend ? '发出并生成回复' : '生成回复')}</button>
        </div>`}`;
}
