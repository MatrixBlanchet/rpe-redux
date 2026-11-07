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

## 1.0.3 (2026-11-07)

### 中文

**新功能**

- 时间线设置新增「合并音符」和「在音符下显示判定线号」开关，用于多行谱面编辑。
- 「更新」设置新增「更新包下载策略」：Wi-Fi 与计量网络、仅 Wi-Fi、从不自动下载；开启自动检查或自动下载后会立即检查一次更新。
- 发现新版本且下载策略允许时，更新包会在后台自动下载：下载过程显示为可取消的后台任务，并在「更新」页显示进度和「已下载，可安装」状态。
- 更新包下载完成后会询问是否立即重启安装；选择稍后则会在关闭应用后静默安装，并显示「将在关闭应用后安装」状态。
- 录制面板新增「码率模式」：视频编码可在「标准」和「VBR 2× 峰值」之间选择，对使用视频码率的格式生效。
- 自由相机控制栏新增「视角归位」按钮，可一键恢复默认视角。
- 窗口变窄时工具栏保持按钮原始尺寸并整体横向滚动，两端出现滚动按钮，不再压缩或裁切操作。
- 快捷键设置新增「临时隐藏采样辅助线并关闭吸附」和「取消采样」两条可自定义快捷键，默认分别为 Shift 和 Esc。
- 快捷键录制支持单独使用修饰键（Shift、Ctrl、Alt、Meta）。

**修复**

- Linux 安装包恢复构建：修复了 Linux 网络状态检测中的 Rust 编译错误，该错误导致 1.0.2 的 Linux 构建失败。
- 导出对话框简化格式选择：移除格式说明段落并压缩布局。
- 时间线音符尺寸按时间线在画布中的宽度占比缩放，切换事件栏或调整栏宽后不再突然变化。
- 窄窗口下自由相机数值框保持可读宽度，不再被压扁。
- 抽屉面板的列表与属性区背景保持一致，不再透出舞台画面。
- 后台声音音量始终按当前窗口是否在前台判断；拖动「后台音量」滑杆时不会再被旧的焦点状态覆盖。
- 打击皮肤保持谱面作者设定的尺寸，不再在动画尾段额外缩小和淡出；同色的方形粒子爆发保持不变。
- 取消采样时恢复事件原有的首尾锚点，而不是清空。
- 线性等没有方向的缓动不再让方向切换控件看起来可操作，而是真正禁用。
- 创建空白谱面时不再弹出「已排队自动检测」的提示；导入音频后仍会按设置运行自动检测。

**调整**

- 音符不透明度默认值从 60% 调整为 100%，音符与事件条的不透明度设置改为百分比显示。
- 新谱面的自动检测 BPM/Offset 询问推迟到导入音频之后，创建空白谱面时不再先弹出该问题。
- 曲线编辑器的缓动预览随面板宽度自适应，在高分屏上更清晰，切换主题后自动重绘，0–1 值域补上虚线边框。
- 采样辅助线重新设计：旋转、透明度、速度改用横贯整个舞台的有界刻度，可在预览范围外继续取值；首尾锚点、拖动路径和指针读数始终可见。
- 旋转采样的取值范围从 0°–360° 改为 -180°–180°，与新的横向刻度一致。
- 移除采样设置中的「显示首尾辅助线」选项：首尾锚点始终显示，按住隐藏辅助线的快捷键（默认 Shift）只隐藏辅助网格。
- 导出格式名称统一为「RPE 格式（PEZ）」「PhiEdit 格式（PEC）」「Phigros 官方格式（JSON）」，下拉顺序调整为 RPE、PhiEdit、Phigros。
- 所有下拉选单固定在控件下方展开，不再在空间不足时翻转到上方。

**安全**

- 加固命令执行与表达式求值的边界：构建命令不再经过 shell；表达式函数改用显式映射查找，并在调用前校验解析结果确实是函数；新增安全随机数工具。

**内部改进**

