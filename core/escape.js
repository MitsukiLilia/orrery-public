// 全项目唯一的 HTML 转义(v0.11.3 把 shell.js 的安全版收编为共享模块,治六个 app 各自手搓的旧版):
// textContent→innerHTML 那套只转 & < >(序列化文本节点本就不需要转引号),而这个函数大量用在
// 属性值里(data-thread-id="${...}" 等),那些 id 是模型自由生成的字符串——一个引号就能提前闭合
// 属性、往标签里塞任意属性;Shadow DOM 只隔离样式和查询,不隔离脚本执行。
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}
