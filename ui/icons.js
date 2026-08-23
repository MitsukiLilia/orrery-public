// 全部图标手绘 SVG 平涂,fill 用 currentColor 交给 CSS 上色。禁 emoji、禁渐变——
// 装饰纹理(波点/浪花)也是真 SVG path/circle 平铺,不是 CSS gradient 冒充的。

export const ICON_WAND_MENU = '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="9.5" y1="15.5" x2="14.5" y2="15.5" stroke="currentColor" stroke-width="1.4"/></svg>';

export const ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
export const ICON_BACK = '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_CHEVRON_RIGHT = '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_MINUS = '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
export const ICON_PLUS = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
export const ICON_UNDO = '<svg viewBox="0 0 24 24"><path d="M7 8H4V5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 8c2-3 5-5 9-5 5.5 0 9.5 4 9.5 9s-4 9-9.5 9c-3.8 0-7-2-8.6-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// v0.7.1 SNS 统计行图标化(月月拍板):回复气泡/RT 循环箭头/⭐月相代 いいね——
// 心形太地球,星星撞 fav 收藏语义,月相既贴 Pulsar 的天文名又是这个世界自己的「共感」符号
export const ICON_REPLY_SM = '<svg viewBox="0 0 24 24"><path d="M20 6.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.3V15h.5A2.5 2.5 0 0 1 4 12.5v-6A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
export const ICON_RT_SM = '<svg viewBox="0 0 24 24"><path d="M6.5 15.5V8A2.5 2.5 0 0 1 9 5.5h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="m12.7 3 2.8 2.5-2.8 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 8.5V16a2.5 2.5 0 0 1-2.5 2.5H9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="m11.3 16-2.8 2.5 2.8 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_MOON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15Z" fill="currentColor"/></svg>';

// M2 SNS 件:锁形(locked 账号名字旁,任务书 §1/§3)/相机(配图占位框中央,任务书 §3)
export const ICON_LOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
export const ICON_CAMERA = '<svg viewBox="0 0 24 24"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-1.6h7l1 1.6h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12.7" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

// 应用网格图标(24x24 viewBox,单色,由容器决定底色)
export const ICON_APP_MESSENGER = '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" fill="currentColor"/><circle cx="9" cy="9.5" r="1.15" fill="#fff"/><circle cx="12" cy="9.5" r="1.15" fill="#fff"/><circle cx="15" cy="9.5" r="1.15" fill="#fff"/></svg>';
export const ICON_APP_SETTINGS = '<svg viewBox="0 0 24 24"><path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.3M12 19.2v2.3M4.6 5.5l1.6 1.6M17.8 16.9l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 18.5l1.6-1.6M17.8 7.1l1.6-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
export const ICON_APP_FORUM = '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="6.5" y1="8" x2="17.5" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6.5" y1="11.5" x2="14" y2="11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M9 15.5l-2 3.5v-3.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
export const ICON_APP_MEMO = '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="8.5" x2="16" y2="8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="8" y1="15.5" x2="13" y2="15.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
export const ICON_APP_SNS = '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.6" cy="7.4" r="1" fill="currentColor"/></svg>';
export const ICON_APP_GALLERY = '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.3" cy="9.3" r="1.6" fill="currentColor"/><path d="M4.5 17l5-5 3.5 3.5 2.5-2.8 4 4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// M3 浏览器「Astrolabe」:手绘星盘——外圈(星盘边缘)+ 内圈刻度环(虚线,一圈刻度的写意)+ 十字准线
// (中心枢轴四向短线,星盘的对齐基准)+ 一粒小星(rete 指针,古代星盘上用来指星位的那一点)。
export const ICON_APP_BROWSER = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4.7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="1.3 1.7"/><circle cx="12" cy="12" r="1" fill="currentColor"/><line x1="12" y1="5.6" x2="12" y2="7.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="12" y1="16.3" x2="12" y2="18.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="5.6" y1="12" x2="7.7" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="16.3" y1="12" x2="18.4" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M16.6 6.8l.9-.4.4-.9.4.9.9.4-.9.4-.4.9-.4-.9Z" fill="currentColor"/></svg>';
// 检索行前缀小图标(放大镜),尺寸家族同 ICON_REPLY_SM/ICON_RT_SM(24 viewBox,内联用时约 13〜14px)。
export const ICON_SEARCH_SM = '<svg viewBox="0 0 24 24"><circle cx="10.3" cy="10.3" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/><line x1="14.9" y1="14.9" x2="19.5" y2="19.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

// M4 相册 screenshot 角标(任务书-M4 §一):两层圆角矩形错叠,手绘写意「叠着的画面截层」——
// 后层描边、前层实心,极小尺寸下(约 14px)靠实心块保证还能辨认出是两层叠着的东西。
export const ICON_SCREENSHOT_BADGE = '<svg viewBox="0 0 24 24"><rect x="8.5" y="3.5" width="11" height="11" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4.5" y="9.5" width="11" height="11" rx="2.2" fill="currentColor"/></svg>';

// 状态栏装饰(纯装饰,不代表真实电量/信号)。
// v0.7.2 HUD 化(特色 B 案,克制极简侧):信号格→三粒渐大的星芒,电池→太阳符号☉(圆环+中心点,
// 天文学的太阳记号——Orrery 太阳系仪的中心)。这是观测仪的 HUD,不是手机自己的假件,故不写字。
export const ICON_HUD_STARS = '<svg viewBox="0 0 22 12"><path d="M2.5 7.5 4.5 9.5 2.5 11.5.5 9.5Z" fill="currentColor"/><path d="M8.5 4.7 11.3 7.5 8.5 10.3 5.7 7.5Z" fill="currentColor"/><path d="M15.5 1.9 19.1 5.5 15.5 9.1 11.9 5.5Z" fill="currentColor"/></svg>';
export const ICON_HUD_RING = '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="7" r="2.1" fill="currentColor"/></svg>';
// 地球版信号/电池已退役(v0.7.2),留档不删——想换回来 import 回去即可
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

// v0.13.0 Asterism 星图件:空心星=未收藏,实心星=已点亮(观测者的收藏符号——月相属于世界,星星属于观测者)
export const ICON_STAR = '<svg viewBox="0 0 24 24"><path d="M12 3.6l2.47 5.46 5.93.62-4.43 4.02 1.24 5.84L12 16.56l-5.21 2.98 1.24-5.84-4.43-4.02 5.93-.62Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
export const ICON_STAR_FILL = '<svg viewBox="0 0 24 24"><path d="M12 3.6l2.47 5.46 5.93.62-4.43 4.02 1.24 5.84L12 16.56l-5.21 2.98 1.24-5.84-4.43-4.02 5.93-.62Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
