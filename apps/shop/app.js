// 购物「Libra」:纯渲染,不碰 ctx、不挂事件监听——事件委托统一在 ui/shell.js(同 memo/gallery 的模式)。
// 用户只读:零输入框,操作只有 shell 的 data-action(刷新/切 tab/点商品)+ 长按/右键反悔(倒带)。
// 没有「生成更多/续写」——只有主刷新,详情屏只是看,没有任何操作按钮(任务书-M15 §一)。
// Libra 是故事世界里的电商平台,带品牌名;标题就是「Libra」,平台界面词(标签页名/配送状态等)走 chrome 三语表。
import { ICON_BACK } from '../../ui/icons.js';
import { escapeHtml } from '../../core/escape.js';
import { chrome } from '../../ui/chrome.js';
import { GALLERY_TONES } from '../../core/world.js';
import { formatRelativeTime, formatFullTime } from '../../core/worldtime.js';

export const SHOP_APP_ID = 'shop';
export const SHOP_SKIN_URL = new URL('./skin.css', import.meta.url).href;

// 车里「最近移出」小节最多列几件。
const REMOVED_LIMIT = 5;

// tone 白名单再校验一遍(双保险,同相册):生成层消化时已经白名单过一次,渲染层落笔进 data-tone 前
// 仍自己再查——IndexedDB 里可能躺着旧版本/手工改过的记录。非法值落 street。
function safeTone(tone) {
    return GALLERY_TONES.includes(tone) ? tone : 'street';
}

function genSpinnerHtml() {
    return '<span class="or-orrery-spinner"></span>'; // 天象仪加载演出,样式在 ui/shell.css
}

// qty 渲染时再钳一遍(1〜99 整数),旧记录/手改记录不能把「×NaN」画到屏幕上。
function safeQty(qty) {
    const q = Math.round(Number(qty));
    return Number.isFinite(q) ? Math.max(1, Math.min(99, q)) : 1;
}

function statusWord(status) {
    return chrome(status === 'delivered' ? 'shop.delivered' : status === 'shipped' ? 'shop.shipped' : 'shop.ordered');
}

function addedTimesText(n) {
    return chrome('shop.addedTimes').replace('{n}', String(n));
}

function renderThumb(tone) {
    return `<span class="or-shop-thumb or-shop-tone" data-tone="${safeTone(tone)}"></span>`;
}

function renderOrderItemRow(order, it, idx) {
    return `<button class="or-shop-item-row" data-action="open-shop-item" data-ref="${escapeHtml(`order:${order.orderId}:${idx}`)}">
        ${renderThumb(it.tone)}
        <span class="or-shop-item-main">
            <span class="or-shop-item-name">${escapeHtml(it.name)}</span>
            <span class="or-shop-item-sub">${escapeHtml(it.shop)} · ${escapeHtml(it.price)} × ${safeQty(it.qty)}</span>
        </span>
    </button>`;
}

function renderOrderCard(o, seenAt, shopNow) {
    const isNew = seenAt > 0 && o.ts > seenAt; // seenAt=0(从没进过)不点,整屏都是新的没必要逐张点
    const status = ['shipped', 'delivered'].includes(o.status) ? o.status : 'ordered';
    return `<div class="or-shop-order" data-worldtime="${o.latestTs}">
        <div class="or-shop-order-head">
            ${isNew ? '<span class="or-shop-new-dot"></span>' : ''}
            <span class="or-shop-order-time">${formatRelativeTime(o.worldTime, shopNow)}</span>
            <span class="or-shop-status" data-status="${status}">${escapeHtml(statusWord(status))}</span>
        </div>
        ${o.items.map((it, idx) => renderOrderItemRow(o, it, idx)).join('')}
    </div>`;
}

function renderCartRow(c, seenAt, shopNow) {
    const removed = c.state === 'removed';
    const isNew = !removed && seenAt > 0 && c.ts > seenAt;
    const sub = removed
        ? `移出于 ${formatRelativeTime(c.latestTs, shopNow)}`
        : `加入于 ${formatRelativeTime(c.firstAddTs, shopNow)}${c.addCount >= 2 ? ` · ${escapeHtml(addedTimesText(c.addCount))}` : ''}`;
    return `<button class="or-shop-cart-row${removed ? ' removed' : ''}" data-worldtime="${c.latestTs}" data-action="open-shop-item" data-ref="${escapeHtml(`cart:${c.cartItemId}`)}">
        ${renderThumb(c.tone)}
        <span class="or-shop-item-main">
            <span class="or-shop-item-name">${escapeHtml(c.name)}</span>
            <span class="or-shop-item-sub">${escapeHtml(c.shop)} · ${escapeHtml(c.price)}</span>
            <span class="or-shop-item-note">${sub}</span>
        </span>
        ${isNew ? '<span class="or-shop-new-dot"></span>' : ''}
    </button>`;
}

/**
 * Libra 列表屏:头部(返回+标题+刷新)+ 两钮 tab(購入履歴 / カート)+ 当前 tab 的内容。
 * @param tab 'orders'(缺省)| 'cart'——过滤态,存在 nav 条目 top.tab,不入导航栈
 * @param seenAt 进这个 app 那一刻的 seen 快照(整 app 一把,见 core/world.js seenKeyForShop)
 * @param busy 独立生成锁(与其他 app 并行不互斥)
 * @param shopNow 相对时间参照(world.worldClock)
 */
