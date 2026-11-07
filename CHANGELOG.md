# Changelog

User-visible changes for the current release. Chinese first, English second. The
release workflow publishes this section as the GitHub release body, and the
desktop changelog shows the section that matches the interface language.

Inside either language section the notes may use two inline annotations:
`@name` credits a GitHub user (rendered bold and underlined), and
`<red>text</red>` colours a run of text. The tag name is the colour: `accent`,
`red`, `yellow`, `green`, `blue`, `purple`, or `gray`. Each resolves through the
active theme, so write the name rather than a hex value. GitHub drops the unknown
tag, so the release page still reads as plain words.

## 1.0.4 (2026-11-07)

### 中文

**新功能**

- 发现新版本时，标题栏的更新角标会打开「发现新版本」说明面板，显示目标版本的发布说明，并提供「跳过此版本」「暂不更新」「现在更新」三个操作；跳过某个版本后，只有出现更新的版本才会再次提示。
- 「帮助 → 更新日志」只显示当前运行版本的发布说明，不会再切换到未来版本的内容。

**修复**

- Linux 网络状态检测补全 XDG portal 的计量网络（`GetMetered`）返回值解析，同时接受布尔与整数形式；在缺少 NetworkManager 的桌面环境下，下载策略也能正确识别计量网络。
- 抽屉列表（时序、判定线、资源）的底部操作按钮统一使用检查器内边距，与面板内容对齐并保留底部留白。
- 欢迎页「更多」菜单展开时再次点击不再重播展开动画，也不会先关闭再重新打开。
- 更换或清除自定义背景图片后，被替换的图片文件会从应用数据目录中删除；应用启动时会清理不再被引用的残留图片，且只在成功读取设置后执行。

**内部改进**

- 源代码检查新增 Linux Rust 检查：`src-tauri/` 发生变更时会运行 `cargo fmt --check` 与 `cargo check`，Rust 编译错误在合并前即可发现。
- 新增回归测试覆盖抽屉页脚内边距、背景图片引用生命周期、欢迎页菜单重复打开与更新日志的版本选择。
- 更新桌面运行时、测试与架构文档中关于更新说明和原生 CI 检查的说明。

### English

**Features**

- When an update is available, the title-bar update badge opens an "Update available" note that shows the target release's notes and offers **Skip this version**, **Later**, and **Update now**; skipping a version keeps its badge hidden until a newer release appears.
- Help → Changelog shows the running version's release notes only and never switches to a future release.

**Fixes**

- Linux network detection now parses the XDG portal metered value (`GetMetered`) in both boolean and integer forms, so download policies recognize metered networks without NetworkManager.
- Drawer list footers (Timing, Lines, Assets) share the inspector inset, aligning their actions with the panel content and keeping a bottom gap.
- A second click on the welcome page's overflow menu while it is open no longer replays the enter animation or closes and reopens it.
- Replacing or clearing a custom background now deletes the replaced image from application data, and startup removes unreferenced leftover images only after preferences load successfully.

**Internal**

- Source checks add a Linux Rust gate: changes under `src-tauri/` run `cargo fmt --check` and `cargo check`, so Rust compile errors surface before merge.
- New regression tests cover drawer footer insets, background image reference lifecycle, repeated overflow-menu activation, and changelog release selection.
- Update the desktop, testing and architecture docs for the release-notes split and the native CI gate.
