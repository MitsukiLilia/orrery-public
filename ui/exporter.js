// 导出图片(任务书-M10):把手机屏幕里的一段内容烧成一张可保存的长图——网页整页快照、
// 论坛选楼、消息选段。观测者零输入铁律的边界(任务书 §0):导出全程只读 world,不往世界
// 账本写任何东西;勾选/按钮都是观测者侧操作,同星标先例合法。
//
// 三个模板构建器(buildWebExportHtml/buildForumExportHtml/buildMessengerExportHtml)是不碰
// DOM 的纯函数——`node --input-type=module` 直接可跑,施工时已按任务书 §6 的四条断言冒烟过。
// 其余(vendor 懒加载/离屏渲染/domToPng)才碰 DOM,只在真实浏览器里跑,ui/shell.js 只消费
// 这个文件对外的 exportWebSnapshot/exportForumThread/exportMessengerThread 三个入口。
//
// 渲染容器=离屏 iframe(srcdoc,sandbox=allow-same-origin)——双向隔离:快照/模板自带的 <style>
// 不会全局生效污染酒馆页面,酒馆本体与美化主题的全局规则也渗不进导出内容。⚠️不能用 Shadow DOM
// 隔离:vendor 的 domToPng 克隆时丢 attachShadow 的内容,出来是一张只有尺寸的白图(CDP 实测,
// 2026-09-01);iframe 的 contentDocument.body 它能正常截。因此三个模板必须完全自包含:自带
// <style>,不依赖手机壳 shadow 里的 skin.css;颜色/字体值都是从 skin.css/shell.css 抄来的具体值。
import { escapeHtml } from '../core/escape.js';
import { resolveSender } from '../core/world.js';
import { isSameDay, formatClock, formatFullTime } from '../core/worldtime.js';
import { composeSnapshotHtml, sanitizeSnapshotHtml } from '../apps/browser/app.js';
import { authorLabel } from '../apps/forum/app.js';
import { isSameMinute } from '../apps/messenger/app.js';

const VENDOR_URL = new URL('./vendor/modern-screenshot.umd.js', import.meta.url).href;
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif';
// 三套 --or-* token 的具体值:字面抄自 ui/shell.css 的默认(海盐巧克力)主题——导出图不跟随
// 她当下选的手机皮肤,统一走这一套底色(任务书没有要求导出跟随主题,若以后要跟随,颜色值
// 从这里改起,别的地方不用动)。
const TOKENS_CSS = '--or-cream:#F4EFE4;--or-cream-2:#ECE4D4;--or-white:#FBF9F4;--or-salt:#C7D7E1;'
    + '--or-cocoa:#6E5A50;--or-cocoa-light:#8B7568;';

// 跳选间隙的居中小字——论坛「⋯(略)⋯」、消息「⋯」,视觉规则共用一份。
function gapSepHtml(text) {
    return `<div class="or-export-gap"><span>${escapeHtml(text)}</span></div>`;
}

// ⚠️导出图里的时间一律用绝对时刻,不用 app 内的相对写法(「3小时前」「今天」):图是会被长期
// 保存的快照,相对词的参照系在保存那一刻就死了,过后再看语义直接腐坏;真实揭示板/聊天记录的
// 截图本来也都是绝对时间戳。论坛用 formatFullTime,消息的日期分隔用这里的绝对版(不动 core)。
function formatAbsDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ── 3.1 网页(整页长图):不碰 DOM 的纯函数。 ──
// zh 大意故意不进图(它是给观测者的翻译,不是页面本身的一部分——任务书 §3.1)。
export function buildWebExportHtml({ visit, snapshot, appends }) {
    const composed = composeSnapshotHtml(snapshot?.html, appends);
    const clean = sanitizeSnapshotHtml(composed); // 快照 HTML 是模型产物——iframe 虽禁脚本,消毒仍是第一道闸不是可选项(双闸哲学)
    const url = snapshot?.url || '';
    const worldTime = visit?.worldTime ?? snapshot?.worldTime;
    const footerParts = [url, Number.isFinite(worldTime) ? formatFullTime(worldTime) : ''].filter(Boolean);
    const footer = footerParts.join(' · ');
    return `<div class="or-export-web">
<style>
.or-export-web{${TOKENS_CSS}background:#FFFFFF;font-family:${FONT_STACK};}
.or-export-web-body{margin:0;padding:14px;box-sizing:border-box;overflow-wrap:break-word;}
.or-export-web-body img,.or-export-web-body video{max-width:100%;height:auto;}
.or-export-web .or-export-footer{padding:8px 14px;font-size:11.5px;color:var(--or-cocoa-light);border-top:1px solid var(--or-cream-2);background:var(--or-cream);}
</style>
<div class="or-export-web-body">${clean}</div>
${footer ? `<div class="or-export-footer">${escapeHtml(footer)}</div>` : ''}
</div>`;
}