export function renderShopListHtml({ world, busy, tab = 'orders', seenAt = 0, shopNow }) {
    const isCart = tab === 'cart';
    const tabs = `<div class="or-shop-tabs">
        <button class="${!isCart ? 'on' : ''}" data-action="shop-select-tab" data-tab="orders">${escapeHtml(chrome('shop.orders'))}</button>
        <button class="${isCart ? 'on' : ''}" data-action="shop-select-tab" data-tab="cart">${escapeHtml(chrome('shop.cart'))}</button>
    </div>`;

    let body;
    if (!isCart) {
        const orders = [...world.shopOrders.values()].sort((a, b) => (b.worldTime || 0) - (a.worldTime || 0));
        body = orders.length
            ? `<div class="or-shop-list">${orders.map(o => renderOrderCard(o, seenAt, shopNow)).join('')}</div>`
            : `<div class="or-empty">还没有订单。点「刷新」——买了什么,不会说谎。</div>`;
    } else {
        const all = [...world.cartItems.values()];
        const inCart = all.filter(c => c.state === 'in').sort((a, b) => (b.latestTs || 0) - (a.latestTs || 0));
        const removed = all.filter(c => c.state === 'removed').sort((a, b) => (b.latestTs || 0) - (a.latestTs || 0)).slice(0, REMOVED_LIMIT);
        body = (inCart.length || removed.length)
            ? `<div class="or-shop-list">
                ${inCart.map(c => renderCartRow(c, seenAt, shopNow)).join('')}
                ${removed.length ? `<div class="or-shop-section-title">${escapeHtml(chrome('shop.removed'))}</div>${removed.map(c => renderCartRow(c, seenAt, shopNow)).join('')}` : ''}
            </div>`
            : `<div class="or-empty">购物车是空的。</div>`;
    }

    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">Libra</span>
            <button class="or-pill-btn small" data-action="shop-refresh" ${busy ? 'disabled' : ''}>${busy ? genSpinnerHtml() : '刷新'}</button>
        </div>
        ${tabs}
        ${body}`;
}

/**
 * 按 ref(`order:<orderId>:<idx>` 或 `cart:<cartItemId>`)从 world 里取出详情屏要画的东西。
 * 查无此物(已被回滚/反悔清空)返回 null,由 shell 退回网格。
 * orderId/cartItemId 由 Orrery 自发(od_/ci_ 前缀+base36),不含冒号,按冒号切是安全的。
 */
export function resolveShopItem(world, ref) {
    const parts = String(ref || '').split(':');
    if (parts[0] === 'order' && parts.length === 3) {
        const order = world.shopOrders.get(parts[1]);
        const item = order?.items[Number(parts[2])];
        return item ? { kind: 'order', order, item } : null;
    }
    if (parts[0] === 'cart' && parts.length === 2) {
        const cart = world.cartItems.get(parts[1]);
        return cart ? { kind: 'cart', cart, item: cart } : null;
    }
    return null;
}

/**
 * Libra 商品详情屏(nav push):大 tone 色块(1:1,最大宽 280)+ 商品名(+zh)+ 店铺·价格(·qty)+ desc(+descZh)+ 元信息行。
 * 返回箭头,无任何操作按钮。
 */
export function renderShopItemHtml({ resolved }) {
    const { kind, item } = resolved;
    const zh = item.zh && item.zh !== item.name ? `<div class="or-zh">${escapeHtml(item.zh)}</div>` : '';
    const descZh = item.descZh && item.descZh !== item.desc ? `<div class="or-zh">${escapeHtml(item.descZh)}</div>` : '';
    let meta;
    let priceLine = `${escapeHtml(item.shop)} · ${escapeHtml(item.price)}`;
    if (kind === 'order') {
        const { order } = resolved;
        priceLine += ` · × ${safeQty(item.qty)}`;
        meta = `${statusWord(order.status)} · 下单于 ${formatFullTime(order.worldTime)}`;
    } else {
        const { cart } = resolved;
        meta = cart.state === 'removed'
            ? `移出于 ${formatFullTime(cart.latestTs)}`
            : `加入于 ${formatFullTime(cart.firstAddTs)}${cart.addCount >= 2 ? ` · ${addedTimesText(cart.addCount)}` : ''}`;
    }
    return `
        <div class="or-header">
            <button class="or-back-btn" data-action="back">${ICON_BACK}</button>
            <span class="or-header-title">Libra</span>
        </div>
        <div class="or-shop-detail-scroll">
            <div class="or-shop-hero or-shop-tone" data-tone="${safeTone(item.tone)}"></div>
            <div class="or-shop-detail-name">${escapeHtml(item.name)}</div>
            ${zh}
            <div class="or-shop-detail-price">${priceLine}</div>
            <div class="or-shop-detail-desc">${escapeHtml(item.desc)}${descZh}</div>
            <div class="or-shop-detail-meta">${escapeHtml(meta)}</div>
        </div>`;
}
