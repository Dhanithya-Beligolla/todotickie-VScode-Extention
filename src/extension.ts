import * as vscode from 'vscode';

// v2 Todo interface adds id & completed
interface TodoTaskV2 {
  id: string;
  label: string;
  date: string;
  completed: boolean;
}

// Back-compat type (v1)
interface TodoTaskV1 {
  label: string;
  date: string;
}

type SortOrder = 'dueAsc' | 'dueDesc' | 'createdAsc' | 'createdDesc' | 'nameAsc' | 'nameDesc';

class TodoStorageManager {
  private readonly KEY_V2 = 'todoTasksV2';
  private readonly KEY_V1 = 'todoTasks';
  private readonly KEY_SORT = 'todoSortOrder';

  constructor(private context: vscode.ExtensionContext) {}

  async init() {
    const v2 = this.context.globalState.get<TodoTaskV2[] | undefined>(this.KEY_V2);
    if (v2 === undefined) {
      // try migrate from v1
      const v1 = this.context.globalState.get<TodoTaskV1[] | undefined>(this.KEY_V1) ?? [];
      const migrated: TodoTaskV2[] = v1.map((t) => ({ id: this.generateId(), label: t.label, date: t.date, completed: false }));
      await this.context.globalState.update(this.KEY_V2, migrated);
    }
    if (this.context.globalState.get<SortOrder | undefined>(this.KEY_SORT) === undefined) {
      await this.setSortOrder('dueAsc');
    }
  }

  getAll(): TodoTaskV2[] {
    return this.context.globalState.get<TodoTaskV2[]>(this.KEY_V2, []);
  }

  async setAll(tasks: TodoTaskV2[]) {
    await this.context.globalState.update(this.KEY_V2, tasks);
  }

  async add(label: string, date: string) {
    const tasks = this.getAll();
    tasks.push({ id: this.generateId(), label, date, completed: false });
    await this.setAll(tasks);
  }

  async toggle(id: string) {
    const tasks = this.getAll().map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    await this.setAll(tasks);
  }

  async remove(id: string) {
    const tasks = this.getAll().filter(t => t.id !== id);
    await this.setAll(tasks);
  }

  async edit(id: string, updates: Partial<Pick<TodoTaskV2, 'label' | 'date'>>) {
    const tasks = this.getAll().map(t => t.id === id ? { ...t, ...updates } : t);
    await this.setAll(tasks);
  }

  async clearCompleted() {
    const tasks = this.getAll().filter(t => !t.completed);
    await this.setAll(tasks);
  }

  private generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getSortOrder(): SortOrder {
    return this.context.globalState.get<SortOrder>(this.KEY_SORT, 'dueAsc');
  }

  async setSortOrder(order: SortOrder) {
    await this.context.globalState.update(this.KEY_SORT, order);
  }

  getAllSorted(): TodoTaskV2[] {
    const tasks = [...this.getAll()];
    const order = this.getSortOrder();
    const byDate = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const byStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    switch (order) {
      case 'dueAsc': tasks.sort((a,b) => byDate(a.date, b.date) || byStr(a.label, b.label)); break;
      case 'dueDesc': tasks.sort((a,b) => byDate(b.date, a.date) || byStr(a.label, b.label)); break;
      case 'createdAsc': /* keep insertion order */ break;
      case 'createdDesc': tasks.reverse(); break;
      case 'nameAsc': tasks.sort((a,b) => byStr(a.label, b.label)); break;
      case 'nameDesc': tasks.sort((a,b) => byStr(b.label, a.label)); break;
    }
    return tasks;
  }
}

