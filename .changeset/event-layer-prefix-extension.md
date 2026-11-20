---
"rpe-redux": patch
---

### 中文

**修复**

- 事件层第一个事件的缓动曲线现在会向左延拓到第一个事件开始之前，因此没有垫底事件的谱面在 0 拍和负数拍上会按该曲线取值，而不是回落到类型默认值。例如把 quad in 的 0→300 事件放在 3–4 拍，0 拍处的值现在是 2700，整条轨迹是一条抛物线。第一个事件是钩定事件时，初始值直接取该钩定事件的值；贝塞尔事件沿起点切线延拓；轨迹事件保持起始值。事件之间的空隙不受影响，仍保持前一个事件的结束值；0 拍的垫底事件会终止延拓。

### English

**Fixes**

- The first event of a layer now extends its easing curve to the left of its own start, so a chart without a padding event follows that curve at beat zero and at negative beats instead of falling back to the channel default. A `quad in` ramp from 0 to 300 placed at beats 3-4 now reads 2700 at beat zero and traces a parabola. When the first event is hooked, the initial value is that hooked event's own value; bezier events extend along their start tangent and trajectory events hold their start value. Gaps between events are unaffected and keep holding the earlier event's end value; a padding event at beat zero ends the extension.