// ── 3.2 论坛(选楼):不碰 DOM 的纯函数。 ──
// selectedSeqs:null=默认全选;否则 Set,元素是楼层的 r.ts(number)或固定字符串 'op'。
// 楼号用原始 iF 序号(遍历完整 thread.replies,只在选中时才拼进输出),跳选也不重排。
export function buildForumExportHtml({ thread, world, selectedSeqs }) {
    const board = world.boards?.get(thread.boardId);
    const boardName = board?.name || '';
    const includeOp = selectedSeqs === null || selectedSeqs.has('op');

    const boardHead = boardName ? `<div class="or-export-forum-board">${escapeHtml(boardName)}</div>` : '';

    let opHtml;
    if (includeOp) {
        opHtml = `<div class="or-forum-op">
            <div class="or-forum-op-title">${escapeHtml(thread.title || '')}</div>
            <div class="or-forum-op-author">${escapeHtml(authorLabel(world, thread, thread.threadId))} · ${Number.isFinite(thread.worldTime) ? escapeHtml(formatFullTime(thread.worldTime)) : ''}</div>
            <div class="or-forum-op-body">${escapeHtml(thread.body || '')}${thread.zh && thread.zh !== thread.body ? `<div class="or-zh">${escapeHtml(thread.zh)}</div>` : ''}</div>
        </div>`;
    } else {
        // OP 可不选:仍要带帖题一行,不然图没头没尾(任务书 §3.2)。
        opHtml = `<div class="or-export-forum-title-only">${escapeHtml(thread.title || '')}</div>`;
    }

    const replies = thread.replies || [];
    let repliesHtml = '';
    let prevShownIdx = -2; // 哨兵值,保证第一条选中楼层前面不会被误判成"跳选过"
    replies.forEach((r, i) => {
        const selected = selectedSeqs === null || selectedSeqs.has(r.ts);
        if (!selected) return;
        if (prevShownIdx !== -2 && prevShownIdx !== i - 1) repliesHtml += gapSepHtml('⋯(略)⋯');
        prevShownIdx = i;
        repliesHtml += `<div class="or-forum-floor-row">
            <div class="or-forum-floor-head">
                <span class="or-forum-floor-num">${i + 1}F</span>
                <span class="or-forum-floor-author">${escapeHtml(authorLabel(world, r, thread.threadId))}</span>
                <span class="or-forum-floor-time">${Number.isFinite(r.worldTime) ? escapeHtml(formatFullTime(r.worldTime)) : ''}</span>
            </div>
            ${Number.isFinite(r.replyToFloor) && r.replyToFloor > 0 ? `<div class="or-forum-quote">&gt;&gt;${r.replyToFloor}</div>` : ''}
            <div class="or-forum-floor-body">${escapeHtml(r.body || '')}${r.zh && r.zh !== r.body ? `<div class="or-zh">${escapeHtml(r.zh)}</div>` : ''}</div>
        </div>`;
    });

    const footerParts = [boardName || world.community?.name || '', Number.isFinite(thread.worldTime) ? formatFullTime(thread.worldTime) : ''].filter(Boolean);
    const footer = footerParts.join(' · ');

    return `<div class="or-export-forum">
<style>
.or-export-forum{${TOKENS_CSS}background:var(--or-cream);font-family:${FONT_STACK};}
.or-export-forum-board{padding:10px 14px;font-size:12px;font-weight:700;color:var(--or-cocoa-light);background:var(--or-cream-2);border-bottom:1px solid var(--or-cream);}
.or-export-forum-title-only{padding:16px;font-size:15px;font-weight:700;color:var(--or-cocoa);line-height:1.4;border-bottom:6px solid var(--or-cream-2);}
.or-export-forum .or-forum-op{padding:16px;border-bottom:6px solid var(--or-cream-2);}
.or-export-forum .or-forum-op-title{font-size:17px;font-weight:700;color:var(--or-cocoa);line-height:1.4;}
.or-export-forum .or-forum-op-author{font-size:12px;color:var(--or-cocoa-light);margin-top:6px;}
.or-export-forum .or-forum-op-body{font-size:13.5px;color:var(--or-cocoa);line-height:1.6;margin-top:10px;white-space:pre-wrap;word-break:break-word;}
.or-export-forum .or-forum-replies{padding:0 16px;}
.or-export-forum .or-forum-floor-row{padding:12px 0;border-bottom:1px solid var(--or-cream-2);}
.or-export-forum .or-forum-floor-head{display:flex;align-items:baseline;gap:8px;}
.or-export-forum .or-forum-floor-num{font-size:11.5px;color:var(--or-cocoa-light);flex-shrink:0;}
.or-export-forum .or-forum-floor-author{font-size:12.5px;font-weight:600;color:var(--or-cocoa);flex:1;min-width:0;}
.or-export-forum .or-forum-floor-time{font-size:10.5px;color:var(--or-cocoa-light);flex-shrink:0;}
.or-export-forum .or-forum-quote{font-size:11px;color:var(--or-cocoa-light);margin-top:4px;}
.or-export-forum .or-forum-floor-body{font-size:13.5px;color:var(--or-cocoa);line-height:1.6;margin-top:4px;white-space:pre-wrap;word-break:break-word;}
.or-export-forum .or-zh{font-size:12px;color:var(--or-cocoa-light);margin-top:3px;line-height:1.5;}
.or-export-forum .or-export-gap{text-align:center;margin:10px 2px;font-size:11px;color:var(--or-cocoa-light);}
.or-export-forum .or-export-footer{padding:8px 14px;font-size:11.5px;color:var(--or-cocoa-light);border-top:1px solid var(--or-cream-2);background:var(--or-cream-2);}
</style>
${boardHead}
${opHtml}
<div class="or-forum-replies">${repliesHtml}</div>
${footer ? `<div class="or-export-footer">${escapeHtml(footer)}</div>` : ''}
</div>`;
}

