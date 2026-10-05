// 仿真平台的界面词(フォロー中/既読/更新履歴 那一挂)跟随语言档:
// zh → 中文;ja_zh(及纯 ja)→ 日文;en_zh(及纯 en)→ 英文。
// 手机自己的界面(设置、空态说明、toast)一直是中文,不归这里管——这张表只收「故事世界里那些平台」的词。
// 壳在每次 render() 开头 setChromeLanguage();各 app 与导出模板只管 chrome(key) 取词,不必层层传参。

const TABLE = {
    'sns.following':   { ja: 'フォロー中', zh: '关注中', en: 'Following' },
    'sns.recommend':   { ja: 'おすすめ', zh: '推荐', en: 'For you' },
    'sns.followCount': { ja: 'フォロー', zh: '关注', en: 'Following' },
    'sns.official':    { ja: '公式アカウント', zh: '官方账号', en: 'Official account' },
    'sns.deleted':     { ja: '元のポストは削除されました', zh: '原帖已被删除', en: 'This post was deleted' },
    'sns.search':      { ja: '検索', zh: '搜索', en: 'Search' },
    'forum.omote':     { ja: '表', zh: '表', en: 'Main' },
    'forum.ura':       { ja: '裏', zh: '里', en: 'Back' },
    'forum.uraSite':   { ja: '裏サイト', zh: '里站', en: 'Backchannel' },
    'forum.guest':     { ja: 'ゲスト', zh: '访客', en: 'Guest' },
    'msg.read':        { ja: '既読', zh: '已读', en: 'Read' },
    'alm.updates':     { ja: '更新履歴', zh: '更新记录', en: 'Update history' },
    'alm.pending':     { ja: '観測待ち', zh: '等待观测', en: 'Awaiting observation' },
    'alm.local':       { ja: '地域ニュース', zh: '本地新闻', en: 'Local News' },
    'alm.school':      { ja: 'ポータル', zh: '门户', en: 'Portal' },
    'alm.org':         { ja: 'イントラネット', zh: '内网', en: 'Intranet' },
    // M15 购物 Libra:标签页/配送状态/车内小节标题。addedTimes 的 {n} 由调用方 replace。
    'shop.orders':     { ja: '購入履歴', zh: '购买记录', en: 'Orders' },
    'shop.cart':       { ja: 'カート', zh: '购物车', en: 'Cart' },
    'shop.ordered':    { ja: '注文済み', zh: '已下单', en: 'Ordered' },
    'shop.shipped':    { ja: '発送済み', zh: '已发货', en: 'Shipped' },
    'shop.delivered':  { ja: 'お届け済み', zh: '已送达', en: 'Delivered' },
    'shop.removed':    { ja: '最近カートから削除', zh: '最近移出购物车', en: 'Recently removed' },
    'shop.addedTimes': { ja: '追加 {n} 回', zh: '加过 {n} 次', en: 'Added {n}×' },
};

// 未设置时按日文:不经过壳、直接调渲染函数的场合(测试台的纯函数断言)保持原样。
let current = 'ja';

export function chromeLangOf(language) {
    if (language === 'ja_zh' || language === 'ja') return 'ja';
    if (language === 'en_zh' || language === 'en') return 'en';
    return 'zh'; // 未知值同生成侧,落到默认的中文档
}

export function setChromeLanguage(language) { current = chromeLangOf(language); }

export function chrome(key) {
    const row = TABLE[key];
    return row ? (row[current] ?? row.ja) : key;
}
