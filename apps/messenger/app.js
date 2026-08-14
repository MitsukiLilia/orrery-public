// 聊天软件:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(避免每次重渲染都叠加监听器)。
// 既読渲染只认 payload.read,不做"最后一条 AI 消息之前都算已读"那套推导(与 Perigee 的差异点)。
import { ICON_BACK, ICON_UNDO, ICON_MINUS, ICON_PLUS } from '../../ui/icons.js';
import {
    resolveSender, monogramFor, colorForContact,
    seenKeyForThread, unreadCountOfThread,
} from '../../core/world.js';

export const MESSENGER_APP_ID = 'messenger';
export const MESSENGER_SKIN_URL = new URL('./skin.css', import.meta.url).href;

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
}

function isSameDay(ts1, ts2) {
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMinute(ts1, ts2) {
    return Math.floor(ts1 / 60000) === Math.floor(ts2 / 60000);
}
function formatClock(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
// 「今天/昨天」的参照系是世界最新时刻(refNow),不是现实时钟——手机活在故事里。
function formatDateSep(ts, refNow) {
    const ref = refNow || Date.now();
    if (isSameDay(ts, ref)) return '今天';
    if (isSameDay(ts, ref - 86400000)) return '昨天';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function genDotsHtml() {
    return '<span class="or-generating-dots"><span></span><span></span><span></span></span>';
}

function groupAvatarHtml(group) {
    const cells = (group.members || []).slice(0, 4).map(m =>
        `<span style="background-color:${colorForContact(m.id)}">${escapeHtml(monogramFor(m.name))}</span>`).join('');
    return `<div class="or-avatar or-avatar-group">${cells}</div>`;
}

/**
 * 线程列表(消息 app 首屏,私聊+群聊混排按世界时间倒序)。
 * @param seen 「我看过了」水位表(见 core/world.js 长注);未读数只认它,不认 payload.read
 * @param justUpdated 刚刚这一次刷新里长出新消息的 threadId 集合——只用来播一次入场动效
 */
export function renderThreadListHtml({ world, busy, seen = {}, justUpdated = null }) {
    const threads = [...world.threads.values()]
        .filter(t => t.kind === 'group' ? !!t.group : world.contacts.has(t.contactId))
        .sort((a, b) => (b.lastMessage?.displayTs || 0) - (a.lastMessage?.displayTs || 0));

    const body = threads.length
        ? `<div class="or-thread-list">${threads.map(t => {
            const isGroup = t.kind === 'group';
            const name = isGroup ? `${t.group.name}(${(t.group.members || []).length})` : world.contacts.get(t.contactId).name;
            let preview = '(暂无消息)';
            if (t.lastMessage) {
                // 群成员名来自模型,和正文一样要转义(此前只包了正文、漏了这一段)
                const who = t.lastMessage.sender === 'me' ? '我'
                    : (isGroup ? (resolveSender(world, t, t.lastMessage.sender)?.name || '?') : '');
                preview = `${who ? escapeHtml(who) + ': ' : ''}${escapeHtml(t.lastMessage.text)}`;
            }
            const avatar = isGroup
                ? groupAvatarHtml(t.group)
                : `<div class="or-avatar" style="background-color:${world.contacts.get(t.contactId).color}">${escapeHtml(world.contacts.get(t.contactId).monogram)}</div>`;
            // 未读数=她没看过的「别人发来的」消息;t.unread(模型演的既読)只影响气泡上的「既読」二字,不进这里
            const unread = unreadCountOfThread(t, seen[seenKeyForThread(t.threadId)]);
            const fresh = justUpdated?.has(t.threadId);
            const cls = ['or-thread-row', unread ? 'unread' : '', fresh ? 'just-arrived' : ''].filter(Boolean).join(' ');
            return `<button class="${cls}" data-action="open-thread" data-thread-id="${escapeHtml(t.threadId)}">
                ${avatar}
                <div class="or-thread-body">
                    <span class="or-thread-name">${escapeHtml(name)}</span>
                    <span class="or-thread-preview">${preview}</span>
                </div>
                ${unread ? `<div class="or-unread-badge">${unread > 99 ? '99+' : unread}</div>` : ''}
            </button>`;
        }).join('')}</div>`
        : `<div class="or-empty">还没有联系人。点上面「刷新」,让手机随故事的进展苏醒过来。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">消息</span>
            <button class="or-pill-btn small" data-action="refresh" ${busy ? 'disabled' : ''}>${busy ? genDotsHtml() : '刷新'}</button>
        </div>
        ${body}`;
}

/**
 * 单个线程的对话视图(私聊/群聊通用;群聊显示发送者名,既読只在私聊有意义)。
 * @param seenAt 进这条线程那一刻的 seen 水位——分界线画在它之后的第一条来信上,
 *   全程用这个**快照**而不是实时水位:进屋就把水位推到最新了,拿实时值分界线会当场消失。
 * @param replyBatch 「生成」按钮这一次要点单几条
 */
export function renderThreadHtml({ thread, world, busy, worldNow, seenAt = 0, replyBatch = 3 }) {
    const isGroup = thread.kind === 'group';
    const title = isGroup
        ? `${thread.group.name}(${(thread.group.members || []).length})`
        : world.contacts.get(thread.threadId)?.name || '?';
    const msgs = thread.messages; // 全量渲染——summary 只影响 LLM 上下文,UI 不隐藏任何消息
    let body = '';
    let sepDone = false;

    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const prev = i > 0 ? msgs[i - 1] : null;
        const next = i < msgs.length - 1 ? msgs[i + 1] : null;

        // 新消息分界线:进屋后滚动条就停在这里,不必再从头往下翻。data-new-anchor 是 shell 的定位靶。
        // seenAt=0(从没进过的新线程)不画——整条都是新的,画一条横在最上面纯属噪音。
        if (!sepDone && seenAt > 0 && m.ts > seenAt && m.sender !== 'me') {
            body += `<div class="or-new-sep" data-new-anchor><span>以下是新消息</span></div>`;
            sepDone = true;
        }

        if (!prev || !isSameDay(prev.displayTs, m.displayTs)) {
            body += `<div class="or-date-sep"><span>${formatDateSep(m.displayTs, worldNow)}</span></div>`;
        }

        const isMe = m.sender === 'me';
        const sender = isMe ? null : resolveSender(world, thread, m.sender);
        const sameAsPrev = prev && prev.sender === m.sender;
        const sameAsNext = next && next.sender === m.sender;
        const showAvatar = !isMe && !sameAsPrev;
        const showTime = !(sameAsNext && isSameMinute(m.displayTs, next.displayTs));

        let meta = '';
        if (showTime) {
            const readTag = !isGroup && isMe && m.read ? '<span>既読</span>' : '';
            meta = `<div class="or-msg-meta">${readTag}<span>${formatClock(m.displayTs)}</span></div>`;
        }

        // 行内三层:发送者名 / 头像+气泡那一行 / 时间。名字和时间**必须在气泡行之外**——
        // 它们此前都塞在同一个 flex 行里,头像按 align-items 贴的是整行的底,于是被时间行拽到
        // 气泡下方;同一人连发时,第一行的底又正好落在两个气泡中间(她真机截图指出)。
        // 摘出去之后,头像只与气泡对齐(顶对齐),气泡多长都不影响。
        const avatar = !isMe
            ? (showAvatar
                ? `<div class="or-msg-avatar" style="background-color:${sender?.color || '#CFCDBE'}">${escapeHtml(sender?.monogram || '?')}</div>`
                : '<div class="or-msg-avatar hidden"></div>')
            : '';
        const senderName = (isGroup && showAvatar && sender) ? `<div class="or-sender-name">${escapeHtml(sender.name)}</div>` : '';
        const zhLine = m.zh && m.zh !== m.text ? `<div class="or-zh">${escapeHtml(m.zh)}</div>` : '';
        body += `<div class="or-msg-row ${isMe ? 'me' : ''}" data-ts="${m.ts}">`;
        body += senderName;
        body += `<div class="or-msg-line">${avatar}<div class="or-msg-col"><div class="or-bubble">${escapeHtml(m.text)}${zhLine}</div></div>`;
        body += `<button class="or-msg-revert" data-action="revert" data-ts="${m.ts}" title="从这条起删除本线程之后的所有消息">${ICON_UNDO}</button></div>`;
        body += meta;
        body += `</div>`;
    }

    if (!msgs.length) body = `<div class="or-empty">这段聊天还是空的。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(title)}</span>
        </div>
        <div class="or-chat-scroll">${body}</div>
        <div class="or-chat-footer">
            <div class="or-batch">
                <button data-action="stepper" data-field="threadReplyBatch" data-delta="-1" ${busy ? 'disabled' : ''}>${ICON_MINUS}</button>
                <span class="or-batch-value">${replyBatch}</span>
                <button data-action="stepper" data-field="threadReplyBatch" data-delta="1" ${busy ? 'disabled' : ''}>${ICON_PLUS}</button>
            </div>
            <button class="or-pill-btn" data-action="generate-more" ${busy ? 'disabled' : ''}>${busy ? genDotsHtml() : '生成消息'}</button>
        </div>`;
}
