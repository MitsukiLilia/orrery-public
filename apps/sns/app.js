// SNS「Pulsar」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 apps/forum/messenger 的模式)。
// 用户只读:零输入框,唯二操作走 shell 的 data-action(刷新/生成回复)+ 长按/右键反悔。
// castName 只活在 core/世界数据层,这个文件从不读它——账号条目与住民条目一视同仁,UI 只用 handle/displayName/locked。
import { ICON_BACK, ICON_MINUS, ICON_PLUS, ICON_LOCK, ICON_CAMERA, ICON_REPLY_SM, ICON_RT_SM, ICON_MOON, ICON_STAR, ICON_STAR_FILL, ICON_SEARCH_SM, ICON_OFFICIAL_BADGE } from '../../ui/icons.js';
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

// M6 公式账号徽标(任务书-M6 §4):bio 下方不加任何文字,只在 displayName 旁挂一枚小徽标。
function officialBadgeHtml(account) {
    return account?.official ? '<span class="or-sns-official" title="公式アカウント">' + ICON_OFFICIAL_BADGE + '</span>' : '';
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
                ${lockIconHtml(account)}${officialBadgeHtml(account)}
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
 * M6 关注分层(任务书-M6 §4):TL header 下的双 tab——フォロー中(封闭小世界的内部黑话与鸡毛蒜皮)
 * / おすすめ(外面的花花世界)。横向撑满,视觉语言沿用 or-sns-role-seg 的配色但改胶囊为通栏。
 */
function tlModeTabsHtml(tlMode) {
    return `<div class="or-sns-tlmode">
        <button class="${tlMode !== 'recommend' ? 'on' : ''}" data-action="sns-tl-mode" data-mode="following">フォロー中</button>
        <button class="${tlMode === 'recommend' ? 'on' : ''}" data-action="sns-tl-mode" data-mode="recommend">おすすめ</button>
    </div>`;
}

/**
 * TL(首屏):header + フォロー中/おすすめ 双 tab + 推文流 + 底导(任务书-M6 §1.2/§4)。
 * @param seen 「我看过了」水位表:没记录=NEW,有记录比回复数(同论坛列表页语义)
 * @param starred Asterism 星图表:点亮状态渲染实心星
 * @param justUpdated 刚这一次刷新里新增/被盖楼的 tweetId 集合——只用来播一次入场动效
 * @param myRole 当前视角(表/裏,与「我的」页共用同一 nav 帧字段)——决定「フォロー中」算谁的关注表
 * @param tlMode 'following'|'recommend',默认值由 shell 按「该视角关注表是否为空」算好再传进来
 */
export function renderSnsTlHtml({ world, busy, seen = {}, starred = {}, justUpdated = null, myRole = 'omote', tlMode = 'following' }) {
    const ura = [...world.snsAccounts.values()].find(a => a.ownerRole === 'ura');
    const omote = [...world.snsAccounts.values()].find(a => a.ownerRole === 'omote');
    const myAccount = myRole === 'ura' ? (ura || omote) : omote;
    const followSet = world.follows?.[myRole] || new Set();

    let tweets;
    if (tlMode === 'recommend') {
        // おすすめ = 现有 TL 语义(排除裏垢的推、排除搜索翻出来的旧推)再减去当前视角已关注的账号。
        tweets = [...world.tweets.values()]
            .filter(t => t.accountId)
            .filter(t => t.accountId !== ura?.accountId) // 锁着的号不进推荐
            .filter(t => t.accountId !== omote?.accountId) // 主人自己的推也不进推荐(真实平台不会把你自己推给你)
            .filter(t => !t.fromSearch)
            .filter(t => !followSet.has(t.accountId))
            .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));
    } else {
        // フォロー中 = 已关注的账号发的推 + 当前视角自己账号的推。
        tweets = [...world.tweets.values()]
            .filter(t => t.accountId)
            .filter(t => followSet.has(t.accountId) || t.accountId === myAccount?.accountId)
            .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));
    }

    const emptyText = tlMode === 'recommend'
        ? 'おすすめ静悄悄。点「刷新」。'
        : 'フォロー中还没有动静。去「おすすめ」看看,或点「刷新」。';
    const body = tweets.length
        ? `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow: world.snsNow, seen, starred, justUpdated })).join('')}</div>`
        : `<div class="or-empty">${emptyText}</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">Pulsar</span>
            <button class="or-iconbtn" data-action="sns-search-open" title="搜索">${ICON_SEARCH_SM}</button>
            <button class="or-pill-btn small" data-action="sns-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${tlModeTabsHtml(tlMode)}
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
    // M6 §4:「フォロー N」——点开进纯本地的关注列表页,role 直接固定成当前这个账号的所属(表/裏各算各的)。
    const followCount = world.follows?.[current.ownerRole]?.size || 0;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">我的</span>
            ${roleSeg}
        </div>
        ${bannerHtml(current)}
        <div class="or-sns-profile-head with-banner">
            ${avatarHtml(current, 'lg')}
            <div class="or-sns-profile-name">${escapeHtml(current.displayName)}${lockIconHtml(current)}${officialBadgeHtml(current)}</div>
            <div class="or-sns-profile-handle">@${escapeHtml(current.handle)}</div>
            ${current.bio ? `<div class="or-sns-profile-bio">${escapeHtml(current.bio)}</div>` : ''}
            <button class="or-sns-follow-count" data-action="open-sns-follow-list" data-role="${escapeHtml(current.ownerRole)}">フォロー ${followCount}</button>
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
                    ${lockIconHtml(rAccount)}${officialBadgeHtml(rAccount)}
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
                    ${lockIconHtml(account)}${officialBadgeHtml(account)}
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

/**
 * 账号主页:大头像+displayName+@handle+锁icon+official徽标+bio → 该账号推文流(含转发,行解剖同 TL)。
 * @param myRole 当前观测者视角(表/裏)——只用来算「フォロー中」小标签,不做按钮(观测者零输入,任务书-M6 §4)。
 */
export function renderSnsProfileHtml({ account, world, snsNow, seen = {}, starred = {}, myRole = 'omote' }) {
    const tweets = [...world.tweets.values()]
        .filter(t => t.accountId === account.accountId)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));

    const body = tweets.length
        ? `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow, seen, starred, showAuthor: false })).join('')}</div>`
        : `<div class="or-empty">这个账号还没有发过什么。</div>`;
    const followed = !!world.follows?.[myRole]?.has(account.accountId);

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">${escapeHtml(account.displayName)}</span>
        </div>
        ${bannerHtml(account)}
        <div class="or-sns-profile-head with-banner">
            ${avatarHtml(account, 'lg')}
            <div class="or-sns-profile-name">${escapeHtml(account.displayName)}${lockIconHtml(account)}${officialBadgeHtml(account)}</div>
            <div class="or-sns-profile-handle">@${escapeHtml(account.handle)}</div>
            ${followed ? `<span class="or-sns-followed-tag">フォロー中</span>` : ''}
            ${account.bio ? `<div class="or-sns-profile-bio">${escapeHtml(account.bio)}</div>` : ''}
        </div>
        ${body}`;
}

