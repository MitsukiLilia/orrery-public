// 手机壳:开合、状态栏、app 网格、返回导航。持有 ctx,是 core/* 与 apps/* 之间唯一的装配点——
// 事件委托只挂一份在 .or-root 上,不随每次重渲染叠加监听器。
import {
    computeWorldKey, foldWorld,
    seenKeyForThread, seenKeyForForumThread, seenKeyForTweet, seenKeyForBrowser,
    seenKeyForGallery, seenKeyForMemo,
    latestTsOfThread, latestTsOfForumThread, latestTsOfTweet, latestTsOfBrowser,
    latestTsOfGallery, latestTsOfMemo,
    hasUnseenInApp, seenBaselinePairs,
} from '../core/world.js';
import * as store from '../core/store.js';
import * as generator from '../core/generator.js';
import {
    generateMore, continueThread, generateMoreForum, continueForumThread,
    generateMoreSns, continueTweetReplies, generateMoreBrowser,
    generateMoreGallery, generateMoreMemo,
} from '../core/generator.js';
import { manualRevert } from '../core/rollback.js';
import { escapeHtml } from '../core/escape.js';
import {
    ICON_BACK, ICON_CHEVRON_RIGHT, ICON_CHECK, ICON_MINUS, ICON_PLUS, ICON_CLOSE,
    ICON_APP_MESSENGER, ICON_APP_SETTINGS, ICON_APP_FORUM, ICON_APP_MEMO, ICON_APP_SNS, ICON_APP_GALLERY,
    ICON_APP_BROWSER,
    ICON_HUD_STARS, ICON_HUD_RING, ICON_STAR, ICON_STAR_FILL, dotPatternDataUri, scallopWaveDataUri,
} from './icons.js';
import { renderThreadListHtml, renderThreadHtml, MESSENGER_SKIN_URL } from '../apps/messenger/app.js';
import { renderForumListHtml, renderForumThreadHtml, FORUM_SKIN_URL } from '../apps/forum/app.js';
import { renderSnsTlHtml, renderSnsTweetHtml, renderSnsProfileHtml, renderSnsMyPageHtml, SNS_SKIN_URL } from '../apps/sns/app.js';
import { renderBrowserHtml, BROWSER_SKIN_URL } from '../apps/browser/app.js';
import { renderGalleryListHtml, renderGalleryPhotoHtml, GALLERY_SKIN_URL } from '../apps/gallery/app.js';
import { renderMemoListHtml, renderMemoNoteHtml, MEMO_SKIN_URL } from '../apps/memo/app.js';

const SHELL_CSS_URL = new URL('./shell.css', import.meta.url).href;

const DEFAULT_SETTINGS = {
    // floorWindow: 0 = 整本聊天(2026-08-13 她拍板的默认)。见 generator.js buildFloorContextText 的长注:
    // 酒馆每轮本来就发整本,旧楼层由预设自己的正则按 depth 压成摘要;orrery 只喂尾部一窗时,
    // 那一窗全落在「近消息」档、摘要恰好全被删光,于是永远只能凭最新几层反推关系 → OOC。
    floorWindow: 0, profileId: null, summaryThreshold: 40,
    // language: ja(全日语,默认)/en(全英文)/ja_zh(日语原文+中文翻译)。2026-08-21 月月拍板改版,旧 zh 档退役——
    // 「中文+日系翻译腔」与整本日文浓度极高的正文互相拉扯,混杂漂移是结构性的;全日语才是最稳的档。
    autoRefresh: false, theme: 'seasalt', showFab: true, allowUserContact: false, language: 'ja', excludeTags: '',
    // 帖内/线程内/推文详情「生成」的点单条数(列表页的「刷新」不受此约束,那是世界自己起涟漪,该冷场就冷场)
    threadReplyBatch: 3, forumReplyBatch: 3, snsReplyBatch: 3,
    customApi: { enabled: false, baseUrl: '', apiKey: '', model: '' },
};

// M4:备忘录 + 相册开通,7 个 app 全亮(网格 3+3+1)。
const APPS = [
    { id: 'messenger', label: '消息', bg: 'salt', icon: ICON_APP_MESSENGER, enabled: true },
    { id: 'settings', label: '设置', bg: 'cocoa', icon: ICON_APP_SETTINGS, enabled: true },
    { id: 'forum', label: '论坛', bg: 'cream', icon: ICON_APP_FORUM, enabled: true },
    { id: 'memo', label: '备忘录', bg: 'salt', icon: ICON_APP_MEMO, enabled: true },
    { id: 'sns', label: 'SNS', bg: 'cream', icon: ICON_APP_SNS, enabled: true },
    { id: 'gallery', label: '相册', bg: 'cocoa', icon: ICON_APP_GALLERY, enabled: true },
    { id: 'browser', label: '浏览器', bg: 'salt', icon: ICON_APP_BROWSER, enabled: true },
];

// escapeHtml 收编进 core/escape.js(带引号转义的安全版,六个 app 共用,注释见彼处)。

// 手机主人=世界的锚点,一经设定不可更改(她 2026-08-11 拍板:唯一不可改的设置)。
// 多人卡({{char}}=世界观名)时,余波视角必须锚在一个具体人物身上,这里就是锚。
function renderSetupHtml(defaultName) {
    return `
        <div class="or-setup">
            <div class="or-setup-badge">${ICON_APP_MESSENGER}</div>
            <div class="or-setup-title">这部手机属于谁?</div>
            <div class="or-setup-note">单人卡填角色名;世界观卡(多人)填你想围观的那个人。<br>联系人、聊天、一切余波,都将从这个人的视角长出来。</div>
            <div class="or-field or-setup-field"><label>主人的名字</label><input type="text" data-setup-name value="${escapeHtml(defaultName)}" spellcheck="false"></div>
            <button class="or-pill-btn" data-action="confirm-setup">就是这个人</button>
            <div class="or-setup-warn">一经设定不可更改。想换人,只能在设置里抹掉这部手机、一切重来。</div>
        </div>`;
}

// 生图图标(assets/icons/<theme>/<id>.png,已裁边);加载失败时 onerror 自摘,露出底下的 SVG 保底
function iconAssetUrl(theme, id) {
    return new URL(`../assets/icons/${theme}/${id}.png`, import.meta.url).href;
}

// dots:{ messenger: bool, forum: bool } —— 每个 app 各看各的水位(M1 水位重构后不再共用一份 pending)。
function renderGridHtml(dots, theme) {
    return `<div class="or-grid">${APPS.map(a => `
        <button class="or-app ${a.enabled ? '' : 'disabled'}" data-action="open-app" data-app="${a.id}" data-bg="${a.bg}">
            <div class="or-app-icon">${a.icon}<img class="or-app-img" src="${iconAssetUrl(theme, a.id)}" alt="" onerror="this.remove()"></div>${dots[a.id] ? '<span class="or-app-badge"></span>' : ''}
            <span class="or-app-label">${a.label}</span>
        </button>`).join('')}</div>`;
}

