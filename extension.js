const vscode = require('vscode');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// idle：空闲；recording：录音中；relaying：转写/中转中（期间忽略按键）
let state = 'idle';
let item;

const LABELS = {
  idle: '$(mic) 语音→Claude',
  recording: '$(record) 录音中…点此结束',
  relaying: '$(sync~spin) 转写中…',
};

function setState(next) {
  state = next;
  item.text = LABELS[next];
}

async function startRecording() {
  await vscode.commands.executeCommand('devin.cascade.pressMicrophone');
  setState('recording');
}

// 全选+剪切一次；如果剪到的是编辑器里的文档（焦点不在 Devin 输入框），立即还原并返回 null
async function cutDevinInput() {
  const snapshots = new Map(
    vscode.window.visibleTextEditors.map((e) => [e.document, e.document.getText()])
  );
  let hitDoc;
  const watcher = vscode.workspace.onDidChangeTextDocument((ev) => {
    // 只认「可见编辑器里的文档被删空」这一种情况，避免误伤其他程序同时在改的文件
    if (!snapshots.has(ev.document) || ev.document.getText() !== '') return;
    if (!ev.contentChanges.some((c) => c.text === '')) return;
    hitDoc = ev.document;
  });
  try {
    await vscode.commands.executeCommand('editor.action.selectAll');
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    await sleep(100);
  } finally {
    watcher.dispose();
  }
  if (hitDoc) {
    // 用剪切前的快照整体写回，不用 undo，免得撤掉别的改动
    const edit = new vscode.WorkspaceEdit();
    edit.insert(hitDoc.uri, new vscode.Position(0, 0), snapshots.get(hitDoc));
    await vscode.workspace.applyEdit(edit);
    return null;
  }
  return (await vscode.env.clipboard.readText()).trim();
}

async function stopAndRelay() {
  setState('relaying');
  const timeout = vscode.workspace.getConfiguration('voiceRelay').get('timeoutMs', 15000);
  // 先保存用户原来的剪贴板，结束后恢复
  const saved = await vscode.env.clipboard.readText();
  try {
    // 先停止 Devin 录音
    await vscode.commands.executeCommand('devin.cascade.pressMicrophone');
    await vscode.env.clipboard.writeText('');
    // 轮询：全选并剪切 Devin 输入框，直到拿到转写文字
    let text = '';
    const start = Date.now();
    while (!text && Date.now() - start < timeout) {
      await sleep(800);
      const result = await cutDevinInput();
      if (result === null) {
        vscode.window.showWarningMessage('Voice Relay：焦点不在 Devin 输入框，已撤销对编辑器的改动并停止。转写文字留在 Devin 输入框里。');
        return;
      }
      text = result;
    }
    if (!text) {
      vscode.window.showWarningMessage('Voice Relay：没等到转写结果，文字可能还留在 Devin 输入框里。');
      return;
    }
    // 粘贴到 Claude 输入框
    await vscode.commands.executeCommand('claude-vscode.focus');
    await sleep(300);
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    await sleep(300);
  } catch (e) {
    vscode.window.showErrorMessage('Voice Relay 失败：' + e.message);
  } finally {
    await vscode.env.clipboard.writeText(saved);
    setState('idle');
  }
}

function toggle() {
  if (state === 'idle') return startRecording();
  if (state === 'recording') return stopAndRelay();
  // relaying：转写中，忽略按键，避免和上一轮打架
}

function activate(context) {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  item.command = 'voiceRelay.toggle';
  item.tooltip = '按一下开始说话，再按一下结束并转到 Claude（Ctrl+Alt+V）。状态和 Devin 对不上时，运行「Voice Relay: 重置状态」';
  setState('idle');
  item.show();
  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('voiceRelay.toggle', toggle),
    // Devin 不对外暴露录音状态，只能手动把按钮复位（不会去按 Devin 的麦克风）
    vscode.commands.registerCommand('voiceRelay.reset', () => setState('idle'))
  );
}

module.exports = { activate, deactivate() {} };