/**
 * 关注列表页(任务书-M6 §4):纯本地渲染,行=头像色块+displayName+@handle,点行进该账号主页
 * (复用现有 open-sns-profile 路由)。role 由入口按钮固定传入——裏垢视角进来的就是裏垢的关注表。
 */
export function renderSnsFollowListHtml({ world, role = 'omote' }) {
    const ids = [...(world.follows?.[role] || [])];
    const accounts = ids.map(id => world.snsAccounts.get(id)).filter(Boolean);
    const body = accounts.length
        ? `<div class="or-sns-list">${accounts.map(a => `
            <button class="or-sns-follow-row" data-action="open-sns-profile" data-account-id="${escapeHtml(a.accountId)}">
                ${avatarHtml(a)}
                <div class="or-sns-follow-row-text">
                    <span class="or-sns-follow-row-name">${escapeHtml(a.displayName)}${lockIconHtml(a)}${officialBadgeHtml(a)}</span>
                    <span class="or-sns-follow-row-handle">@${escapeHtml(a.handle)}</span>
                </div>
            </button>`).join('')}</div>`
        : `<div class="or-empty">还没有关注任何人。</div>`;

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">フォロー中</span>
        </div>
        ${body}`;
}

/**
 * 搜索页(task-007 她的翻转「猜你(char)想搜索」):搜索框是只读装饰,词条是主人此刻会搜的词
 * (随每批主生成更新,搭便车零调用)——观测者只点选看哪一条,与「继续围观」同构,零输入铁律无伤。
 */
export function renderSnsSearchHtml({ world }) {
    const words = (world.snsSuggest?.words || []).filter(Boolean);
    const list = words.length
        ? `<div class="or-sns-suggest-list">
            <div class="or-sns-suggest-cap">TA 可能在搜</div>
            ${words.map(w => `<button class="or-sns-suggest-row" data-action="sns-search-word" data-word="${escapeHtml(w)}">${ICON_SEARCH_SM}<span>${escapeHtml(w)}</span></button>`).join('')}
        </div>`
        : `<div class="or-empty">搜索联想还没长出来。<br>回时间线刷新一批——主人在想什么,这里就会出现什么。</div>`;
    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">搜索</span>
        </div>
        <div class="or-sns-searchbox">${ICON_SEARCH_SM}<span class="or-sns-searchbox-ph">検索</span></div>
        ${list}`;
}

/** 搜索结果页:该词下的推文(fromSearch 标记,一次生成永久缓存);行解剖同 TL,点开/收藏/回复全通。 */
export function renderSnsSearchResultHtml({ word, world, busy, seen = {}, starred = {}, snsNow }) {
    const tweets = [...world.tweets.values()]
        .filter(t => t.accountId && t.fromSearch === word)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0));
    let body;
    if (tweets.length) {
        body = `<div class="or-sns-list">${tweets.map(t => renderTweetRowHtml(t, world, { snsNow, seen, starred })).join('')}</div>`;
    } else if (busy) {
        body = `<div class="or-empty">${genSpinnerHtml()}<br>正在接收「${escapeHtml(word)}」的信号…</div>`;
    } else {
        body = `<div class="or-empty">信号中断了。<br><button class="or-pill-btn" data-action="sns-search-word" data-word="${escapeHtml(word)}">再试一次</button></div>`;
    }
    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">「${escapeHtml(word)}」</span>
        </div>
        ${body}`;
}
