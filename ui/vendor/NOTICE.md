# 第三方库

## modern-screenshot.umd.js

- 库名:modern-screenshot(UMD 构建产物,导出全局 `modernScreenshot`)
- 上游仓库:https://github.com/qq15725/modern-screenshot
- 许可:MIT
- 拷入日期:2026-09-01
- 来源:SillyTavern 社区扩展 html2canvas-pro 所携带的 modern-screenshot 官方 dist 产物
  (该扩展 manifest 标注其自身版本 `3.0.0`),字节级复制,`cmp`/`md5` 校验与来源文件零差异。

⚠️具体版本号:这份 UMD 构建产物文件内没有嵌入版本号或许可证头注释(bundler 产出时未保留),
`.js.map` 引用的 sourcemap 文件在来源目录里也不存在,因此无法从文件本体读出精确的
`modern-screenshot@x.y.z`。上面记录的 `3.0.0` 是搭载它的 html2canvas-pro 扩展自身版本,
不代表 modern-screenshot 库本身的版本号——这一点在任务书要求"grep 版本号"时如实核对到,
没有找到就没有编一个出来,如需精确版本请对照上游仓库的发布历史或联系该扩展作者。

## 加载策略

见 `ui/exporter.js` 顶部注释:懒加载,首次导出才注入;若酒馆已装 html2canvas-pro 扩展、
`window.modernScreenshot` 已存在则直接复用,不重复注入这份副本。
