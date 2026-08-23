// SNS「Pulsar」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 apps/forum/messenger 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新/生成回复)+ 长按/右键反悔。
// castName 只活在 core/世界数据层,这个文件从不读它——账号条目与住民条目一视同仁,UI 只用 handle/displayName/locked。
import { ICON_BACK, ICON_MINUS, ICON_PLUS, ICON_LOCK, ICON_CAMERA, ICON_REPLY_SM, ICON_RT_SM, ICON_MOON, ICON_STAR, ICON_STAR_FILL } from '../../ui/icons.js';
import { escapeHtml } from '../../core/escape.js';
import { monogramFor, colorForContact, seenKeyForTweet, newReplyCountOfTweet, starKeyForTweet } from '../../core/world.js';

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

// Asterism 星标(task-007 P0):观测者的收藏,点亮/熄灭走 shell 的 toggle-star;
// 与月相(世界内いいね)并排但互不相干——月相属于世界,星星属于观测者。
function starBtnHtml(tweetId, starred) {
    const key = starKeyForTweet(tweetId);
    const on = !!starred[key];
    return `<button class="or-star ${on ? 'on' : ''}" data-action="toggle-star" data-star-key="${escapeHtml(key)}" title="${on ? '从星图移除' : '加入星图'}">${on ? ICON_STAR_FILL : ICON_STAR}</button>`;
}

// 版头 banner(task-007 她点单「像推特那样的版头」):纯前端派生零 token——底色=头像同源色,
// 星点按 accountId 哈希撒(同一账号永远同一片星空;无渐变纪律:纯色底+SVG 星点)。
function bannerHtml(account) {
    const id = String(account?.accountId || '?');
    let seed = 2166136261;
    for (let i = 0; i < id.length; i++) { seed ^= id.charCodeAt(i); seed = Math.imul(seed, 16777619); }
    const rnd = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822519); seed = Math.imul(seed ^ (seed >>> 13), 3266489917); return ((seed ^= seed >>> 16) >>> 0) / 4294967296; };
    let specks = '';
    for (let i = 0; i < 18; i++) {
        const x = (rnd() * 100).toFixed(1), y = (rnd() * 40).toFixed(1);
        const r = (0.5 + rnd() * 0.9).toFixed(2), o = (0.25 + rnd() * 0.45).toFixed(2);
        specks += `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" opacity="${o}"/>`;
    }
    return `<div class="or-sns-banner" style="background-color:${colorForContact(id)}"><svg viewBox="0 0 100 40" preserveAspectRatio="none">${specks}</svg></div>`;
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
function renderTweetRowHtml(tweet, world, { snsNow, seen = {}, starred = {}, justUpdated = null, showAuthor = true } = {}) {
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
        <div class="or-sns-row-stats">${statsHtml(tweet)}${newReplies ? `<span class="or-sns-newreply">+${newReplies}</span>` : ''}${starBtnHtml(tweet.tweetId, starred)}</div>
    </div>`;
}

/**
 * 底部导航(task-007 她点单):时间线/我的 两 tab——真推特的骨架。TL=表账号能刷到的面;
 * 「我的」=主人的主页,表/裏切换住在那边(裏垢入口从 TL 顶栏迁走,切过去=锁着的号的主页展开)。
 */
function tabbarHtml(tab) {
    return `<div class="or-sns-tabbar">
        <button class="${tab !== 'me' ? 'on' : ''}" data-action="sns-tab" data-tab="tl">时间线</button>
        <button class="${tab === 'me' ? 'on' : ''}" data-action="sns-tab" data-tab="me">我的</button>
    </div>`;
}

/**
 * TL(首屏):header + 推文流(表账号能刷到的面=所有非 ura 账号的推)+ 底导。
 * @param seen 「我看过了」水位表:没记录=NEW,有记录比回复数(同论坛列表页语义)
 * @param starred Asterism 星图表:点亮状态渲染实心星
 * @param justUpdated 刚这一次刷新里新增/被盖楼的 tweetId 集合——只用来播一次入场动效
 */
export function renderSnsTlHtml({ world, busy, seen = {}, starred = {}, justUpdated = null }) {
    const ura = [...world.snsAccounts.values()].find(a => a.ownerRole === 'ura');
    const tweets = [...world.tweets.values()]
        .filter(t => t.accountId)
        .filter(t => t.accountId !== ura?.accountId)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));

    const body = tweets.length
        ? `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow: world.snsNow, seen, starred, justUpdated })).join('')}</div>`
        : `<div class="or-empty">Pulsar 上还静悄悄。点「刷新」,听听这个世界在说什么。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">Pulsar</span>
            <button class="or-pill-btn small" data-action="sns-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${body}
        ${tabbarHtml('tl')}`;
}

/**
 * 「我的」(task-007):主人的主页——版头+头像+bio+表/裏切换(有裏垢才出现)+该账号自己的推文流。
 * 裏垢不再从 TL 顶栏切:切到裏,是「锁着的那个号的主页」在你面前展开。
 */
export function renderSnsMyPageHtml({ world, busy, myRole = 'omote', seen = {}, starred = {}, snsNow }) {
    const accounts = [...world.snsAccounts.values()];
    const omote = accounts.find(a => a.ownerRole === 'omote');
    const ura = accounts.find(a => a.ownerRole === 'ura');
    if (!omote) {
        return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">Pulsar</span>
        </div>
        <div class="or-empty">主人的账号还没有诞生。回时间线点「刷新」。</div>
        ${tabbarHtml('me')}`;
    }
    const current = (myRole === 'ura' && ura) ? ura : omote;
    const roleSeg = ura ? `<div class="or-sns-role-seg">
        <button class="${current.accountId === omote.accountId ? 'on' : ''}" data-action="sns-select-viewer" data-role="omote">表</button>
        <button class="${current.accountId === ura.accountId ? 'on' : ''}" data-action="sns-select-viewer" data-role="ura">裏</button>
    </div>` : '';
    const tweets = [...world.tweets.values()]
        .filter(t => t.accountId === current.accountId)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));
    const body = tweets.length
        ? `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow, seen, starred, showAuthor: false })).join('')}</div>`
        : `<div class="or-empty">这个账号还没有发过什么。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">我的</span>
            ${roleSeg}
        </div>
        ${bannerHtml(current)}
        <div class="or-sns-profile-head with-banner">
            ${avatarHtml(current, 'lg')}
            <div class="or-sns-profile-name">${escapeHtml(current.displayName)}${lockIconHtml(current)}</div>
            <div class="or-sns-profile-handle">@${escapeHtml(current.handle)}</div>
            ${current.bio ? `<div class="or-sns-profile-bio">${escapeHtml(current.bio)}</div>` : ''}
        </div>
        ${body}
        ${tabbarHtml('me')}`;
}

