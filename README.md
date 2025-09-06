# TodoTickie: Simple Todo List Extension for VS Code

TodoTickie is a lightweight VS Code extension that lets you add tasks with due dates, view and manage them in a dedicated sidebar, and keep a quick list in the Explorer view. Data is stored in VS Code's global state and persists across sessions.

## Features
- Sidebar panel to add, view, and manage todos (Activity Bar → TodoTickie)
	- Add tasks with a description and due date
	- Toggle complete/incomplete
	- Edit task description and due date
	- Delete tasks
	- Filter by All / Active / Completed
	- Clear all completed tasks
- Explorer view tree ("Todo Tasks") that stays in sync
- Optional Command Palette command ("Add Todo Task") to add quickly
- Tasks are stored in VS Code's global state for persistence

## Installation
1. Download the `.vsix` file from the [Releases](https://github.com/Dhanithya-Beligolla/todotickie-VScode-Extention/releases) page (or install from VS Code Marketplace once published).
2. In VS Code, go to Extensions view (Cmd+Shift+X on macOS / Ctrl+Shift+X on Windows/Linux), click the "..." menu, and select "Install from VSIX...".
3. Select the downloaded file.

## Usage
Two ways to work with your todos:

1) Sidebar panel (recommended)
- Open the TodoTickie view from the Activity Bar (left vertical icon bar).
- Use the form to add a task and due date.
- Manage tasks inline: toggle complete, edit, delete, filter, and clear completed.

2) Explorer view
- See a read-only list under "Todo Tasks" in the Explorer.
- Use the "Refresh" button in the view title to update if needed.

Command Palette
- Press Cmd+Shift+P / Ctrl+Shift+P → "Add Todo Task" to add a task quickly.

## Extension Settings
No settings yet. Planned options include default filters and due date formatting.

## Known Issues
- Reminders show one toast per item per day (no snooze/recurring scheduling yet).
- Sorting applies globally for now (no per-view overrides).
- Date validation accepts only YYYY-MM-DD; timezones aren’t handled explicitly.

## Release Notes
### 0.2.0
- Sorting: due date, created order, and name; persists across sessions.
- Date validation on add/edit (YYYY-MM-DD) and overdue/today highlighting.
- Reminders: daily toast for due-today and overdue items (one per item per day).

### 0.1.0
- New TodoTickie sidebar panel with add/edit/delete/toggle, filters, and clear completed.
- Explorer tree view remains and stays in sync.
- Data model update with migration to include ids and completed state.

### 0.0.1
Initial release with basic add and view functionality.

---

**Enjoy!** For issues or contributions, visit the [GitHub repo](https://github.com/Dhanithya-Beligolla/todotickie-VScode-Extention).

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
