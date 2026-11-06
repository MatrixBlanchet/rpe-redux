/** Simplified Chinese catalog for context-free words shared across every surface. */
export default {
  "common.appName": "RPE Redux",

  "common.action.cancel": "取消",
  "common.action.previous": "上一步",
  "common.action.next": "下一步",
  "common.action.finish": "完成",
  "common.action.apply": "应用",
  "common.action.confirm": "确认",
  "common.action.close": "关闭",

  "common.action.save": "保存",
  "common.action.delete": "删除",

  "common.action.rename": "重命名",
  "common.action.restore": "恢复",
  "common.action.resetField": "将{name}恢复为默认值",
  "common.action.resetHint": "恢复默认值",
  "common.action.retry": "重试",

  "common.action.clear": "清空",
  "common.action.clearSearch": "清空搜索",
  "common.action.copy": "复制",
  "common.action.expand": "展开",
  "common.action.collapse": "收起",
  "common.action.move": "移动",
  "common.action.reorder": "排序",

  "common.action.paste": "粘贴",
  "common.action.undo": "撤销",
  "common.action.redo": "重做",

  "common.language": "语言",
  "common.language.hint": "对整个界面生效，无需重启。",

  "common.settings.title": "设置",
  "common.settings.search": "搜索设置项…",

  "extensions.parameters.required": "此项为必填项。",
  "extensions.parameters.number.invalid": "请输入有效数字。",
  "extensions.parameters.number.minimum": "数值必须至少为 {min}。",
  "extensions.parameters.number.maximum": "数值必须至多为 {max}。",
  "extensions.parameters.number.step": "数值步进必须为 {step}。",
  "extensions.parameters.boolean.invalid": "请选择 true 或 false。",
  "extensions.parameters.judgeLine.invalid": "请选择有效的判定线。",
  "extensions.parameters.judgeLine.count": "此参数需要恰好 {count} 条判定线。",
  "extensions.parameters.judgeLine.range": "请至少提供 {count} 条候选判定线用于随机选择。",
  "extensions.parameters.judgeLine.unavailable": "当前谱面中没有足够的判定线（需要 {count} 条）。",
  "extensions.parameters.text.invalid": "请输入文本。",
  "extensions.parameters.text.multiline": "此处不允许换行。",
  "extensions.parameters.text.tooLong": "最多输入 {maxLength} 个字符。",
  "extensions.parameters.select.invalid": "请选择可用选项之一。",
  "extensions.parameters.color.invalid": "请输入 #rrggbb 格式的颜色。",
  "extensions.parameters.beat.invalid": "请输入有效拍数。",
  "extensions.parameters.expression.invalid": "表达式无效：{detail}",
  "extensions.parameters.expression.legend.notes": "notes 词汇：上方字段是所选音符的只读数值。",
  "extensions.parameters.expression.legend.events": "events 词汇：上方字段是所选事件的只读数值。",
  "extensions.parameters.expression.legend.indices":
    "音符的 n 从 0 开始，事件的 n 从 1 开始；i 始终从 0 开始，N 是组内数量。",
  "extensions.parameters.expression.legend.progress":
    "过滤条件中的 u 按过滤前的组计算；取值或脚本中的 u 按过滤后的组计算。",
  "extensions.parameters.expression.legend.aliases":
    "字段列表包含别名：t/t1/st.time 共同表示起始拍，start/st.x 共同表示事件起始值，音符的 v/w/width/yoffset/vt 对应音符字段。",
  "extensions.parameters.expression.legend.functions":
    "函数由批处理编译器提供；上方函数列表是唯一依据。",
  "extensions.runLog.saveFailed": "无法保存脚本运行记录；脚本运行结果不受影响。",
} as const;
