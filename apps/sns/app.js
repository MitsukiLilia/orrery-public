// SNS「Pulsar」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 apps/forum/messenger 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新/生成回复)+ 长按/右键反悔。
// castName 只活在 core/世界数据层,这个文件从不读它——账号条目与住民条目一视同仁,UI 只用 handle/displayName/locked。
import { ICON_BACK, ICON_MINUS, ICON_PLUS, ICON_LOCK, ICON_CAMERA, ICON_REPLY_SM, ICON_RT_SM, ICON_MOON } from '../../ui/icons.js';
import { escapeHtml } from '../../core/escape.js';
import { monogramFor, colorForContact, seenKeyForTweet, newReplyCountOfTweet } from '../../core/world.js';

export const SNS_APP_ID = 'sns';
export const SNS_SKIN_URL = new URL('./skin.css', import.meta.url).href;

function isSameDay(ts1, ts2) {
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 相对时间:x分钟前/x小时前/昨天/M月D日,参照系是 SNS 最新世界时刻(snsNow),照 forum 的 formatRelativeTime 思路抄。
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

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

// [写真:描述] 占位图框(月月拍板:灰色小图框)。⚠️XSS 纪律:先 escapeHtml 整段正文,再对转义后的
// 安全文本做替换——描述已经是转义后的文本,不会二次引入风险。zh 译文行调用同一个函数处理占位符。
function renderBodyHtml(body) {
    const escaped = escapeHtml(body);
    return escaped.replace(/\[写真:([^\]]+)\]/g, (_, desc) =>
        `<span class="or-photo-ph">${ICON_CAMERA}<span class="or-photo-ph-desc">${desc}</span></span>`);
}

// 统计行(v0.7.1 图标化,月月拍板):回复气泡/RT/月相三枚小图标+数字,真推特的图标行形态;
// 月相代 いいね——星星撞 fav 收藏语义,月相是 Pulsar 世界自己的「共感」符号。纯展示,零交互。
function statsHtml(tweet) {
    return `<span class="or-sns-stat">${ICON_REPLY_SM}${tweet.replyCount || 0}</span><span class="or-sns-stat">${ICON_RT_SM}${tweet.retweets || 0}</span><span class="or-sns-stat">${ICON_MOON}${tweet.likes || 0}</span>`;
}

function lockIconHtml(account) {
    return account?.locked ? '<span class="or-sns-lock">' + ICON_LOCK + '</span>' : '';
}

function avatarHtml(account, size) {
    const cls = size === 'lg' ? 'or-sns-avatar lg' : 'or-sns-avatar';
    return `<div class="${cls}" style="background-color:${colorForContact(account?.accountId || '?')}">${escapeHtml(monogramFor(account?.displayName || '?'))}</div>`;
}

// 转发缩略块:原推作者+正文前 60 字;原推已被反悔删除(retweetOf 查无此推)→ 灰字降级文案,不炸。
function renderRetweetBlockHtml(tweet, world) {
    const orig = world.tweets.get(tweet.retweetOf);
    if (!orig || !orig.accountId) {
        return `<div class="or-sns-rt-tag">RT</div><div class="or-sns-rt-quote deleted">元のポストは削除されました</div>`;
    }
    const acc = world.snsAccounts.get(orig.accountId);
    const preview = escapeHtml((orig.body || '').slice(0, 60));
    return `<div class="or-sns-rt-tag">RT</div><div class="or-sns-rt-quote">
        <span class="or-sns-rt-author">${escapeHtml(acc?.displayName || orig.accountId)}</span>
        <span class="or-sns-rt-body">${preview}</span>
    </div>`;
}