/**
 * 推文详情:原推大块 → 分界线(seenAt 快照,照论坛帖内工法)→ 回复平铺 → 底部 stepper + 生成回复药丸。
 * @param seenAt 进这条推那一刻的 seen 快照
 * @param replyBatch 「生成回复」这一次要点单几条
 */
export function renderSnsTweetHtml({ tweet, world, busy, snsNow, seenAt = 0, starred = {}, replyBatch = 3 }) {
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
                <div class="or-sns-row-stats">${statsHtml(tweet)}${starBtnHtml(tweet.tweetId, starred)}</div>
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
export function renderSnsProfileHtml({ account, world, snsNow, seen = {}, starred = {} }) {
    const tweets = [...world.tweets.values()]
        .filter(t => t.accountId === account.accountId)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));

    const body = tweets.length
        ? `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow, seen, starred, showAuthor: false })).join('')}</div>`
        : `<div class="or-empty">这个账号还没有发过什么。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(account.displayName)}</span>
        </div>
        ${bannerHtml(account)}
        <div class="or-sns-profile-head with-banner">
            ${avatarHtml(account, 'lg')}
            <div class="or-sns-profile-name">${escapeHtml(account.displayName)}${lockIconHtml(account)}</div>
            <div class="or-sns-profile-handle">@${escapeHtml(account.handle)}</div>
            ${account.bio ? `<div class="or-sns-profile-bio">${escapeHtml(account.bio)}</div>` : ''}
        </div>
        ${body}`;
}