function renderSettingsHtml(s, profileLabel, owner) {
    return `
        <div class="or-header"><button class="or-back-btn" data-action="back">${ICON_BACK}</button><span class="or-header-title">设置</span></div>
        <div class="or-list">
            <div class="or-row">
                <span class="or-row-label">这部手机属于</span>
                <span class="or-row-value">${escapeHtml(owner || '未设定')}</span>
            </div>
            <div class="or-row">
                <span class="or-row-label">主题</span>
                <div class="or-theme-seg">
                    <button class="${s.theme === 'seasalt' ? 'on' : ''}" data-action="set-theme" data-theme="seasalt">海盐巧克力</button>
                    <button class="${s.theme === 'mono' ? 'on' : ''}" data-action="set-theme" data-theme="mono">墨白</button>
                    <button class="${s.theme === 'lunar' ? 'on' : ''}" data-action="set-theme" data-theme="lunar">月夜</button>
                    <button class="${s.theme === 'magic' ? 'on' : ''}" data-action="set-theme" data-theme="magic">魔導書</button>
                </div>
            </div>
            <div class="or-row">
                <span class="or-row-label">语言</span>
                <div class="or-theme-seg">
                    <button class="${s.language !== 'ja_zh' && s.language !== 'en' ? 'on' : ''}" data-action="set-language" data-language="ja">日本語</button>
                    <button class="${s.language === 'en' ? 'on' : ''}" data-action="set-language" data-language="en">English</button>
                    <button class="${s.language === 'ja_zh' ? 'on' : ''}" data-action="set-language" data-language="ja_zh">日中双语</button>
                </div>
            </div>
            <div class="or-row">
                <span class="or-row-label">正文范围(${s.floorWindow ? `近 ${s.floorWindow * 2} 层` : '整本聊天'})</span>
                <div class="or-stepper">
                    <button data-action="stepper" data-field="floorWindow" data-delta="-1">${ICON_MINUS}</button>
                    <span class="or-stepper-value">${s.floorWindow || '全'}</span>
                    <button data-action="stepper" data-field="floorWindow" data-delta="1">${ICON_PLUS}</button>
                </div>
            </div>
            <div class="or-row">
                <span class="or-row-label">总结阈值(${s.summaryThreshold} 条)</span>
                <div class="or-stepper">
                    <button data-action="stepper" data-field="summaryThreshold" data-delta="-5">${ICON_MINUS}</button>
                    <span class="or-stepper-value">${s.summaryThreshold}</span>
                    <button data-action="stepper" data-field="summaryThreshold" data-delta="5">${ICON_PLUS}</button>
                </div>
            </div>
            <div class="or-row with-note">
                <div class="or-row-main">
                    <span class="or-row-label">悬浮球入口</span>
                    <button class="or-switch ${s.showFab !== false ? 'on' : ''}" data-action="toggle-field" data-field="showFab"></button>
                </div>
                <div class="or-row-note">酒馆界面右侧的 Orrery 悬浮球,可上下拖动;关掉后走魔杖菜单进入。</div>
            </div>
            <div class="or-row with-note">
                <div class="or-row-main">
                    <span class="or-row-label">允许「叙事另一方」登场</span>
                    <button class="or-switch ${s.allowUserContact ? 'on' : ''}" data-action="toggle-field" data-field="allowUserContact"></button>
                </div>
                <div class="or-row-note">默认拦下 user 侧越界混入通讯录/群聊/论坛小号。剧情里两人真正相识、交换过联系方式之后再打开。</div>
            </div>
            <div class="or-row with-note">
                <div class="or-row-main">
                    <span class="or-row-label">楼层更新后自动刷新</span>
                    <button class="or-switch ${s.autoRefresh ? 'on' : ''}" data-action="toggle-field" data-field="autoRefresh"></button>
                </div>
                <div class="or-row-note">开 = 酒馆出新楼层就自动生成一批余波;关 = 只亮红点,由你手动刷新。</div>
            </div>
            <button class="or-row or-row-nav" data-action="open-profile-picker">
                <span class="or-row-label" style="flex:1">生成模型</span>
                <span class="or-row-value">${escapeHtml(profileLabel)}</span>
                ${ICON_CHEVRON_RIGHT}
            </button>
            <div class="or-section-title">正文提纯</div>
            <div class="or-row-note">默认完全跟随酒馆:预设的正则(进提示词那档)与思维链设置删什么,这里就删什么。若你的预设还会输出草稿/摘要/后记等区块且没写对应正则,把标签名填在下面,整块连内容一起剔除。</div>
            <div class="or-field"><label>额外剔除的标签(逗号分隔,留空=跟随酒馆)</label><input type="text" data-field-text="excludeTags" value="${escapeHtml(s.excludeTags || '')}" placeholder="draft, abstract, afterword" spellcheck="false"></div>
            <div class="or-section-title">独立 API(启用后优先于上面的生成模型;配置存在酒馆本地)</div>
            <div class="or-row">
                <span class="or-row-label">启用独立 API</span>
                <button class="or-switch ${s.customApi.enabled ? 'on' : ''}" data-action="toggle-capi"></button>
            </div>
            <div class="or-field"><label>Base URL</label><input type="text" data-capi="baseUrl" value="${escapeHtml(s.customApi.baseUrl)}" placeholder="https://…/v1" spellcheck="false"></div>
            <div class="or-field"><label>API Key</label><input type="password" data-capi="apiKey" value="${escapeHtml(s.customApi.apiKey)}"></div>
            <div class="or-field"><label>模型名</label><input type="text" data-capi="model" value="${escapeHtml(s.customApi.model)}" placeholder="例:gemini-2.5-flash" spellcheck="false"></div>
            <button class="or-row or-danger" data-action="wipe-phone"><span class="or-row-label">抹掉这部手机</span></button>
        </div>`;
}

function renderProfilePickerHtml(profiles, currentProfileId) {
    const rows = [{ id: '', label: '跟随酒馆当前连接' }, ...profiles.map(p => ({ id: p.id, label: p.name }))];
    return `
        <div class="or-header"><button class="or-back-btn" data-action="back">${ICON_BACK}</button><span class="or-header-title">生成模型</span></div>
        <div class="or-list">${rows.map(r => `
            <button class="or-option" data-action="pick-profile" data-profile-id="${escapeHtml(r.id)}">
                <span>${escapeHtml(r.label)}</span>
                ${(currentProfileId || '') === r.id ? ICON_CHECK : ''}
            </button>`).join('')}</div>`;
}

/**
 * @param {object} ctx SillyTavern.getContext() 结果
 * @param {() => void} [onExternalChange] 手机内生成/清空 pending 后回调——用来刷新魔杖菜单红点
 *   (那个红点在 light DOM,不在这份 shadow 树里,回滚触发的刷新走 index.js 自己的事件监听,
 *   但"生成更多"/"刷新"是手机内部发起的动作,没有对应的酒馆事件,得靠这个回调补上)
 */