/** 推文行解剖(TL/账号主页共用):头像+displayName+@handle+锁icon+相对时间 → body → [转发块] → 底行统计。 */
function renderTweetRowHtml(tweet, world, { snsNow, seen = {}, justUpdated = null, showAuthor = true } = {}) {
    const account = world.snsAccounts.get(tweet.accountId);
    const seenTs = seen[seenKeyForTweet(tweet.tweetId)];
    const neverOpened = seenTs === undefined;
    const newReplies = neverOpened ? 0 : newReplyCountOfTweet(tweet, seenTs);
    const cls = ['or-sns-row', justUpdated?.has(tweet.tweetId) ? 'just-arrived' : ''].filter(Boolean).join(' ');
    const zhLine = tweet.zh && tweet.zh !== tweet.body ? `<div class="or-zh">${renderBodyHtml(tweet.zh)}</div>` : '';
    return `<div class="${cls}" data-action="open-sns-tweet" data-tweet-id="${escapeHtml(tweet.tweetId)}">
        <div class="or-sns-row-tags">${neverOpened ? '<span class="or-sns-new">NEW</span>' : ''}</div>
        <div class="or-sns-row-head">
            ${showAuthor ? `<button class="or-sns-row-avatarname" data-action="open-sns-profile" data-account-id="${escapeHtml(tweet.accountId)}">
                ${avatarHtml(account)}
                <span class="or-sns-row-name">${escapeHtml(account?.displayName || tweet.accountId)}</span>
                ${lockIconHtml(account)}
                <span class="or-sns-row-handle">@${escapeHtml(account?.handle || tweet.accountId)}</span>
            </button>` : ''}
            <span class="or-sns-row-time">${formatRelativeTime(tweet.worldTime, snsNow)}</span>
        </div>
        <div class="or-sns-row-body">${renderBodyHtml(tweet.body)}${zhLine}</div>
        ${tweet.retweetOf ? `<div class="or-sns-rt-block">${renderRetweetBlockHtml(tweet, world)}</div>` : ''}
        <div class="or-sns-row-stats">${statsHtml(tweet)}${newReplies ? `<span class="or-sns-newreply">+${newReplies}</span>` : ''}</div>
    </div>`;
}

/** 身份栏:当前视角账号;ura 存在时可点开切换,不存在时纯展示。 */
function renderIdentityBarHtml(world, viewerRole, identityOpen) {
    const accounts = [...world.snsAccounts.values()];
    const omote = accounts.find(a => a.ownerRole === 'omote');
    const ura = accounts.find(a => a.ownerRole === 'ura');
    if (!omote) return ''; // 还没首次生成,身份栏无东西可展示
    const current = (viewerRole === 'ura' && ura) ? ura : omote;
    const clickable = !!ura;

    const barInner = `${avatarHtml(current)}
        <span class="or-sns-identity-name">${escapeHtml(current.displayName)}${lockIconHtml(current)}</span>
        <span class="or-sns-identity-handle">@${escapeHtml(current.handle)}</span>`;
    const bar = clickable
        ? `<button class="or-sns-identity" data-action="sns-identity-toggle">${barInner}</button>`
        : `<div class="or-sns-identity static">${barInner}</div>`;

    let menu = '';
    if (clickable && identityOpen) {
        menu = `<div class="or-sns-identity-menu">${[omote, ura].map(a => `
            <button class="or-sns-identity-option ${a.accountId === current.accountId ? 'on' : ''}" data-action="sns-select-viewer" data-role="${a.ownerRole}">
                ${avatarHtml(a)}
                <span class="or-sns-identity-name">${escapeHtml(a.displayName)}</span>
                <span class="or-sns-identity-handle">@${escapeHtml(a.handle)}</span>
                ${lockIconHtml(a)}
            </button>`).join('')}</div>`;
    }
    return `<div class="or-sns-identity-wrap">${bar}${menu}</div>`;
}

/**
 * TL(首屏):header + 身份栏 + 推文流(表垢视角=所有非 ura 账号的推;ura 视角=仅 ura 自己的推)。
 * @param seen 「我看过了」水位表:没记录=NEW,有记录比回复数(同论坛列表页语义)
 * @param justUpdated 刚这一次刷新里新增/被盖楼的 tweetId 集合——只用来播一次入场动效
 */
export function renderSnsTlHtml({ world, busy, viewerRole = 'omote', identityOpen = false, seen = {}, justUpdated = null }) {
    const ura = [...world.snsAccounts.values()].find(a => a.ownerRole === 'ura');
    const effectiveRole = (viewerRole === 'ura' && ura) ? 'ura' : 'omote';
    const tweets = [...world.tweets.values()]
        .filter(t => t.accountId)
        .filter(t => effectiveRole === 'ura' ? t.accountId === ura.accountId : t.accountId !== ura?.accountId)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));

    const body = tweets.length
        ? `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow: world.snsNow, seen, justUpdated })).join('')}</div>`
        : `<div class="or-empty">Pulsar 上还静悄悄。点「刷新」,听听这个世界在说什么。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">Pulsar</span>
            <button class="or-pill-btn small" data-action="sns-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${renderIdentityBarHtml(world, viewerRole, identityOpen)}
        ${body}`;
}

/**
 * 推文详情:原推大块 → 分界线(seenAt 快照,照论坛帖内工法)→ 回复平铺 → 底部 stepper + 生成回复药丸。
 * @param seenAt 进这条推那一刻的 seen 快照
 * @param replyBatch 「生成回复」这一次要点单几条
 */
