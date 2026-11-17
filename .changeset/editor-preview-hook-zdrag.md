---
"rpe-redux": patch
---

### 中文

**修复**

- 修复 I 键第二次按下无法退出播放预览、O 键在编辑页播放时无法只隐藏编辑页的问题。
- RPE 迁移重新导入时保留并补回判定线切换的滚轮手势，避免 Ctrl+滚轮上失效。

**新增**

- 事件区按 Q 键使用与 R 键相同的放置流程，并放置钩定事件；钩定事件的首尾值保持相等且允许有长度。
- 时间轴按住 Z 键左键拖动事件或 Hold 的头部、右键拖动 Hold 的尾部进行边缘编辑；普通边缘拖动与 Ctrl+左键拖事件头、Ctrl+右键拖 Hold 尾同样可用。

### English

**Fixes**

- Make the I key leave playback preview and pause on its second press, and make O hide the editor without stopping an in-editor playback.
- Preserve and restore wheel gestures for judge-line navigation when re-importing RPE settings, so Ctrl+wheel up keeps stepping lines.

**Added**

- Use the same placement flow for Q as for R in the event area, with Q creating a hook event whose values stay locked while its span may have length.
- Hold Z and drag an event or Hold head with the primary button, or a Hold tail with the secondary button, to edit timeline edges; plain edge drags and Ctrl+left on an event head or Ctrl+right on a Hold tail also work.