// ── 3.3 消息(选段):不碰 DOM 的纯函数。 ──
// selectedSeqs:null=默认全选;否则 Set,元素是消息的 m.ts(number)。
// 折叠判据(同一人连发/同分钟省时间戳)与日期分隔全部在"选中子集重新拼起来的序列"上重算——
// 不是照抄 renderThreadHtml 在全量消息上算好的显隐状态:那套状态是为完整对话准备的,跳选之后
// 相邻关系已经变了,直接照搬会把该出现的时间戳/头像悄悄吃掉(任务书 §3.3 明确要求"重算,不是
// 抄屏幕状态")。判定"是否真的挨着"看原始数组下标是否连续,不连续(说明中间有被跳过的消息)
// 就在这里插一条居中「⋯」,并且把 prev/next 当断开处理——折叠只发生在真正连续的选中消息之间。
export function buildMessengerExportHtml({ thread, world, selectedSeqs }) {
    const isGroup = thread.kind === 'group';
    const title = isGroup
        ? `${thread.group?.name || '?'}${thread.group?.members ? `(${thread.group.members.length})` : ''}`
        : (world.contacts.get(thread.threadId)?.name || '?');

    const all = thread.messages || [];
    const shown = [];
    for (let i = 0; i < all.length; i++) {
        if (selectedSeqs === null || selectedSeqs.has(all[i].ts)) shown.push({ m: all[i], i });
    }

    let body = '';
    for (let j = 0; j < shown.length; j++) {
        const { m, i } = shown[j];
        const prevEntry = j > 0 ? shown[j - 1] : null;
        const nextEntry = j < shown.length - 1 ? shown[j + 1] : null;
        const contiguousPrev = !!prevEntry && prevEntry.i === i - 1;
        const contiguousNext = !!nextEntry && nextEntry.i === i + 1;
        if (prevEntry && !contiguousPrev) body += gapSepHtml('⋯');
        const prev = contiguousPrev ? prevEntry.m : null;
        const next = contiguousNext ? nextEntry.m : null;

        if (!prev || !isSameDay(prev.displayTs, m.displayTs)) {
            body += `<div class="or-date-sep"><span>${escapeHtml(formatAbsDate(m.displayTs))}</span></div>`;
        }

        const isMe = m.sender === 'me';
        const sender = isMe ? null : resolveSender(world, thread, m.sender);
        const sameAsPrev = !!(prev && prev.sender === m.sender);
        const sameAsNext = !!(next && next.sender === m.sender);
        const showAvatar = !isMe && !sameAsPrev;
        const showTime = !(sameAsNext && next && isSameMinute(m.displayTs, next.displayTs));

        let meta = '';
        if (showTime) {
            const readTag = !isGroup && isMe && m.read ? '<span>既読</span>' : '';
            meta = `<div class="or-msg-meta">${readTag}<span>${escapeHtml(formatClock(m.displayTs))}</span></div>`;
        }
        const avatar = !isMe
            ? (showAvatar
                ? `<div class="or-msg-avatar" style="background-color:${escapeHtml(sender?.color || '#CFCDBE')}">${escapeHtml(sender?.monogram || '?')}</div>`
                : '<div class="or-msg-avatar hidden"></div>')
            : '';
        const senderName = (isGroup && showAvatar && sender) ? `<div class="or-sender-name">${escapeHtml(sender.name)}</div>` : '';
        const zhLine = m.zh && m.zh !== m.text ? `<div class="or-zh">${escapeHtml(m.zh)}</div>` : '';

        body += `<div class="or-msg-row ${isMe ? 'me' : ''}">`;
        body += senderName;
        body += `<div class="or-msg-line">${avatar}<div class="or-msg-col"><div class="or-bubble">${escapeHtml(m.text || '')}${zhLine}</div></div></div>`;
        body += meta;
        body += `</div>`;
    }
    if (!shown.length) body = `<div class="or-export-empty">没有选中任何消息。</div>`;

    return `<div class="or-export-chat">
<style>
.or-export-chat{${TOKENS_CSS}background:var(--or-cream);font-family:${FONT_STACK};}
.or-export-chat-title{font-size:15px;font-weight:600;color:var(--or-cocoa);text-align:center;padding:10px 14px;background:var(--or-cream-2);}
.or-export-chat-body{padding:14px;display:flex;flex-direction:column;gap:6px;}
.or-export-chat .or-date-sep{text-align:center;margin:10px 0 4px;}
.or-export-chat .or-date-sep span{background:var(--or-cream-2);color:var(--or-cocoa-light);font-size:11px;padding:3px 12px;border-radius:12px;}
.or-export-chat .or-msg-row{display:flex;flex-direction:column;max-width:100%;--or-avatar-lane:36px;}
.or-export-chat .or-msg-line{display:flex;align-items:flex-start;gap:8px;}
.or-export-chat .or-msg-row.me .or-msg-line{flex-direction:row-reverse;}
.or-export-chat .or-msg-avatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--or-white);font-size:12px;font-weight:600;}
.or-export-chat .or-msg-avatar.hidden{visibility:hidden;}
.or-export-chat .or-msg-col{display:flex;flex-direction:column;max-width:74%;}
.or-export-chat .or-msg-row.me .or-msg-col{align-items:flex-end;margin-left:auto;}
.or-export-chat .or-sender-name{padding-left:var(--or-avatar-lane);font-size:10.5px;color:var(--or-cocoa-light);margin:0 0 2px 2px;}
.or-export-chat .or-bubble{padding:9px 13px;font-size:13.5px;line-height:1.5;color:var(--or-cocoa);word-break:break-word;white-space:pre-wrap;}
.or-export-chat .or-msg-row:not(.me) .or-bubble{background:var(--or-white);border-radius:18px 18px 18px 4px;}
.or-export-chat .or-msg-row.me .or-bubble{background:var(--or-salt);border-radius:18px 18px 4px 18px;}
.or-export-chat .or-msg-meta{display:flex;align-items:center;gap:4px;margin-top:2px;font-size:10.5px;color:var(--or-cocoa-light);padding-left:var(--or-avatar-lane);}
.or-export-chat .or-msg-row.me .or-msg-meta{flex-direction:row-reverse;justify-content:flex-start;padding-left:0;}
.or-export-chat .or-zh{font-size:12px;color:var(--or-cocoa-light);margin-top:3px;line-height:1.5;}
.or-export-chat .or-export-gap{text-align:center;margin:6px 0;font-size:11px;color:var(--or-cocoa-light);}
.or-export-chat .or-export-empty{text-align:center;padding:30px;font-size:13px;color:var(--or-cocoa-light);}
</style>
<div class="or-export-chat-title">${escapeHtml(title)}</div>
<div class="or-export-chat-body">${body}</div>
</div>`;
}