export function renderSnsTweetHtml({ tweet, world, busy, snsNow, seenAt = 0, replyBatch = 3 }) {
    const account = world.snsAccounts.get(tweet.accountId);
    const zhLine = tweet.zh && tweet.zh !== tweet.body ? `<div class="or-zh">${renderBodyHtml(tweet.zh)}</div>` : '';

    let repliesHtml = '';
    let sepDone = false;
    tweet.replies.forEach((r) => {
        if (!sepDone && seenAt > 0 && r.ts > seenAt) {
            repliesHtml += `<div class="or-new-sep" data-new-anchor><span>以下是新回复</span></div>`;
            sepDone = true;
        }
        const rAccount = world.snsAccounts.get(r.accountId);
        const rZh = r.zh && r.zh !== r.body ? `<div class="or-zh">${renderBodyHtml(r.zh)}</div>` : '';
        repliesHtml += `<div class="or-sns-reply-row" data-ts="${r.ts}">
            <div class="or-sns-reply-head">
                <button class="or-sns-row-avatarname" data-action="open-sns-profile" data-account-id="${escapeHtml(r.accountId)}">
                    ${avatarHtml(rAccount)}
                    <span class="or-sns-row-name">${escapeHtml(rAccount?.displayName || r.accountId)}</span>
                    ${lockIconHtml(rAccount)}
                    <span class="or-sns-row-handle">@${escapeHtml(rAccount?.handle || r.accountId)}</span>
                </button>
                <span class="or-sns-row-time">${formatRelativeTime(r.worldTime, snsNow)}</span>
            </div>
            <div class="or-sns-row-body">${renderBodyHtml(r.body)}${rZh}</div>
        </div>`;
    });
    if (!tweet.replies.length) repliesHtml = `<div class="or-empty">还没有人回复。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">推文</span>
        </div>
        <div class="or-sns-scroll">
            <div class="or-sns-op">
                <button class="or-sns-row-avatarname" data-action="open-sns-profile" data-account-id="${escapeHtml(tweet.accountId)}">
                    ${avatarHtml(account)}
                    <span class="or-sns-row-name">${escapeHtml(account?.displayName || tweet.accountId)}</span>
                    ${lockIconHtml(account)}
                    <span class="or-sns-row-handle">@${escapeHtml(account?.handle || tweet.accountId)}</span>
                </button>
                <div class="or-sns-op-time">${formatRelativeTime(tweet.worldTime, snsNow)}</div>
                <div class="or-sns-op-body">${renderBodyHtml(tweet.body)}${zhLine}</div>
                ${tweet.retweetOf ? `<div class="or-sns-rt-block">${renderRetweetBlockHtml(tweet, world)}</div>` : ''}
                <div class="or-sns-row-stats">${statsHtml(tweet)}</div>
            </div>
            <div class="or-sns-replies">${repliesHtml}</div>
        </div>
        <div class="or-chat-footer">
            <div class="or-batch">
                <button data-action="stepper" data-field="snsReplyBatch" data-delta="-1" ${busy ? 'disabled' : ''}>${ICON_MINUS}</button>
                <span class="or-batch-value">${replyBatch}</span>
                <button data-action="stepper" data-field="snsReplyBatch" data-delta="1" ${busy ? 'disabled' : ''}>${ICON_PLUS}</button>
            </div>
            <button class="or-pill-btn" data-action="sns-generate-more" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '生成回复'}</button>
        </div>`;
}

/** 账号主页:大头像+displayName+@handle+锁icon+bio → 该账号推文流(含转发,行解剖同 TL)。 */
export function renderSnsProfileHtml({ account, world, snsNow, seen = {} }) {
    const tweets = [...world.tweets.values()]
        .filter(t => t.accountId === account.accountId)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));

    const body = tweets.length
        ? `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow, seen, showAuthor: false })).join('')}</div>`
        : `<div class="or-empty">这个账号还没有发过什么。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(account.displayName)}</span>
        </div>
        <div class="or-sns-profile-head">
            ${avatarHtml(account, 'lg')}
            <div class="or-sns-profile-name">${escapeHtml(account.displayName)}${lockIconHtml(account)}</div>
            <div class="or-sns-profile-handle">@${escapeHtml(account.handle)}</div>
            ${account.bio ? `<div class="or-sns-profile-bio">${escapeHtml(account.bio)}</div>` : ''}
        </div>
        ${body}`;
}
