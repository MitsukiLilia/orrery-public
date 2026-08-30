// M7c 格式化收编(8C):此前六个 app 各自揣着一份 isSameDay/formatRelativeTime/formatDateSep/
// formatClock/formatFullTime 的本地副本——同一段逻辑抄了六遍,谁也不知道别处是不是抄对了。
// 收进这一处之后,六个 app 全部 import 这里的实现,改一处、六个 app 一起改对。
// 每个函数都是从各 app 现有副本原样搬过来的,逐字未改,行为零变化(refNow 缺省 Date.now() 照旧)——
// 这不是重写,是搬家。apps 之间仍然零依赖,只是共同依赖从「各自复制」变成「都指向 core」。

/** 两个时刻是否落在同一天(本地时区)。 */
export function isSameDay(ts1, ts2) {
    const a = new Date(ts1), b = new Date(ts2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 「今天/昨天」的参照系是 refNow(手机活在故事里,不是现实时钟)——M7c 起 refNow 六个 app
// 统一传 world.worldClock(见 ui/shell.js),此前各 app 各传各的 xxxNow。
export function formatDateSep(ts, refNow) {
    const ref = refNow || Date.now();
    if (isSameDay(ts, ref)) return '今天';
    if (isSameDay(ts, ref - 86400000)) return '昨天';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 相对时间:x分钟前/x小时前/昨天/M月D日,参照系同 formatDateSep 的 refNow。
export function formatRelativeTime(ts, refNow) {
    const ref = refNow || Date.now();
    const diffMin = Math.max(0, Math.floor((ref - ts) / 60000));
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    if (isSameDay(ts, ref - 86400000)) return '昨天';
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** HH:MM,24 小时制。 */
export function formatClock(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** M月D日 HH:MM——相册/备忘录详情屏的完整时刻写法(不分今天/昨天,直接给日期)。 */
export function formatFullTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