export function createShell(ctx, onExternalChange) {
    let host = null, shadow = null, root = null, screenEl = null, toastEl = null;
    let navStack = [{ type: 'grid' }];
    let lastWorldKey;               // 上次渲染时的世界;变了就把导航栈清回网格(见 render)
    // 生成锁按 app 分:她的用法是一边等消息生成一边去翻论坛,共用一把锁会把整部手机锁死。
    // 六个 app 的账、水位、prompt 本来就各走各的,锁也该各管各的
    // (M2 补 sns、M3 补 browser、M4 补 gallery/memo,照 forum 的接法)。
    const busy = { messenger: false, forum: false, sns: false, browser: false, gallery: false, memo: false };
    let autoQueued = false;         // 生成锁占用期间被挡下的自动刷新,解锁后补跑一次(见 autoGenerate)
    let longPressTimer = null;
    let toastTimer = null;
    let suppressNextClick = false; // 线程行长按触发删除后,抑制紧随的 click(否则会顺手打开线程)
    const baselineDone = new Set(); // 已打过 seen 基线的 worldKey(纯内存去重,免得每次 render 都读一次 meta)
    let justUpdated = null;         // 刚生成完那一批 threadId;render 用掉一次就清,动效只播一回
    let pendingScroll = null;       // 'anchor' = 下次渲染后跳到新内容分界线;null = 原地保持滚动位置

    function settings() {
        const cur = ctx.extensionSettings.orrery || {};
        // 一次性迁移:正文范围改成「整本聊天」是 OOC 的正解,但新默认值对老用户无效——
        // 他们的设置里存着旧默认 4,展开顺序 {...DEFAULT, ...cur} 下 cur 永远赢,装了新版也照样 OOC。
        // 只搬旧默认值那一档(明确调过别的数字的人不动),搬完打标记,之后她想调回窗口就一直有效。
        if (cur.floorWindow === 4 && !cur.floorWindowMigrated) {
            cur.floorWindow = 0;
            cur.floorWindowMigrated = true;
        }
        // 2026-08-21 语言体系改版:zh 档退役,存量一律迁到新默认 ja(无需标记——zh 已不可再被设出来)。
        if (cur.language === 'zh') cur.language = 'ja';
        ctx.extensionSettings.orrery = {
            ...DEFAULT_SETTINGS, ...cur,
            customApi: { ...DEFAULT_SETTINGS.customApi, ...(cur.customApi || {}) },
        };
        return ctx.extensionSettings.orrery;
    }
    function saveSettings() { ctx.saveSettingsDebounced?.(); }

    // 归一化(含上面那次迁移)必须在扩展加载时就跑一次,不能等她打开 app——
    // 自动刷新、水位徽标这些路径都在 UI 之外读设置,懒到首次渲染才迁移的话,
    // 「装了新版但一次都没打开过手机」的用户会继续用旧的正文范围生成,而且毫无征兆。
    settings();
    saveSettings();

    // 提纯降级只提醒一次:静默降级=草稿重新混进正文而生成表面照常,必须让她看见
    let warnedDegraded = false;
    function checkPurificationDegraded() {
        if (generator.textPurificationDegraded && !warnedDegraded) {
            warnedDegraded = true;
            showToast('正文提纯已降级,请在设置里填「额外剔除的标签」');
        }
    }

    function currentWorldKey() { return computeWorldKey(ctx); }

    // tip + 各 app 水位 + seen 表一起取,渲染网格/判断红点都从这一份派生——六个 app 各看各的水位。
    async function currentWorld() {
        const worldKey = currentWorldKey();
        const tip = ctx.chat && ctx.chat.length ? ctx.chat.length - 1 : -1;
        if (!worldKey) {
            return {
                worldKey: null,
                world: {
                    contacts: new Map(), threads: new Map(), boards: new Map(), residents: new Map(), forumThreads: new Map(),
                    snsAccounts: new Map(), tweets: new Map(), searches: new Map(), visits: new Map(),
                    photos: [], memos: new Map(),
                },
                tip: -1, watermarks: { messenger: -1, forum: -1, sns: -1, browser: -1, gallery: -1, memo: -1 }, seen: {}, starred: {},
            };
        }
        const [entries, wmMessenger, wmForum, wmSns, wmBrowser, wmGallery, wmMemo] = await Promise.all([
            store.getEntriesForWorld(worldKey),
            store.getWatermark(worldKey, 'messenger'),
            store.getWatermark(worldKey, 'forum'),
            store.getWatermark(worldKey, 'sns'),
            store.getWatermark(worldKey, 'browser'),
            store.getWatermark(worldKey, 'gallery'),
            store.getWatermark(worldKey, 'memo'),
        ]);
        const world = foldWorld(entries);
        // 基线必须赶在读 seen 之前——顺序反了,升级后的第一屏就是满屏未读,而且那一眼再也收不回来
        if (!baselineDone.has(worldKey)) {
            baselineDone.add(worldKey);
            await store.initSeenBaseline(worldKey, seenBaselinePairs(world));
        }
        const [seen, starred] = await Promise.all([store.getSeenMap(worldKey), store.getStarred(worldKey)]);
        return {
            worldKey, world, tip,
            watermarks: { messenger: wmMessenger, forum: wmForum, sns: wmSns, browser: wmBrowser, gallery: wmGallery, memo: wmMemo },
            seen, starred,
        };
    }

    function profileLabel(profileId) {
        if (!profileId) return '跟随酒馆当前连接';
        const profiles = ctx.ConnectionManagerRequestService?.getSupportedProfiles?.() || [];
        return profiles.find(p => p.id === profileId)?.name || '跟随酒馆当前连接';
    }

    function showToast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
    }

    function applyTheme() {
        if (!root) return;
        const theme = settings().theme || 'seasalt';
        root.dataset.theme = theme;
        if (theme === 'mono' || theme === 'lunar' || theme === 'magic') {
            // 墨白/月夜/魔導書:极简底,不要波点和浪花(月夜的氛围交给图标,羊皮纸自己就是质感)
            root.style.setProperty('--or-dots', 'none');
            root.style.setProperty('--or-wave', 'none');
            root.style.setProperty('--or-chat-dots', 'none');
        } else {
            root.style.setProperty('--or-dots', dotPatternDataUri('#FBF9F4', 0.6));
            root.style.setProperty('--or-wave', scallopWaveDataUri('#FBF9F4'));
            root.style.setProperty('--or-chat-dots', dotPatternDataUri('#E7DFCF', 0.5));
        }
    }

    // ── 滚动位置:整屏 innerHTML 重建会把 scrollTop 抹成 0。不接管的话,酒馆来个事件、
    // 长按删一条、调一下条数,她正在读的位置就被弹回顶部(她 2026-08-14 报的第 2 点)。
    // 规则:同一块屏幕重渲染 → 原地保持;刚进屋 / 刚生成完 → 跳到新内容分界线。 ──
    const SCROLLERS = '.or-chat-scroll, .or-forum-scroll, .or-thread-list, .or-forum-list, .or-browser-list, .or-list, .or-grid, '
        + '.or-gallery-list, .or-memo-list, .or-gallery-detail-scroll, .or-memo-detail-scroll, .or-sns-list, .or-sns-scroll, .or-aster-list';
    function screenKey(top) {
        return [top.type, top.threadId || '', top.boardId || '', top.tweetId || '', top.accountId || '', top.photoId || '', top.noteId || '', top.tab || ''].join('|');
    }
    let lastScreenKey = null;

    function applyScroll(keep, key) {
        const scroller = screenEl.querySelector(SCROLLERS);
        const want = pendingScroll;
        pendingScroll = null;
        if (!scroller) return;
        // 生成是长事务,期间她完全可能已经退回列表页了——那次跳转的目标屏早就不在眼前,
        // 认屏之后就不会把「跳到新回复」错兑现成把联系人列表拉到底。
        if (want && want.key && want.key !== key) { if (keep != null) scroller.scrollTop = keep; return; }
        if (want) {
            const anchor = screenEl.querySelector('[data-new-anchor]');
            if (anchor) {
                // getBoundingClientRect 差值,不用 offsetTop——offsetParent 是 .or-phone 而不是滚动容器,
                // offsetTop 量出来的是相对整部手机的距离,会把滚动条送到离目标很远的地方。
                scroller.scrollTop += anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
            } else if (want.fallback === 'top') {
                scroller.scrollTop = 0;
            } else {
                scroller.scrollTop = scroller.scrollHeight;
            }
            return;
        }
        if (keep != null) scroller.scrollTop = keep;
    }

    async function render() {
        if (!screenEl) return;
        applyTheme();
        const { worldKey, world, tip, watermarks, seen, starred } = await currentWorld();
        // 换聊天=换了另一部手机:上一部停在谁的对话里,与这部毫无关系,退回网格重新开始。
        // (导航状态本身是跨开合保留的,见 open();只有换世界才清。)
        if (worldKey !== lastWorldKey) {
            lastWorldKey = worldKey;
            if (navStack.length > 1) navStack = [{ type: 'grid' }];
        }
        const top = navStack[navStack.length - 1];
        const key = screenKey(top);
        // 只有「还停在同一块屏幕」才谈得上保持位置;换屏了旧的 scrollTop 毫无意义
        const prevScroller = screenEl.querySelector(SCROLLERS);
        const keepScroll = (lastScreenKey === key && prevScroller) ? prevScroller.scrollTop : null;
        lastScreenKey = key;

        // 主人门:世界可用但还没认主 → 先过激活页,别的什么都看不到
        if (worldKey && top.type !== 'setup') {
            const owner = await store.getOwner(worldKey);
            if (!owner) {
                navStack = [{ type: 'setup' }];
                screenEl.innerHTML = renderSetupHtml(ctx.name2 || '');
                return;
            }
        }

        let markSeenAfter = null; // 进屋即已读,但要等这一帧画完再落库(别把渲染卡在 IndexedDB 上)

        if (top.type === 'setup') {
            screenEl.innerHTML = renderSetupHtml(ctx.name2 || '');
        } else if (top.type === 'grid') {
            // 角标 = 有新楼层还没生成余波 ‖ 有生成好但她还没看过的内容(真手机的角标就是后者)
            const dots = {
                messenger: watermarks.messenger < tip || hasUnseenInApp('messenger', world, seen),
                forum: watermarks.forum < tip || hasUnseenInApp('forum', world, seen),
                sns: watermarks.sns < tip || hasUnseenInApp('sns', world, seen),
                browser: watermarks.browser < tip || hasUnseenInApp('browser', world, seen),
                gallery: watermarks.gallery < tip || hasUnseenInApp('gallery', world, seen),
                memo: watermarks.memo < tip || hasUnseenInApp('memo', world, seen),
            };
            screenEl.innerHTML = renderGridHtml(dots, settings().theme || 'seasalt');
        } else if (top.type === 'messenger-list') {
            screenEl.innerHTML = renderThreadListHtml({ world, busy: busy.messenger, seen, justUpdated });
        } else if (top.type === 'messenger-thread') {
            const thread = world.threads.get(top.threadId);
            const ok = thread && (thread.kind === 'group' ? !!thread.group : world.contacts.has(top.threadId));
            if (!ok) { navStack = [{ type: 'grid' }]; return render(); } // 已被回滚/删除清空
            const seenKey = seenKeyForThread(top.threadId);
            if (top.seenAt === undefined) { // 刚进屋:定格一次水位当分界线,并安排跳到新消息处
                top.seenAt = seen[seenKey] || 0;
                pendingScroll = { fallback: top.seenAt > 0 ? 'bottom' : 'top', key };
            }
            screenEl.innerHTML = renderThreadHtml({
                thread, world, busy: busy.messenger, worldNow: world.worldNow,
                seenAt: top.seenAt, replyBatch: settings().threadReplyBatch,
            });
            markSeenAfter = [seenKey, latestTsOfThread(thread)];
        } else if (top.type === 'forum-list') {
            screenEl.innerHTML = renderForumListHtml({ world, busy: busy.forum, boardId: top.boardId || null, page: top.page || 1, seen, justUpdated });
        } else if (top.type === 'forum-thread') {
            const thread = world.forumThreads.get(top.threadId);
            if (!thread || !thread.title) { navStack = [{ type: 'grid' }]; return render(); } // 已被回滚/删除清空
            const seenKey = seenKeyForForumThread(top.threadId);
            if (top.seenAt === undefined) {
                top.seenAt = seen[seenKey] || 0;
                pendingScroll = { fallback: top.seenAt > 0 ? 'bottom' : 'top', key };
            }
            screenEl.innerHTML = renderForumThreadHtml({
                thread, world, busy: busy.forum, forumNow: world.forumNow,
                seenAt: top.seenAt, starred, replyBatch: settings().forumReplyBatch,
            });
            markSeenAfter = [seenKey, latestTsOfForumThread(thread)];
        } else if (top.type === 'sns-tl') {
            // task-007 底导两 tab:时间线=表账号能刷到的面;「我的」=主人主页(表/裏切换住这边)。
            if ((top.tab || 'tl') === 'me') {
                screenEl.innerHTML = renderSnsMyPageHtml({
                    world, busy: busy.sns, myRole: top.myRole || 'omote', seen, starred, snsNow: world.snsNow,
                });
            } else {
                screenEl.innerHTML = renderSnsTlHtml({ world, busy: busy.sns, seen, starred, justUpdated });
            }
            // TL 是浏览面,进 TL 不推 seen 水位——同论坛列表页语义(点进详情才算看过)。
        } else if (top.type === 'sns-tweet') {
            const tweet = world.tweets.get(top.tweetId);
            if (!tweet || !tweet.accountId) { navStack = [{ type: 'grid' }]; return render(); } // 已被回滚/删除清空
            const seenKey = seenKeyForTweet(top.tweetId);
            if (top.seenAt === undefined) {
                top.seenAt = seen[seenKey] || 0;
                pendingScroll = { fallback: top.seenAt > 0 ? 'bottom' : 'top', key };
            }
            screenEl.innerHTML = renderSnsTweetHtml({
                tweet, world, busy: busy.sns, snsNow: world.snsNow,
                seenAt: top.seenAt, starred, replyBatch: settings().snsReplyBatch,
            });
            markSeenAfter = [seenKey, latestTsOfTweet(tweet)];
        } else if (top.type === 'sns-profile') {
            const account = world.snsAccounts.get(top.accountId);
            if (!account) { navStack = [{ type: 'grid' }]; return render(); } // 已被回滚清空(理论上账号不会被单删,防御性兜底)
            screenEl.innerHTML = renderSnsProfileHtml({ account, world, snsNow: world.snsNow, seen, starred });
        } else if (top.type === 'browser') {
            // 整 app 一把 seen 快照(不是每条一个 key)——进屏定格一次,tab 切换/重渲染都不再挪动;
            // 下次真正离开(navBack)重新进来才会拿到新的水位当新的快照(同 thread/forum-thread/sns-tweet 的模式)。
            const seenKey = seenKeyForBrowser();
            if (top.seenAt === undefined) top.seenAt = seen[seenKey] || 0;
            screenEl.innerHTML = renderBrowserHtml({
                world, busy: busy.browser, tab: top.tab || 'search',
                seenAt: top.seenAt, browserNow: world.browserNow,
            });
            markSeenAfter = [seenKey, latestTsOfBrowser(world)];
        } else if (top.type === 'gallery') {
            // 整 app 一把 seen 快照(不是每条一个 key)——进屏定格一次,同 browser 的模式;
            // 详情屏(galleryPhoto)不单独追踪 seenAt,回到这一屏才继续推进水位。
            const seenKey = seenKeyForGallery();
            if (top.seenAt === undefined) top.seenAt = seen[seenKey] || 0;
            screenEl.innerHTML = renderGalleryListHtml({ world, busy: busy.gallery, seenAt: top.seenAt, galleryNow: world.galleryNow });
            markSeenAfter = [seenKey, latestTsOfGallery(world)];
        } else if (top.type === 'galleryPhoto') {
            const photo = world.photos.find(p => p.photoId === top.photoId);
            if (!photo) { navStack = [{ type: 'grid' }]; return render(); } // 已被回滚/反悔清空
            screenEl.innerHTML = renderGalleryPhotoHtml({ photo });
        } else if (top.type === 'memo') {
            const seenKey = seenKeyForMemo();
            if (top.seenAt === undefined) top.seenAt = seen[seenKey] || 0;
            screenEl.innerHTML = renderMemoListHtml({ world, busy: busy.memo, seenAt: top.seenAt, memoNow: world.memoNow });
            markSeenAfter = [seenKey, latestTsOfMemo(world)];
        } else if (top.type === 'memoNote') {
            const note = world.memos.get(top.noteId);
            if (!note) { navStack = [{ type: 'grid' }]; return render(); } // 已被回滚/反悔清空
            screenEl.innerHTML = renderMemoNoteHtml({ note });
        } else if (top.type === 'asterism') {
            screenEl.innerHTML = renderAsterismHtml({ world, starred });
        } else if (top.type === 'settings') {
            const s = settings();
            const owner = await store.getOwner(currentWorldKey());
            screenEl.innerHTML = renderSettingsHtml(s, profileLabel(s.profileId), owner);
        } else if (top.type === 'settings-profile-picker') {
            const s = settings();
            const profiles = ctx.ConnectionManagerRequestService?.getSupportedProfiles?.() || [];
            screenEl.innerHTML = renderProfilePickerHtml(profiles, s.profileId);
        }

        applyScroll(keepScroll, key);
        justUpdated = null; // 入场动效只播这一次;之后任何重渲染都不该再闪
        if (markSeenAfter && worldKey) {
            // 水位真的动了才通知外面——否则每次重渲染都白刷一遍魔杖菜单
            if (await store.markSeen(worldKey, markSeenAfter[0], markSeenAfter[1])) onExternalChange?.();
        }
    }

    function navPush(screen) { navStack.push(screen); render(); }
    function navBack() {
        if (navStack.length <= 1) { close(); return; }
        navStack.pop();
        render();
    }

    function openApp(appId) {
        const app = APPS.find(a => a.id === appId);
        if (!app) return;
        if (!app.enabled) {
            // 置灰 app 的观测系反馈(v0.7.2 特色 E 案):按到实体石头般轻晃一下,不弹地球手机的「未开放」
            const btn = shadow?.querySelector(`.or-app[data-app="${appId}"]`);
            if (btn) {
                btn.classList.remove('locked-shake');
                void btn.offsetWidth; // 连点也要能重播动画:先移除类并强制 reflow
                btn.classList.add('locked-shake');
            }
            showToast('尚未观测到这一面');
            return;
        }
        if (appId === 'messenger') navPush({ type: 'messenger-list' });
        else if (appId === 'settings') navPush({ type: 'settings' });
        else if (appId === 'forum') navPush({ type: 'forum-list', boardId: null });
        else if (appId === 'sns') navPush({ type: 'sns-tl', tab: 'tl', myRole: 'omote' });
        else if (appId === 'browser') navPush({ type: 'browser', tab: 'search' });
        else if (appId === 'gallery') navPush({ type: 'gallery' });
        else if (appId === 'memo') navPush({ type: 'memo' });
    }

    // 失败措辞分档:此前四个入口一律「生成失败,请重试」,把「模型没吐出能用的结果」「配置/网络出错」
    // 「回滚作废」压成同一句话——而其中一类重试一万次也不会好,用户只能靠猜。
    const FAIL_TEXT = {
        parse_failed: '模型没给出能用的结果,可以再试一次',
        rolled_back: '正文刚回滚了,这次生成已作废',
        no_thread: '这条线程已经不在了',
    };

    // 六个生成入口共用的外壳。@param app 'messenger'|'forum'|...,各持各的锁(一个 app 生成时另一个照常可用)。
    // 三条纪律都是真机踩出来的:
    // ① 上锁必须抢在第一个 await 之前——此前 `await store.getOwner()` 夹在 `if (busy) return`
    //    和 `busy = true` 中间,冷启动连点两下就能双开生成,白烧两次额度。
    // ② render() 也要进 try——它要碰 IndexedDB,一旦 reject 就跳过 finally,锁永久停在 true,
    //    四个按钮集体变成转圈的死按钮,关手机重开都复位不了,只能刷新整个酒馆。
    // ③ 必须有 catch——此前只有 try/finally,任何意外抛错的表现就是「点了没反应」,连提示都没有。
    //    这正是最难自查的那类失败,不能再留。
    async function runGeneration(app, run) {
        if (busy[app]) return { skipped: 'busy' };
        busy[app] = true;
        try {
            const worldKey = currentWorldKey();
            // 这三条早退在手机没开时(自动刷新)完全无声——她报的「自动刷新有时不生效」里,
            // 有一档就是静默失败。留下控制台线索,排查时不必再靠猜。
            if (!worldKey) { console.info('[Orrery] 生成跳过:当前聊天没有可用的 worldKey(群聊/未选卡)'); return { skipped: 'no_world' }; }
            const owner = await store.getOwner(worldKey);
            if (!owner) { console.info('[Orrery] 生成跳过:这部手机还没设定主人'); showToast('先设定手机主人'); return { skipped: 'no_owner' }; }
            await render();
            const result = await run({ worldKey, owner, s: settings() });
            if (!result) return { skipped: null };
            if (!result.ok) showToast(FAIL_TEXT[result.error] || '观测中断了,请再试一次');
            else if (result.changed === false) showToast('还没有新的正文进展');
            else if (!result.added) showToast('这一刻,世界很安静');
            // browser/gallery/memo 的成功文案各自单独一挂(任务书 §1/M4 §1),其余三个 app 仍共用
            // 「小世界起了 N 圈涟漪」——没有改动它们的文案,只在这一个分支上多分几叉。
            else if (app === 'browser') showToast(`浏览器里多了 ${result.added} 道痕迹`);
            else if (app === 'gallery') showToast(`相册里多了 ${result.added} 张照片`);
            else if (app === 'memo') showToast(`备忘录里多了 ${result.added} 处动静`);
            else showToast(`小世界起了 ${result.added} 圈涟漪`);
            return { skipped: null, result };
        } catch (err) {
            console.error('[Orrery] 生成出错', err);
            showToast(`生成出错:${err?.message || '未知错误'}`);
            return { skipped: 'error' };
        } finally {
            busy[app] = false;
            await render();
            // 降级警告排在结果提示之后播,别把「起了 N 圈涟漪」/「生成失败」直接顶掉
            // (一个会话只出现一次,晚两秒不影响它的作用)。
            setTimeout(checkPurificationDegraded, 2000);
            // 生成期间被挡下的那次自动刷新,在锁刚释放的此刻补跑——见 autoQueued 的长注。
            if (app === 'messenger' && autoQueued) {
                autoQueued = false;
                if (settings().autoRefresh) setTimeout(() => { autoGenerate(); }, 400);
            }
        }
    }

    async function doGenerateMore() {
        return await runGeneration('messenger', async ({ worldKey, owner, s }) => {
            const result = await generateMore(ctx, store, {
                worldKey, floorWindow: s.floorWindow, summaryThreshold: s.summaryThreshold,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
                allowUserContact: !!s.allowUserContact,
            });
            // 哪几条线程刚有了新动静——列表回来时给它们播一次入场动效,眼睛不用自己去找
            if (result?.ok && result.touchedThreads) justUpdated = new Set(result.touchedThreads);
            onExternalChange?.();
            return result;
        });
    }

    async function doContinueThread() {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'messenger-thread') return;
        await runGeneration('messenger', async ({ worldKey, owner, s }) => {
            // 进屋时已经把水位推到当时最新了,所以这一刻的水位正好是「这批新消息之前」
            const seenMap = await store.getSeenMap(worldKey);
            const before = seenMap[seenKeyForThread(top.threadId)] || 0;
            const result = await continueThread(ctx, store, {
                worldKey, threadId: top.threadId, floorWindow: s.floorWindow, summaryThreshold: s.summaryThreshold,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
                count: s.threadReplyBatch,
            });
            if (result?.ok && result.added > 0) {
                top.seenAt = before; // 分界线挪到这批新消息前面,滚动条也跟着落在那儿
                pendingScroll = { fallback: 'bottom', key: screenKey(top) };
            }
            return result;
        });
    }

    async function doRevert(ts) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'messenger-thread' || !Number.isFinite(ts)) return;
        const confirmed = await ctx.callGenericPopup('从这条起删除本线程之后的所有消息?', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        await manualRevert(store, worldKey, top.threadId, ts);
        await render();
    }

    // ── 论坛:独立水位的「刷新」/「生成更多」+ 反悔(单楼倒带同消息工法 / 整帖级联删)。 ──

    async function doGenerateMoreForum() {
        await runGeneration('forum', async ({ worldKey, owner, s }) => {
            const result = await generateMoreForum(ctx, store, {
                worldKey, floorWindow: s.floorWindow,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
                allowUserContact: !!s.allowUserContact,
            });
            if (result?.ok && result.added > 0) {
                const top = navStack[navStack.length - 1];
                if (top.type === 'forum-list') top.page = 1; // 新帖按活跃排在最前,回到第一页迎接
            }
            onExternalChange?.();
            return result;
        });
    }

    async function doContinueForumThread() {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'forum-thread') return;
        await runGeneration('forum', async ({ worldKey, owner, s }) => {
            const seenMap = await store.getSeenMap(worldKey);
            const before = seenMap[seenKeyForForumThread(top.threadId)] || 0;
            const result = await continueForumThread(ctx, store, {
                worldKey, threadId: top.threadId, floorWindow: s.floorWindow,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
                allowUserContact: !!s.allowUserContact,
                count: s.forumReplyBatch,
            });
            if (result?.ok && result.added > 0) {
                top.seenAt = before; // 同消息线程:分界线挪到这批新楼之前,不必自己往下翻
                pendingScroll = { fallback: 'bottom', key: screenKey(top) };
            }
            return result;
        });
    }

    async function doForumRevertFloor(ts) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'forum-thread' || !Number.isFinite(ts)) return;
        const confirmed = await ctx.callGenericPopup('从这楼起删除后面的所有回复?', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        await store.deleteThreadFrom(worldKey, top.threadId, ts); // 与消息线程同一反悔工法
        await render();
    }

    async function doDeleteForumThread(threadId) {
        const worldKey = currentWorldKey();
        if (!worldKey || !threadId) return;
        const confirmed = await ctx.callGenericPopup('删除这个帖子和全部回复?剧情推进后可能会有新的帖子出现。', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        await store.deleteForumThreadCascade(worldKey, threadId);
        const top = navStack[navStack.length - 1];
        if (top.type === 'forum-thread' && top.threadId === threadId) navStack.pop();
        await render();
        onExternalChange?.();
    }

    function doSelectForumBoard(boardId) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'forum-list') return;
        top.boardId = boardId || null; // 只是过滤态,不入栈,不当导航
        top.page = 1;                  // 换板块=换了一份列表,页码归位
        render();
    }

    // 论坛翻页(2026-08-21 月月点单,参考 Perigee 论坛分成多页):纯本地渲染,不耗生成。
    // 目标页由按钮 data-page 给绝对值(渲染层按当下帖数钳制过),不做相对增减,反悔删帖后不会漂。
    function doForumPage(page) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'forum-list' || !Number.isFinite(page) || page < 1) return;
        top.page = page;
        pendingScroll = { fallback: 'top', key: screenKey(top) }; // 新一页从头看起
        render();
    }

    // ── SNS「Pulsar」:独立水位的「刷新」/「生成回复」+ 反悔(单回复倒带同消息工法 / 整推级联删)。 ──

    async function doGenerateMoreSns() {
        await runGeneration('sns', async ({ worldKey, owner, s }) => {
            const result = await generateMoreSns(ctx, store, {
                worldKey, floorWindow: s.floorWindow,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
                allowUserContact: !!s.allowUserContact,
            });
            onExternalChange?.();
            return result;
        });
    }

    async function doContinueTweetReplies() {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'sns-tweet') return;
        await runGeneration('sns', async ({ worldKey, owner, s }) => {
            const seenMap = await store.getSeenMap(worldKey);
            const before = seenMap[seenKeyForTweet(top.tweetId)] || 0;
            const result = await continueTweetReplies(ctx, store, {
                worldKey, tweetId: top.tweetId, floorWindow: s.floorWindow,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
                allowUserContact: !!s.allowUserContact,
                count: s.snsReplyBatch,
            });
            if (result?.ok && result.added > 0) {
                top.seenAt = before; // 同消息线程/论坛帖内:分界线挪到这批新回复之前,不必自己往下翻
                pendingScroll = { fallback: 'bottom', key: screenKey(top) };
            }
            return result;
        });
    }

    async function doDeleteTweet(tweetId) {
        const worldKey = currentWorldKey();
        if (!worldKey || !tweetId) return;
        const confirmed = await ctx.callGenericPopup('删除这条推文和全部回复?剧情推进后可能会有新的动态出现。', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        await store.deleteTweetCascade(worldKey, tweetId);
        const top = navStack[navStack.length - 1];
        if (top.type === 'sns-tweet' && top.tweetId === tweetId) navStack.pop();
        await render();
        onExternalChange?.();
    }

    async function doRevertTweetReply(ts) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'sns-tweet' || !Number.isFinite(ts)) return;
        const confirmed = await ctx.callGenericPopup('从这条起删除后面的所有回复?', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        await store.deleteTweetRepliesFrom(worldKey, top.tweetId, ts); // 与消息线程/论坛楼同一反悔工法
        await render();
    }

    // task-007:底导「时间线/我的」切换;表/裏切换只活在「我的」页(裏垢入口从 TL 顶栏迁来)。
    function doSnsSelectTab(tab) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'sns-tl') return;
        top.tab = tab === 'me' ? 'me' : 'tl';
        render();
    }

    function doSnsSelectViewer(role) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'sns-tl') return;
        top.myRole = role === 'ura' ? 'ura' : 'omote';
        render();
    }

    // ── Asterism 星图(task-007 P0):观测者的收藏,点亮/熄灭——纯用户侧数据,世界毫无感知。──
    async function doToggleStar(key) {
        const worldKey = currentWorldKey();
        if (!worldKey || !key) return;
        const on = await store.toggleStar(worldKey, key);
        showToast(on ? '一颗星亮了' : '一颗星熄灭了');
        render();
    }

    /**
     * 星图页:不属于 char 的手机(主屏没有它的图标,她拍板:主屏多一个 char 不知道的 app 会破坏
     * 沉浸感)——入口在状态栏(仪器面板)与长按任意星标。内容从 world 现查:被反悔删掉的内容
     * 不撒谎,如实显示已消失,星可以就地熄灭。
     */
    function renderAsterismHtml({ world, starred }) {
        const items = Object.entries(starred)
            .map(([key, v]) => ({ key, at: v?.at || 0 }))
            .sort((a, b) => b.at - a.at);
        const cards = items.map(({ key }) => {
            const star = `<button class="or-star on" data-action="toggle-star" data-star-key="${escapeHtml(key)}" title="从星图移除">${ICON_STAR_FILL}</button>`;
            let badge, title = '', body = '', action = '', attrs = '', gone = false;
            if (key.startsWith('tw:')) {
                badge = 'Pulsar';
                const t = world.tweets.get(key.slice(3));
                if (t?.accountId) {
                    const acc = world.snsAccounts.get(t.accountId);
                    title = acc?.displayName || t.accountId;
                    body = (t.body || '').slice(0, 100);
                    action = 'open-sns-tweet'; attrs = `data-tweet-id="${escapeHtml(t.tweetId)}"`;
                } else gone = true;
            } else if (key.startsWith('ft:')) {
                badge = '论坛';
                const t = world.forumThreads.get(key.slice(3));
                if (t?.title) {
                    title = t.title;
                    body = (t.body || '').slice(0, 100);
                    action = 'open-forum-thread'; attrs = `data-thread-id="${escapeHtml(t.threadId)}"`;
                } else gone = true;
            } else return '';
            if (gone) {
                return `<div class="or-aster-card gone"><div class="or-aster-head"><span class="or-aster-badge">${badge}</span>${star}</div>
                    <div class="or-aster-gone">这颗星对应的内容,已从观测记录中消失。</div></div>`;
            }
            return `<button class="or-aster-card" data-action="${action}" ${attrs}>
                <div class="or-aster-head"><span class="or-aster-badge">${badge}</span>${star}</div>
                <div class="or-aster-title">${escapeHtml(title)}</div>
                ${body ? `<div class="or-aster-body">${escapeHtml(body)}</div>` : ''}
            </button>`;
        }).join('');
        return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">星图</span>
        </div>
        <div class="or-aster-list">${cards || `<div class="or-empty">还没有点亮任何星星。<br>在推文或帖子右下角点星标,把喜欢的内容连成你的星座。</div>`}</div>`;
    }

    // ── M3:浏览器「Astrolabe」:独立水位的「刷新」(唯一入口,没有续写)+ tab 切换(纯本地渲染)
    //    + 反悔(两 tab 一起倒带,按世界时间——见 store.deleteBrowserFrom 的长注)。 ──

    async function doGenerateMoreBrowser() {
        // 浏览器是单屏 app,「刷新」本身就是从这个带 seen 快照的屏里发起的(不像消息/论坛/SNS的主生成
        // 是从不追踪 seen 的列表页发起)——所以要照 doContinueThread 的工法,把水位先挪到这批新内容
        // 之前,新长出来的行才挂得上"新"小圆点,而不是在同一屏里悄无声息地混进旧内容。
        const top = navStack[navStack.length - 1];
        await runGeneration('browser', async ({ worldKey, owner, s }) => {
            let before = 0;
            if (top.type === 'browser') {
                const seenMap = await store.getSeenMap(worldKey);
                before = seenMap[seenKeyForBrowser()] || 0;
            }
            const result = await generateMoreBrowser(ctx, store, {
                worldKey, floorWindow: s.floorWindow,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
            });
            if (result?.ok && result.added > 0 && top.type === 'browser') top.seenAt = before;
            onExternalChange?.();
            return result;
        });
    }

    function doBrowserSelectTab(tab) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'browser') return;
        top.tab = tab === 'visits' ? 'visits' : 'search';
        render();
    }

    async function doBrowserRevert(worldTime) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'browser' || !Number.isFinite(worldTime)) return;
        const confirmed = await ctx.callGenericPopup('从这条起删除之后的所有浏览器记录?', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        await store.deleteBrowserFrom(worldKey, worldTime); // 两 tab 一起倒带,按世界时间不按入账序号
        await render();
    }

    // ── M4:相册「无声的日记」+ 备忘录「未发送的真心话」:独立水位的「刷新」(唯一入口,没有续写)
    //    + 反悔(按世界时间倒带,工法同 deleteBrowserFrom——见 store.deleteGalleryFrom/deleteMemoFrom 的长注)。 ──

    async function doGenerateMoreGallery() {
        // 同 doGenerateMoreBrowser 的工法:水位先挪到这批新内容之前,新长出来的方块才挂得上 NEW 点,
        // 而不是在同一屏里悄无声息地混进旧内容。
        const top = navStack[navStack.length - 1];
        await runGeneration('gallery', async ({ worldKey, owner, s }) => {
            let before = 0;
            if (top.type === 'gallery') {
                const seenMap = await store.getSeenMap(worldKey);
                before = seenMap[seenKeyForGallery()] || 0;
            }
            const result = await generateMoreGallery(ctx, store, {
                worldKey, floorWindow: s.floorWindow,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
            });
            if (result?.ok && result.added > 0 && top.type === 'gallery') top.seenAt = before;
            onExternalChange?.();
            return result;
        });
    }

    async function doGalleryRevert(worldTime) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'gallery' || !Number.isFinite(worldTime)) return;
        const confirmed = await ctx.callGenericPopup('从这张起删除之后的所有相册记录?', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        await store.deleteGalleryFrom(worldKey, worldTime); // 世界回滚,按世界时间不按入账序号
        await render();
    }

    async function doGenerateMoreMemo() {
        const top = navStack[navStack.length - 1];
        await runGeneration('memo', async ({ worldKey, owner, s }) => {
            let before = 0;
            if (top.type === 'memo') {
                const seenMap = await store.getSeenMap(worldKey);
                before = seenMap[seenKeyForMemo()] || 0;
            }
            const result = await generateMoreMemo(ctx, store, {
                worldKey, floorWindow: s.floorWindow,
                profileId: s.profileId || null, customApi: s.customApi, owner, language: s.language,
                excludeTags: s.excludeTags || '',
            });
            if (result?.ok && result.added > 0 && top.type === 'memo') top.seenAt = before;
            onExternalChange?.();
            return result;
        });
    }

    async function doMemoRevert(worldTime) {
        const top = navStack[navStack.length - 1];
        if (top.type !== 'memo' || !Number.isFinite(worldTime)) return;
        const confirmed = await ctx.callGenericPopup('从这条起删除之后的所有备忘动静?', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        await store.deleteMemoFrom(worldKey, worldTime); // 世界回滚,按世界时间不按入账序号
        await render();
    }

    function doStepper(field, delta) {
        const s = settings();
        // 0 = 整本聊天(默认,与酒馆每轮实际发送的一致;旧楼层由预设正则自行收敛成摘要)
        if (field === 'floorWindow') s.floorWindow = Math.max(0, Math.min(20, s.floorWindow + delta));
        if (field === 'summaryThreshold') s.summaryThreshold = Math.max(10, Math.min(200, s.summaryThreshold + delta));
        // 点单条数 1〜20:上限跟着输出预算走(65500 顶格,20 楼绰绰有余),下限 1——0 条的按钮没有意义
        if (field === 'threadReplyBatch') s.threadReplyBatch = Math.max(1, Math.min(20, (s.threadReplyBatch || 3) + delta));
        if (field === 'forumReplyBatch') s.forumReplyBatch = Math.max(1, Math.min(20, (s.forumReplyBatch || 3) + delta));
        if (field === 'snsReplyBatch') s.snsReplyBatch = Math.max(1, Math.min(20, (s.snsReplyBatch || 3) + delta));
        saveSettings();
        render();
    }

    async function doConfirmSetup() {
        const input = root?.querySelector('input[data-setup-name]');
        const name = (input?.value || '').trim();
        if (!name) { showToast('名字不能为空'); return; }
        const confirmed = await ctx.callGenericPopup(`这部手机将永远属于「${name}」,之后无法更改。确定吗?`, ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        await store.setOwner(worldKey, name);
        navStack = [{ type: 'grid' }];
        render();
    }

    async function doDeleteContact(threadId) {
        const worldKey = currentWorldKey();
        if (!worldKey || !threadId) return;
        const { world } = await currentWorld();
        const thread = world.threads.get(threadId);
        if (!thread) return;
        const label = thread.kind === 'group'
            ? `群聊「${thread.group?.name || '?'}」`
            : `联系人「${world.contacts.get(threadId)?.name || '?'}」`;
        const confirmed = await ctx.callGenericPopup(`删除${label}和这段聊天的全部记录?剧情推进后 TA 仍可能重新出现。`, ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        await store.deleteContactCascade(worldKey, threadId);
        const top = navStack[navStack.length - 1];
        if (top.type === 'messenger-thread' && top.threadId === threadId) navStack.pop();
        await render();
        onExternalChange?.();
    }

    async function doWipePhone() {
        const worldKey = currentWorldKey();
        if (!worldKey) return;
        const confirmed = await ctx.callGenericPopup('抹掉这部手机?本聊天的联系人、全部聊天记录和主人设定都将删除,不可恢复。', ctx.POPUP_TYPE.CONFIRM);
        if (confirmed !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
        await store.wipeWorld(worldKey);
        navStack = [{ type: 'grid' }];
        await render();
        onExternalChange?.();
    }

    function doPickProfile(profileId) {
        const s = settings();
        s.profileId = profileId || null;
        saveSettings();
        navBack();
    }

    function onClick(e) {
        if (suppressNextClick) { suppressNextClick = false; return; }
        const el = e.target.closest('[data-action]');
        if (!el) return;
        switch (el.dataset.action) {
            case 'close-backdrop': close(); break;
            case 'close-phone': close(); break;
            case 'back': navBack(); break;
            case 'open-app': openApp(el.dataset.app); break;
            case 'open-thread': navPush({ type: 'messenger-thread', threadId: el.dataset.threadId }); break;
            case 'refresh': doGenerateMore(); break;
            case 'generate-more': doContinueThread(); break;
            case 'revert': doRevert(Number(el.dataset.ts)); break;
            case 'open-forum-thread': navPush({ type: 'forum-thread', threadId: el.dataset.threadId }); break;
            case 'forum-refresh': doGenerateMoreForum(); break;
            case 'forum-generate-more': doContinueForumThread(); break;
            case 'select-forum-board': doSelectForumBoard(el.dataset.boardId); break;
            case 'forum-page': doForumPage(parseInt(el.dataset.page, 10)); break;
            case 'open-sns-tweet': navPush({ type: 'sns-tweet', tweetId: el.dataset.tweetId }); break;
            case 'open-sns-profile': navPush({ type: 'sns-profile', accountId: el.dataset.accountId }); break;
            case 'sns-refresh': doGenerateMoreSns(); break;
            case 'sns-generate-more': doContinueTweetReplies(); break;
            case 'sns-tab': doSnsSelectTab(el.dataset.tab); break;
            case 'sns-select-viewer': doSnsSelectViewer(el.dataset.role); break;
            case 'toggle-star': doToggleStar(el.dataset.starKey); break;
            case 'open-asterism': navPush({ type: 'asterism' }); break;
            case 'browser-refresh': doGenerateMoreBrowser(); break;
            case 'browser-select-tab': doBrowserSelectTab(el.dataset.tab); break;
            case 'open-gallery-photo': navPush({ type: 'galleryPhoto', photoId: el.dataset.photoId }); break;
            case 'gallery-refresh': doGenerateMoreGallery(); break;
            case 'open-memo-note': navPush({ type: 'memoNote', noteId: el.dataset.noteId }); break;
            case 'memo-refresh': doGenerateMoreMemo(); break;
            case 'stepper': doStepper(el.dataset.field, Number(el.dataset.delta)); break;
            case 'toggle-field': { const s = settings(); s[el.dataset.field] = !s[el.dataset.field]; saveSettings(); render(); onExternalChange?.(); break; }
            case 'toggle-capi': { const s = settings(); s.customApi.enabled = !s.customApi.enabled; saveSettings(); render(); break; }
            case 'set-theme': { const s = settings(); s.theme = el.dataset.theme; saveSettings(); render(); break; }
            case 'set-language': { const s = settings(); s.language = el.dataset.language; saveSettings(); render(); break; }
            case 'confirm-setup': doConfirmSetup(); break;
            case 'wipe-phone': doWipePhone(); break;
            case 'open-profile-picker': navPush({ type: 'settings-profile-picker' }); break;
            case 'pick-profile': doPickProfile(el.dataset.profileId); break;
        }
    }

    // 设置页的独立 API 输入框(设置=驾驶舱,不属于小世界的只读面——她 2026-08-11 点单)
    function onFieldChange(e) {
        const input = e.target;
        const s = settings();
        if (input.matches?.('input[data-capi]')) {
            s.customApi[input.dataset.capi] = input.value.trim();
        } else if (input.matches?.('input[data-field-text]')) {
            s[input.dataset.fieldText] = input.value.trim();
        } else return;
        saveSettings();
    }

    // 长按 / 桌面右键:消息行=唤出反悔按钮;线程行=删除联系人/群;论坛帖行=删整帖;论坛楼行=删本楼及之后
    // (后两者跟线程行一样直接弹确认,不走"唤出按钮再点一次"那一步——反悔工法相同,UI 更省一步)。
    function onPointerDown(e) {
        clearTimeout(longPressTimer);
        // 星标长按=星图副入口(task-007 她拍板两个都要);必须先于行分支——星标嵌在推文行里,
        // 落到行分支会变成长按删推。
        const starBtn = e.target.closest('.or-star');
        if (starBtn) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                navPush({ type: 'asterism' });
            }, 550);
            return;
        }
        const msgRow = e.target.closest('.or-msg-row');
        if (msgRow) {
            longPressTimer = setTimeout(() => msgRow.classList.add('show-revert'), 480);
            return;
        }
        const threadRow = e.target.closest('.or-thread-row');
        if (threadRow) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doDeleteContact(threadRow.dataset.threadId);
            }, 550);
            return;
        }
        const forumRow = e.target.closest('.or-forum-row');
        if (forumRow) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doDeleteForumThread(forumRow.dataset.threadId);
            }, 550);
            return;
        }
        const floorRow = e.target.closest('.or-forum-floor-row');
        if (floorRow) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doForumRevertFloor(Number(floorRow.dataset.ts));
            }, 550);
            return;
        }
        const snsRow = e.target.closest('.or-sns-row');
        if (snsRow) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doDeleteTweet(snsRow.dataset.tweetId);
            }, 550);
            return;
        }
        const snsReplyRow = e.target.closest('.or-sns-reply-row');
        if (snsReplyRow) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doRevertTweetReply(Number(snsReplyRow.dataset.ts));
            }, 550);
            return;
        }
        const browserRow = e.target.closest('.or-browser-row');
        if (browserRow) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doBrowserRevert(Number(browserRow.dataset.ts));
            }, 550);
            return;
        }
        const galleryPh = e.target.closest('.or-ph');
        if (galleryPh) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doGalleryRevert(Number(galleryPh.dataset.ts));
            }, 550);
            return;
        }
        const memoRow = e.target.closest('.or-memo-row');
        if (memoRow) {
            longPressTimer = setTimeout(() => {
                suppressNextClick = true;
                doMemoRevert(Number(memoRow.dataset.ts));
            }, 550);
        }
    }
    function onPointerClear() { clearTimeout(longPressTimer); }
    function onContextMenu(e) {
        const starBtn = e.target.closest('.or-star');
        if (starBtn) {
            e.preventDefault();
            navPush({ type: 'asterism' });
            return;
        }
        const threadRow = e.target.closest('.or-thread-row');
        if (threadRow) {
            e.preventDefault();
            doDeleteContact(threadRow.dataset.threadId);
            return;
        }
        const forumRow = e.target.closest('.or-forum-row');
        if (forumRow) {
            e.preventDefault();
            doDeleteForumThread(forumRow.dataset.threadId);
            return;
        }
        const floorRow = e.target.closest('.or-forum-floor-row');
        if (floorRow) {
            e.preventDefault();
            doForumRevertFloor(Number(floorRow.dataset.ts));
            return;
        }
        const snsRow = e.target.closest('.or-sns-row');
        if (snsRow) {
            e.preventDefault();
            doDeleteTweet(snsRow.dataset.tweetId);
            return;
        }
        const snsReplyRow = e.target.closest('.or-sns-reply-row');
        if (snsReplyRow) {
            e.preventDefault();
            doRevertTweetReply(Number(snsReplyRow.dataset.ts));
            return;
        }
        const browserRow = e.target.closest('.or-browser-row');
        if (browserRow) {
            e.preventDefault();
            doBrowserRevert(Number(browserRow.dataset.ts));
            return;
        }
        const galleryPh = e.target.closest('.or-ph');
        if (galleryPh) {
            e.preventDefault();
            doGalleryRevert(Number(galleryPh.dataset.ts));
            return;
        }
        const memoRow = e.target.closest('.or-memo-row');
        if (memoRow) {
            e.preventDefault();
            doMemoRevert(Number(memoRow.dataset.ts));
            return;
        }
        const row = e.target.closest('.or-msg-row');
        if (!row) return;
        e.preventDefault();
        root.querySelectorAll('.or-msg-row.show-revert').forEach(r => { if (r !== row) r.classList.remove('show-revert'); });
        row.classList.toggle('show-revert');
    }

    function mount() {
        host = document.createElement('div');
        host.id = 'orrery-shadow-host';
        host.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:2147483647;display:none;';
        document.body.appendChild(host);
        shadow = host.attachShadow({ mode: 'open' });

        for (const href of [SHELL_CSS_URL, MESSENGER_SKIN_URL, FORUM_SKIN_URL, SNS_SKIN_URL, BROWSER_SKIN_URL, GALLERY_SKIN_URL, MEMO_SKIN_URL]) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            shadow.appendChild(link);
        }

        root = document.createElement('div');
        root.className = 'or-root';
        root.innerHTML = `
            <div class="or-backdrop" data-action="close-backdrop"></div>
            <div class="or-phone">
                <div class="or-statusbar">
                    <span class="or-statusbar-label">Orrery</span>
                    <span class="or-statusbar-icons">${ICON_HUD_STARS}${ICON_HUD_RING}</span>
                    <button class="or-statusbar-star" data-action="open-asterism" title="星图">${ICON_STAR}</button>
                    <button class="or-close-btn" data-action="close-phone" title="收起手机">${ICON_CLOSE}</button>
                </div>
                <div class="or-screen"></div>
                <div class="or-homebar"></div>
                <div class="or-toast"></div>
            </div>`;
        shadow.appendChild(root);
        screenEl = root.querySelector('.or-screen');
        toastEl = root.querySelector('.or-toast');

        root.addEventListener('click', onClick);
        root.addEventListener('change', onFieldChange);
        root.addEventListener('pointerdown', onPointerDown);
        root.addEventListener('pointerup', onPointerClear);
        root.addEventListener('pointerleave', onPointerClear, true);
        root.addEventListener('pointermove', onPointerClear);
        // pointercancel 必须一起清:手机上系统级手势(返回、下拉通知栏、来电)会以 cancel 收场,
        // 不发 up/leave/move。漏了它,长按计时器照样跑完 → 冒出一个与当前操作无关的删除确认框;
        // 而且 suppressNextClick 被置上后永远等不到那次合成 click,会去吞掉用户下一次真实点击。
        root.addEventListener('pointercancel', onPointerClear);
        root.addEventListener('contextmenu', onContextMenu);
    }

    function open() {
        if (!host) mount();
        host.style.display = 'block';
        // 导航状态跨开合保留(她 2026-08-14 点单):她是边聊边刷、靠悬浮球频繁开合的用法,
        // 每次重开都弹回网格,等于每次都要重走「消息→点进那个人」。换聊天时才清,见 render()。
        requestAnimationFrame(() => {
            root.classList.add('open');
            // 开机一瞬的星尘散落(v0.7.2 特色 C 案,月月选星尘流派):跨次元投影落定的痕迹。
            // 一次性、极淡、0.55s 自灭;点色走 --or-salt-deep,三主题免配(海盐=蓝/墨白=灰/月夜=粉)。
            const phone = root.querySelector('.or-phone');
            if (phone && !phone.querySelector('.or-stardust')) {
                const dust = document.createElement('div');
                dust.className = 'or-stardust';
                phone.appendChild(dust);
                dust.addEventListener('animationend', () => dust.remove(), { once: true });
                setTimeout(() => dust.remove(), 1200); // animationend 万一被吞(display 切换),兜底自清
            }
        });
        render();
    }
    function close() {
        root?.classList.remove('open');
        setTimeout(() => { if (host) host.style.display = 'none'; }, 200);
    }
    function toggle() { isOpen() ? close() : open(); }
    function isOpen() { return !!root?.classList.contains('open'); }

    /** 世界变化(生成完成 / 回滚 / 换聊天)后的刷新入口——手机开着才重渲染,关着什么都不做。 */
    function onWorldChanged() {
        if (isOpen()) render();
    }

    /**
     * 自动刷新入口(index.js 防抖后调):手机没开也能跑——render/toast 自带空目标保护。
     *
     * ⚠️撞上生成锁时**排队**,不是丢弃——她 2026-08-14 真机复现的「自动刷新有时不生效」就死在这里:
     * 连发两条,第一条触发的生成要跑四十几秒,第二条的自动刷新在这期间撞锁。旧版直接静默丢弃,
     * 那层楼从此没人管(除非又来新楼层);按次数重试也不行,重试窗口比一次生成还短,数完就放弃。
     * 改成挂个标记,由 runGeneration 的 finally 在锁刚释放时补跑——生成多慢都等得到。
     */
    async function autoGenerate() {
        if (busy.messenger) {
            autoQueued = true;
            console.info('[Orrery] 自动刷新:上一批还在生成,已排队,生成结束后补跑');
            return { skipped: 'busy', queued: true };
        }
        return await doGenerateMore();
    }

    return { open, close, toggle, isOpen, onWorldChanged, autoGenerate };
}