// ── 以下才碰 DOM:vendor 懒加载 + 离屏渲染管线,只在真实浏览器里跑。 ──

let vendorPromise = null;
// 懒加载策略(任务书 §1):①window.modernScreenshot 已存在(她装了 html2canvas-pro 扩展)直接用,
// 不注入自己的副本;②否则注入 vendor 副本,onload 后取全局,10s 超时保护。失败不缓存死——
// 网络抖一下不该让往后每一次导出都直接判死刑,vendorPromise 在失败时清空,下次导出会重新尝试。
function ensureVendor() {
    if (typeof window !== 'undefined' && window.modernScreenshot?.domToPng) {
        return Promise.resolve(window.modernScreenshot);
    }
    if (vendorPromise) return vendorPromise;
    vendorPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('modern-screenshot 加载超时')), 10000);
        const script = document.createElement('script');
        script.src = VENDOR_URL;
        script.onload = () => {
            clearTimeout(timer);
            if (window.modernScreenshot?.domToPng) resolve(window.modernScreenshot);
            else reject(new Error('modern-screenshot 加载后未挂上全局'));
        };
        script.onerror = () => { clearTimeout(timer); reject(new Error('modern-screenshot 脚本加载失败')); };
        document.head.appendChild(script);
    }).catch((err) => { vendorPromise = null; throw err; });
    return vendorPromise;
}

