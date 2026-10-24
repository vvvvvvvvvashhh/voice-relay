# Voice Relay

在 Devin 编辑器里，把 Devin 自带的语音输入转给 Claude Code 面板用。

## 用法

1. 点右下角状态栏「🎤 语音→Claude」，或按 `Ctrl+Alt+V`，开始说话（实际触发的是 Devin 的麦克风）。
2. 再按一次结束。转写完成后，文字会自动从 Devin 输入框移到 Claude 输入框。

## 要求

- Devin 编辑器（需提供 `devin.cascade.pressMicrophone` 命令）
- Claude Code 扩展

## 设置

- `voiceRelay.timeoutMs`：停止录音后等待转写的最长时间，默认 15000 毫秒。


## 适用范围

- **只能在 Devin 编辑器里使用**：依赖 Devin 提供的 `devin.cascade.pressMicrophone` 命令，在 VS Code 或其他编辑器里没有效果。
- **会覆盖剪贴板**：文字是通过剪贴板从 Devin 输入框中转到 Claude 输入框的，使用后原来的剪贴板内容会丢失。
- 语音识别由 Devin 完成，识别效果和隐私政策以 Devin 为准。