- 单元测试套件按功能目录重新组织，`npm run check` 的测试发现范围保持不变。
- 界面组件不再依赖 CSS ID 选择器和跨组件 DOM 查询，改用语义类名与 React ref 表面，外观与交互保持不变。
- 补充采样、快捷键、缓动画布和工具栏溢出的单元测试。
- 更新架构文档中的采样辅助线说明。
- 移除了界面样式层的 1000px 最小宽度限制；桌面窗口的原生最小宽度仍为 1000px。
- 发布流程在下载固定版本的辅助程序失败时会重试，并在准备阶段直接报错。

### English

**Features**

- The timeline settings add “Merge notes” and “Show judge-line numbers below notes” toggles for multi-line chart editing.
- Settings → Updates adds an update package download policy: Wi-Fi and metered networks, Wi-Fi only, or never download automatically; enabling automatic checks or automatic downloads runs one update check immediately.
- When a new version exists and the policy allows it, the update package downloads in the background: the download appears as a cancellable background task, and the Updates page shows progress and a “downloaded and ready to install” state.
- Once the package is downloaded, the app asks whether to restart and install now; choosing later installs silently when the app closes and shows a “will install when the app closes” state.
- The recording panel adds a “Rate control” choice: “Standard” or “VBR 2× peak” video encoding for formats that use a video bitrate.
- The free-camera controls add a “Reset view” button that restores the default view.
- On narrow windows the toolbar keeps every action at its authored size and scrolls horizontally, revealing edge buttons instead of shrinking or clipping actions.
- The shortcut settings add two rebindable sampling actions: “Temporarily hide sampling guides and disable snapping” (default Shift) and “Cancel sampling” (default Esc).
- Shortcut recording accepts a bare modifier key such as Shift, Ctrl, Alt, or Meta.

**Fixes**

- Linux installers build again: fixed the Rust compile errors in the Linux network-status detection that broke the 1.0.2 Linux build.
- The export dialog streamlines format selection: the format hint paragraph is removed and the layout is more compact.
- Timeline note size scales from the timeline's width share of the canvas, so toggling the event field or resizing panels no longer changes note size abruptly.
- Free-camera number fields keep a readable width on narrow windows.
- The drawer list and property surfaces share one background instead of showing the stage through the form.
- Background sound volume follows the live window focus, so dragging the background-volume slider no longer applies a stale foreground state.
- Hit skins keep the size authored in the chart instead of shrinking and fading at the end of the animation; the same-colour square particle burst is unchanged.
- Cancelling a sample restores the event's original start and end anchors instead of clearing them.
- Directionless easings such as Linear now disable the direction switch instead of leaving it interactive.
- Creating a blank chart no longer shows the “timing detection queued” notice; detection still runs after audio import according to its settings.

**Changes**

- Note opacity now defaults to 100% (previously 60%), and the note and event-bar opacity settings display percentages.
- New-chart BPM/offset detection is offered after audio import instead of when the chart is created.
- Easing previews scale with the panel width, stay crisp on high-DPI screens, redraw after a theme change, and draw a dashed frame around the 0–1 value range.
- Sampling guides are redesigned: rotation, opacity, and speed use a bounded horizontal scale spanning the whole stage, and sampling can continue outside the preview; the start and end anchors, draft path, and pointer readout stay visible.
- Rotation sampling uses -180°–180° instead of 0°–360°, matching the new horizontal scale.
- The “Show start and end guides” sampling setting is removed: the anchors always show, and the hide-guides shortcut (default Shift) hides only the guide grid.
- Export format names are unified as “RPE format (PEZ)”, “PhiEdit format (PEC)”, and “Phigros official format (JSON)”, in that order.
- Every select popup opens below its control instead of flipping above when space is tight.

**Security**

- Hardened command execution and expression evaluation: build commands no longer go through a shell; expression functions are looked up through an explicit map and validated as functions before invocation; a secure random helper was added.

**Internal**

- Unit test suites are reorganised into feature folders; `npm run check` discovers the same tests.
- UI components no longer rely on CSS ID selectors or cross-component DOM lookups; they use semantic classes and React ref surfaces, with no visual or interaction change.
- Added unit tests for sampling, shortcuts, the easing canvas, and toolbar overflow.
- Documented the sampling guide behaviour in the architecture guide.
- The stylesheets no longer enforce a 1000px minimum width; the native desktop window keeps its 1000px minimum.
- The release workflow retries pinned helper downloads and fails staging early.
