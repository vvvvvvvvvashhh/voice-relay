const vscode = require('vscode');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let recording = false;
let item;

function render(text) {
  item.text = text;
}

async function startRecording() {
  await vscode.commands.executeCommand('devin.cascade.pressMicrophone');
  recording = true;
  render('$(record) 录音中…点此结束');
}

async function stopAndRelay() {
  recording = false;
  render('$(sync~spin) 转写中…');
  const timeout = vscode.workspace.getConfiguration('voiceRelay').get('timeoutMs', 15000);
  try {
    // 先停止 Devin 录音
    await vscode.commands.executeCommand('devin.cascade.pressMicrophone');
    await vscode.env.clipboard.writeText('');
    // 轮询：全选并剪切 Devin 输入框，直到拿到转写文字
    let text = '';
    const start = Date.now();
    while (!text && Date.now() - start < timeout) {
      await sleep(800);
      await vscode.commands.executeCommand('editor.action.selectAll');
      await vscode.commands.executeCommand('editor.action.clipboardCutAction');
      await sleep(100);
      text = (await vscode.env.clipboard.readText()).trim();
    }
    if (!text) {
      vscode.window.showWarningMessage('Voice Relay：没等到转写结果，文字可能还留在 Devin 输入框里。');
      return;
    }
    // 粘贴到 Claude 输入框
    await vscode.commands.executeCommand('claude-vscode.focus');
    await sleep(300);
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  } catch (e) {
    vscode.window.showErrorMessage('Voice Relay 失败：' + e.message);
  } finally {
    render('$(mic) 语音→Claude');
  }
}

function activate(context) {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  item.command = 'voiceRelay.toggle';
  item.tooltip = '按一下开始说话，再按一下结束并转到 Claude（Ctrl+Alt+V）';
  render('$(mic) 语音→Claude');
  item.show();
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('voiceRelay.toggle', () => (recording ? stopAndRelay() : startRecording()))
  );
}

module.exports = { activate, deactivate() {} };
