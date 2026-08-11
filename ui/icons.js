// 全部图标手绘 SVG 平涂,fill 用 currentColor 交给 CSS 上色。禁 emoji、禁渐变——
// 装饰纹理(波点/浪花)也是真 SVG path/circle 平铺,不是 CSS gradient 冒充的。

export const ICON_WAND_MENU = '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="9.5" y1="15.5" x2="14.5" y2="15.5" stroke="currentColor" stroke-width="1.4"/></svg>';

export const ICON_BACK = '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_CHEVRON_RIGHT = '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_MINUS = '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
export const ICON_PLUS = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
export const ICON_UNDO = '<svg viewBox="0 0 24 24"><path d="M7 8H4V5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 8c2-3 5-5 9-5 5.5 0 9.5 4 9.5 9s-4 9-9.5 9c-3.8 0-7-2-8.6-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// 应用网格图标(24x24 viewBox,单色,由容器决定底色)
export const ICON_APP_MESSENGER = '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" fill="currentColor"/><circle cx="9" cy="9.5" r="1.15" fill="#fff"/><circle cx="12" cy="9.5" r="1.15" fill="#fff"/><circle cx="15" cy="9.5" r="1.15" fill="#fff"/></svg>';
export const ICON_APP_SETTINGS = '<svg viewBox="0 0 24 24"><path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.3M12 19.2v2.3M4.6 5.5l1.6 1.6M17.8 16.9l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 18.5l1.6-1.6M17.8 7.1l1.6-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
export const ICON_APP_FORUM = '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="6.5" y1="8" x2="17.5" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6.5" y1="11.5" x2="14" y2="11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9 15.5l-2 3.5v-3.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
export const ICON_APP_MEMO = '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="8.5" x2="16" y2="8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="8" y1="15.5" x2="13" y2="15.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
export const ICON_APP_SNS = '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.6" cy="7.4" r="1" fill="currentColor"/></svg>';
export const ICON_APP_GALLERY = '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.3" cy="9.3" r="1.6" fill="currentColor"/><path d="M4.5 17l5-5 3.5 3.5 2.5-2.8 4 4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// 状态栏装饰(纯装饰,不代表真实电量/信号)
export const ICON_SIGNAL = '<svg viewBox="0 0 18 12"><rect x="0" y="7" width="3" height="5" rx="0.6" fill="currentColor"/><rect x="5" y="4.5" width="3" height="7.5" rx="0.6" fill="currentColor"/><rect x="10" y="2" width="3" height="10" rx="0.6" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="0.6" fill="currentColor" opacity="0.4"/></svg>';
export const ICON_BATTERY = '<svg viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="21" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2.2" y="2.2" width="15" height="7.6" rx="1.2" fill="currentColor"/><rect x="22.3" y="4" width="2.2" height="4" rx="1" fill="currentColor"/></svg>';

/** 白波点纹理:小 SVG 平铺 tile,CSS background-image 用。非 gradient。 */
export function dotPatternDataUri(dotColor = '#FBF9F4', opacity = 0.55) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="5" cy="5" r="2" fill="${dotColor}" fill-opacity="${opacity}"/><circle cx="21" cy="14" r="2" fill="${dotColor}" fill-opacity="${opacity}"/><circle cx="13" cy="24" r="1.5" fill="${dotColor}" fill-opacity="${opacity}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** 扇贝浪花条:半圆 path 水平平铺 tile。 */
export function scallopWaveDataUri(color = '#FBF9F4') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><path d="M0,0 Q5,10 10,0 Q15,10 20,0 L20,10 L0,10 Z" fill="${color}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