class TodoDataProvider implements vscode.TreeDataProvider<TodoTaskV2> {
  private _onDidChangeTreeData: vscode.EventEmitter<TodoTaskV2 | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<TodoTaskV2 | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private storage: TodoStorageManager) {}

  getTreeItem(element: TodoTaskV2): vscode.TreeItem {
    const item = new vscode.TreeItem(`${element.completed ? '✓ ' : ''}${element.label} (Due: ${element.date})`, vscode.TreeItemCollapsibleState.None);
    item.contextValue = 'todoItem';
    item.tooltip = `${element.label}\nDue: ${element.date}`;
    return item;
  }

  getChildren(): TodoTaskV2[] {
    return this.storage.getAllSorted();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

class TodoSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'todotickie.sidebar';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storage: TodoStorageManager,
    private readonly onChanged: () => void,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    webviewView.webview.options = {
      enableScripts: true
    };

    const setHtml = () => {
      webviewView.webview.html = this.getHtml(webviewView.webview);
    };
    setHtml();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'getTodos': {
          webviewView.webview.postMessage({ command: 'setTodos', todos: this.storage.getAllSorted(), sortOrder: this.storage.getSortOrder() });
          break;
        }
        case 'addTodo': {
          if (!isValidDateString(message.date)) {
            vscode.window.showErrorMessage('Invalid date. Please use YYYY-MM-DD.');
            break;
          }
          await this.storage.add(message.label, message.date);
          this.notifyUpdate(webviewView);
          this.onChanged();
          break;
        }
        case 'toggleTodo': {
          await this.storage.toggle(message.id);
          this.notifyUpdate(webviewView);
          this.onChanged();
          break;
        }
        case 'deleteTodo': {
          await this.storage.remove(message.id);
          this.notifyUpdate(webviewView);
          this.onChanged();
          break;
        }
        case 'editTodo': {
          if (!isValidDateString(message.date)) {
            vscode.window.showErrorMessage('Invalid date. Please use YYYY-MM-DD.');
            break;
          }
          await this.storage.edit(message.id, { label: message.label, date: message.date });
          this.notifyUpdate(webviewView);
          this.onChanged();
          break;
        }
        case 'clearCompleted': {
          await this.storage.clearCompleted();
          this.notifyUpdate(webviewView);
          this.onChanged();
          break;
        }
        case 'setSort': {
          await this.storage.setSortOrder(message.order as SortOrder);
          this.notifyUpdate(webviewView);
          this.onChanged();
          break;
        }
      }
    });
  }

  private notifyUpdate(view: vscode.WebviewView) {
  view.webview.postMessage({ command: 'setTodos', todos: this.storage.getAllSorted(), sortOrder: this.storage.getSortOrder() });
  }

  private getHtml(webview: vscode.Webview) {
    const nonce = getNonce();
    const csp = `default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${webview.cspSource}; font-src ${webview.cspSource};`;
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="${csp}">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Todos</title>
      <style>
        :root{color-scheme: light dark;}
        body{font-family: var(--vscode-font-family); padding: 8px;}
        h2{margin: 0 0 8px 0; font-size: 16px;}
        form{display:flex; gap:6px; margin-bottom:10px;}
        input[type="text"], input[type="date"]{flex:1; padding:4px;}
        button{padding:4px 8px;}
        .toolbar{display:flex; gap:6px; margin-bottom:8px; align-items:center;}
        .list{display:flex; flex-direction:column; gap:6px;}
        .item{display:flex; align-items:center; gap:8px; padding:6px; border:1px solid var(--vscode-input-border); border-radius:4px;}
        .label{flex:1;}
        .muted{opacity:0.6; text-decoration: line-through;}
  .actions{display:flex; gap:6px;}
        .empty{opacity:0.7; font-style: italic;}
  select{padding:4px;}
  .overdue{border-color: var(--vscode-errorForeground);}
  .dueToday{border-color: var(--vscode-inputValidation-infoBorder);}
      </style>
    </head>
    <body>
      <h2>TodoTickie</h2>
      <form id="addForm">
        <input id="label" type="text" placeholder="Task description" required />
        <input id="date" type="date" required />
        <button type="submit">Add</button>
      </form>
      <div class="toolbar">
        <select id="filter">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        <select id="sort" title="Sort by">
          <option value="dueAsc">Due date (asc)</option>
          <option value="dueDesc">Due date (desc)</option>
          <option value="createdDesc">Created (newest)</option>
          <option value="createdAsc">Created (oldest)</option>
          <option value="nameAsc">Name (A-Z)</option>
          <option value="nameDesc">Name (Z-A)</option>
        </select>
        <button id="clearCompleted" title="Remove completed tasks">Clear Completed</button>
      </div>
      <div id="list" class="list"></div>

      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let todos = [];

        const $ = (s) => document.querySelector(s);
        const list = $('#list');
  const filterSel = $('#filter');
  const sortSel = $('#sort');

        function requestTodos(){ vscode.postMessage({ command: 'getTodos' }); }

        function render(){
          const filter = filterSel.value;
          list.innerHTML = '';
          let shown = todos;
          if(filter==='active') shown = todos.filter(t=>!t.completed);
          if(filter==='completed') shown = todos.filter(t=>t.completed);
          if(shown.length===0){
            const d = document.createElement('div'); d.className='empty'; d.textContent = 'No todos'; list.appendChild(d); return;
          }
          const today = new Date().toISOString().slice(0,10);
          for(const t of shown){
            const row = document.createElement('div'); row.className='item';
            const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = t.completed; cb.addEventListener('change',()=>{
              vscode.postMessage({ command: 'toggleTodo', id: t.id });
            });
            const label = document.createElement('div'); label.className='label'; label.textContent = (t.label + ' (Due: ' + t.date + ')'); if(t.completed) label.classList.add('muted');
            if(!t.completed){ if(t.date < today) row.classList.add('overdue'); else if(t.date === today) row.classList.add('dueToday'); }
            label.title = 'Click to edit';
            label.addEventListener('click', ()=> edit(t));
            const actions = document.createElement('div'); actions.className='actions';
            const editBtn = document.createElement('button'); editBtn.textContent='Edit'; editBtn.addEventListener('click',()=> edit(t));
            const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.addEventListener('click',()=>{
              vscode.postMessage({ command: 'deleteTodo', id: t.id });
            });
            actions.appendChild(editBtn); actions.appendChild(delBtn);
            row.appendChild(cb); row.appendChild(label); row.appendChild(actions);
            list.appendChild(row);
          }
        }

        function edit(t){
          const newLabel = prompt('Edit task', t.label);
          if(newLabel===null) return;
          const newDate = prompt('Edit due date (YYYY-MM-DD)', t.date);
          if(newDate===null) return;
          vscode.postMessage({ command: 'editTodo', id: t.id, label: newLabel.trim(), date: newDate.trim() });
        }

        window.addEventListener('message', (event) => {
          const msg = event.data;
          if(msg.command === 'setTodos'){
            todos = msg.todos || [];
            if (msg.sortOrder) sortSel.value = msg.sortOrder;
            render();
          }
        });

        $('#addForm').addEventListener('submit', (e)=>{
          e.preventDefault();
          const label = $('#label').value.trim();
          const date = $('#date').value;
          if(!label || !date) return;
          vscode.postMessage({ command: 'addTodo', label, date });
          $('#label').value='';
          $('#date').value='';
        });
        $('#clearCompleted').addEventListener('click', ()=>{
          vscode.postMessage({ command: 'clearCompleted' });
        });
  filterSel.addEventListener('change', render);
  sortSel.addEventListener('change', ()=>{ vscode.postMessage({ command: 'setSort', order: sortSel.value }); });

        requestTodos();
      </script>
    </body>
    </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export async function activate(context: vscode.ExtensionContext) {
  const storage = new TodoStorageManager(context);
  await storage.init();

  // Tree view (kept for Explorer view)
  const todoProvider = new TodoDataProvider(storage);
  vscode.window.registerTreeDataProvider('todoTasks', todoProvider);

  // Sidebar webview view
  const sidebarProvider = new TodoSidebarProvider(context, storage, () => todoProvider.refresh());
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TodoSidebarProvider.viewType, sidebarProvider)
  );

  // Commands
  context.subscriptions.push(vscode.commands.registerCommand('todo.addTask', async () => {
    const taskName = await vscode.window.showInputBox({ prompt: 'Enter task name' });
    if (!taskName) { return; }
    const taskDate = await vscode.window.showInputBox({ prompt: 'Enter due date (e.g., YYYY-MM-DD)' });
  if (!taskDate) { return; }
  if (!isValidDateString(taskDate)) { vscode.window.showErrorMessage('Invalid date. Please use YYYY-MM-DD.'); return; }
    await storage.add(taskName, taskDate);
    todoProvider.refresh();
    vscode.window.showInformationMessage(`Task added: ${taskName} (Due: ${taskDate})`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('todo.refresh', () => {
    todoProvider.refresh();
  }));

  // Reminders loop: notify on overdue and due-today once per day
  const timer = setInterval(async () => {
    try { await maybeNotifyDueTasks(context, storage); } catch {}
  }, 60_000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

export function deactivate() {}

function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) { return false; }
  const [y,m,d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth()+1) === m && dt.getUTCDate() === d;
}

async function maybeNotifyDueTasks(context: vscode.ExtensionContext, storage: TodoStorageManager) {
  const tasks = storage.getAllSorted();
  if (tasks.length === 0) { return; }
  const today = new Date().toISOString().slice(0,10);
  const key = 'todoLastReminderById';
  const lastMap = context.globalState.get<Record<string,string>>(key, {});
  let changed = false;
  for (const t of tasks) {
  if (t.completed) { continue; }
    if (t.date <= today) {
  if (lastMap[t.id] === today) { continue; }
      const overdue = t.date < today;
      if (overdue) {
        vscode.window.showWarningMessage(`Overdue: ${t.label} (Due ${t.date})`);
      } else {
        vscode.window.showInformationMessage(`Due today: ${t.label} (${t.date})`);
      }
      lastMap[t.id] = today;
      changed = true;
    }
  }
  if (changed) {
    await context.globalState.update(key, lastMap);
  }
}