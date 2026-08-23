// 装配层:取 ctx、绑酒馆事件、建魔杖菜单入口、挂手机 Shadow DOM。ES 相对 import 可行——
// index.js 以 <script type="module"> 加载,浏览器按其自身 URL 解析相对路径(见 docs/VERIFICATION.md §1)。
import { registerRollback } from './core/rollback.js';
import { computeWorldKey, foldWorld, hasUnseenInApp } from './core/world.js';
import * as store from './core/store.js';
import { createShell } from './ui/shell.js';
import { ICON_WAND_MENU } from './ui/icons.js';

function waitForExtensionsMenu(cb) {
    const found = document.getElementById('extensionsMenu');
    if (found) { cb(found); return; }
    const timer = setInterval(() => {
        const el = document.getElementById('extensionsMenu');
        if (el) { clearInterval(timer); cb(el); }
    }, 400);
}

// 自报家门:排查「更新了却在跑旧码」(酒馆本地/全局双副本、静默 pull 失败)时,
// 让实际加载的这份代码自己在控制台亮明版本——比对扩展管理器显示的版本号即知真伪。
export const ORRERY_VERSION = '0.14.2';
console.info(`[Orrery] v${ORRERY_VERSION} 已加载 · 输出预算 65500`);

function main() {
    // ⚠️不许持有 getContext() 的一次性快照:characterId/chatId 等是取值瞬间的标量,
    // 扩展加载时用户往往还没选卡,快照会把 undefined 冻结进来(真机首日 bug:worldKey 恒 null,
    // 激活页不出现、刷新静默无反应)。用代理转发,每次属性访问都取新鲜 context。
    const ctx = new Proxy({}, { get: (_, prop) => SillyTavern.getContext()[prop] });
    // 设置默认值的归一化在 ui/shell.js 的 settings() 里统一做,这里不重复定义一份

    let menuDot = null, fab = null, fabDot = null;

    // 红点走「水位推导」:装插件前的存量楼层、流式丢事件都能亮(与 generator 的 pending 推导同源)。
    // 两个 app 各存各的水位(M1 水位重构),这里只关心"有没有任一 app 落后",具体哪个 app 亮由
    // ui/shell.js 渲染网格时各自再算一遍——这个红点只管魔杖菜单/悬浮球那一颗全局提示。
    /**
     * 只问「有没有还没生成过余波的楼层」——自动刷新用这个。
     * ⚠️不能拿下面的 hasNewRipples 代劳:那个把「有未读」也算进去了,而未读绝不该触发生成
     * (她刷完不点开,自动刷新就会一轮轮重复生成,白烧额度)。两者语义必须分开。
     */
    async function hasPendingFloors() {
        const worldKey = computeWorldKey(ctx);
        if (!worldKey) return false;
        const tip = ctx.chat.length - 1;
        if (tip < 0) return false;
        const [wmMessenger, wmForum, wmSns, wmBrowser, wmGallery, wmMemo] = await Promise.all([
            store.getWatermark(worldKey, 'messenger'),
            store.getWatermark(worldKey, 'forum'),
            store.getWatermark(worldKey, 'sns'),
            store.getWatermark(worldKey, 'browser'),
            store.getWatermark(worldKey, 'gallery'),
            store.getWatermark(worldKey, 'memo'),
        ]);
        return wmMessenger < tip || wmForum < tip || wmSns < tip || wmBrowser < tip || wmGallery < tip || wmMemo < tip;
    }

    async function hasNewRipples() {
        const worldKey = computeWorldKey(ctx);
        if (!worldKey) return false;
        const tip = ctx.chat.length - 1;
        if (tip < 0) return false;
        if (await hasPendingFloors()) return true;
        // 楼层都已生成过余波,还要问一句:生成出来的东西她看了没有?真手机的角标本来就是「有未读」,
        // 只认水位的话,自动刷新替她生成完一批,红点当场就灭了——她永远不知道有新消息躺在里面。
        // 基线没打过则跳过:那时整个账本还没被认领,旧内容会被整批误判成未读(见 store.initSeenBaseline)。
        if (!(await store.hasSeenBaseline(worldKey))) return false;
        const [entries, seen] = await Promise.all([
            store.getEntriesForWorld(worldKey),
            store.getSeenMap(worldKey),
        ]);
        const world = foldWorld(entries);
        return hasUnseenInApp('messenger', world, seen) || hasUnseenInApp('forum', world, seen)
            || hasUnseenInApp('sns', world, seen) || hasUnseenInApp('browser', world, seen)
            || hasUnseenInApp('gallery', world, seen) || hasUnseenInApp('memo', world, seen);
    }

    async function refreshBadge() {
        ensureFab();
        const show = (await hasNewRipples()) ? 'block' : 'none';
        if (menuDot) menuDot.style.display = show;
        if (fabDot) fabDot.style.display = show;
    }

    // 悬浮球:主入口(她真机首反馈:光有魔杖菜单项找不到)。竖向可拖、右侧贴边、位置记忆;设置里可关。
    function ensureFab() {
        const s = ctx.extensionSettings.orrery || {};
        const show = s.showFab !== false; // 默认开
        if (!show) { fab?.remove(); fab = null; fabDot = null; return; }
        if (fab) return;
        fab = document.createElement('div');
        fab.id = 'orrery-fab';
        fab.innerHTML = `${ICON_WAND_MENU}<span class="orrery-fab-dot"></span>`;
        if (Number.isFinite(s.fabTop)) fab.style.top = s.fabTop + 'px';
        document.body.appendChild(fab);
        fabDot = fab.querySelector('.orrery-fab-dot');

        let drag = null;
        fab.addEventListener('pointerdown', (e) => {
            drag = { y: e.clientY, top: fab.offsetTop, moved: false };
            fab.setPointerCapture(e.pointerId);
        });
        fab.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dy = e.clientY - drag.y;
            if (Math.abs(dy) > 6) drag.moved = true;
            if (drag.moved) {
                fab.style.top = Math.min(window.innerHeight - 56, Math.max(8, drag.top + dy)) + 'px';
            }
        });
        fab.addEventListener('pointerup', () => {
            if (!drag) return;
            if (!drag.moved) {
                shell.toggle();
            } else if (ctx.extensionSettings.orrery) {
                ctx.extensionSettings.orrery.fabTop = fab.offsetTop;
                ctx.saveSettingsDebounced?.();
            }
            drag = null;
        });
        fab.addEventListener('pointercancel', () => { drag = null; });
    }

    const shell = createShell(ctx, refreshBadge);

    // 自动刷新:开着时,楼层事件安定 1.6s 后自动跑一次主生成(一次调用刷一批;她 2026-08-11 点单)。
    // 生成完 pending 清空,后续 onWorldChanged 不会再触发——天然防循环。
    // ⏱ 判据用 hasPendingFloors 而不是 hasNewRipples——后者含「有未读」,拿它当触发器
    // 会在她刷完不点开时一轮轮重复生成。
    // 撞上生成锁的那一档不在这里补,交给 shell 的 autoQueued(锁一释放就补跑),
    // 因为一次生成可能要四十几秒,在这里数着次数重试永远赶不上。
    let autoTimer = null;
    function maybeAutoRefresh() {
        if (!ctx.extensionSettings.orrery?.autoRefresh) return;
        clearTimeout(autoTimer);
        autoTimer = setTimeout(async () => {
            if (!(await hasPendingFloors())) { refreshBadge(); return; }
            const r = await shell.autoGenerate();
            if (r?.skipped && r.skipped !== 'busy') console.info('[Orrery] 自动刷新未执行,原因:', r.skipped);
            refreshBadge();
        }, 1600);
    }

    registerRollback(ctx, store, () => {
        refreshBadge();
        shell.onWorldChanged();
        maybeAutoRefresh();
    });

    waitForExtensionsMenu((menu) => {
        if (document.getElementById('orrery-menu-item')) return;
        const item = document.createElement('a');
        item.id = 'orrery-menu-item';
        item.className = 'list-group-item';
        item.href = '#';
        item.title = 'Orrery';
        item.innerHTML = `${ICON_WAND_MENU}<span>Orrery</span><span class="orrery-menu-dot"></span>`;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            shell.toggle();
        });
        menu.appendChild(item);
        menuDot = item.querySelector('.orrery-menu-dot');
        refreshBadge();
    });

    ensureFab();
    refreshBadge();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
