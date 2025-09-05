import * as vscode from 'vscode';

interface TodoTask {
  label: string;
  date: string;
}

class TodoDataProvider implements vscode.TreeDataProvider<TodoTask> {
  private _onDidChangeTreeData: vscode.EventEmitter<TodoTask | undefined | null | void> = new vscode.EventEmitter<TodoTask | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TodoTask | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  getTreeItem(element: TodoTask): vscode.TreeItem {
    return {
      label: `${element.label} (Due: ${element.date})`,
      collapsibleState: vscode.TreeItemCollapsibleState.None
    };
  }

  getChildren(): TodoTask[] {
    return this.context.globalState.get<TodoTask[]>('todoTasks', []);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

export function activate(context: vscode.ExtensionContext) {
  const todoProvider = new TodoDataProvider(context);
  vscode.window.registerTreeDataProvider('todoTasks', todoProvider);

  context.subscriptions.push(vscode.commands.registerCommand('todo.addTask', async () => {
    const taskName = await vscode.window.showInputBox({ prompt: 'Enter task name' });
    if (!taskName) return;

    const taskDate = await vscode.window.showInputBox({ prompt: 'Enter due date (e.g., YYYY-MM-DD)' });
    if (!taskDate) return;

    const tasks = context.globalState.get<TodoTask[]>('todoTasks', []);
    tasks.push({ label: taskName, date: taskDate });
    await context.globalState.update('todoTasks', tasks);

    todoProvider.refresh();
    vscode.window.showInformationMessage(`Task added: ${taskName} (Due: ${taskDate})`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('todo.refresh', () => {
    todoProvider.refresh();
  }));
}

export function deactivate() {}