let exporterBusy = false; // 一次只跑一个导出(任务书 §2.1):重入直接 return null,由调用方(shell.js)弹「上一张还在生成」

// 通用管线(任务书 §2.1):建自包含 HTML → 离屏容器(挂 document.body,不进 Shadow DOM)→
// 等两帧布局稳定 → 量高度按护栏决定 scale → domToPng → 容器必须被移除(try/finally,失败也不留孤儿节点)。
async function runExport(buildHtml, bgColor) {
    if (exporterBusy) return null;
    exporterBusy = true;
    let iframe = null;
    try {
        let modernScreenshot;
        try {
            modernScreenshot = await ensureVendor();
        } catch (err) {
            console.error('[Orrery] 导出组件加载失败', err);
            return { ok: false, error: 'vendor_failed' };
        }
        const html = buildHtml();
        iframe = document.createElement('iframe');
        // allow-same-origin 而不给 allow-scripts:contentDocument 要能从主文档够到(截图的前提),
        // 脚本仍然全禁——快照 HTML 已过 sanitizeSnapshotHtml,这里是第二道闸,同 app 内 sandbox iframe 的双闸哲学。
        iframe.setAttribute('sandbox', 'allow-same-origin');
        iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:480px;height:10px;border:0;';
        iframe.srcdoc = `<!doctype html><html><head><style>html,body{margin:0;background:${bgColor};}</style></head><body>${html}</body></html>`;
        document.body.appendChild(iframe);
        await new Promise((resolve) => { iframe.onload = resolve; });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const body = iframe.contentDocument.body;
        const height = body.scrollHeight;
        // iframe 撑到内容全高再截——不撑的话只有可视区那 10px,长图就没了。
        iframe.style.height = height + 'px';
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        let scale = 2;
        if (height * scale > 16000) scale = 1;
        if (height * scale > 16000) return { ok: false, error: 'too_long' }; // 不静默截断,交给调用方提示「少选一些再导」
        const dataUrl = await modernScreenshot.domToPng(body, { scale });
        return { ok: true, dataUrl };
    } catch (err) {
        console.error('[Orrery] 导出出错', err);
        return { ok: false, error: 'render_failed' };
    } finally {
        iframe?.remove();
        exporterBusy = false;
    }
}

/** 网页整页长图。不收 language:zh 大意本就不进图(buildWebExportHtml),用不上的参数不留摆设。 */
export async function exportWebSnapshot({ visit, snapshot, appends }) {
    return runExport(() => buildWebExportHtml({ visit, snapshot, appends }), '#FFFFFF');
}

/** 论坛选楼导出。selectedSeqs 见 buildForumExportHtml 的注释(null=全选)。 */
export async function exportForumThread({ thread, world, selectedSeqs }) {
    return runExport(() => buildForumExportHtml({ thread, world, selectedSeqs }), '#F4EFE4');
}

/** 消息选段导出。selectedSeqs 见 buildMessengerExportHtml 的注释(null=全选)。 */
export async function exportMessengerThread({ thread, world, selectedSeqs }) {
    return runExport(() => buildMessengerExportHtml({ thread, world, selectedSeqs }), '#F4EFE4');
}
