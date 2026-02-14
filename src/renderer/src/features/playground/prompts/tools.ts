export const TOOLS = `TOOLS REFERENCE & CONSTRAINTS

CRITICAL RULES:
1. READ-THEN-STOP: If you need to see a file's content before editing it, you MUST call read_file() and then STOP your response. Do NOT call replace_in_file() or write_to_file() in the same turn as read_file(). You must wait for the system to provide the file content in the next turn.
2. NO GUESSING: Never guess the content, indentation, or line numbers of a file. Always read it first.
3. PRECISION: replace_in_file() requires 100% exact match including all whitespace/indentation. Any slight mismatch in the SEARCH block will cause the tool to fail.
4. EXPLORATION: Use list_files() to see the project structure, then read_file() to see content, THEN edit.

FILE OPERATIONS

read_file(path, start_line?, end_line?) - Read file content. RULE: When calling this, do not call any write/replace tools in the same response.
write_to_file(path, content) - Create/overwrite file.
replace_in_file(path, diff) - Targeted edits. Rules:
  - You MUST HAVE RECEIVED the file content in a PREVIOUS turn.
  - The SEARCH block must match THE ENTIRE block you want to replace, including its indentation.
  Format:
  <<<<<<< SEARCH
  EXACT_OLD_CODE
  =======
  NEW_CODE
  >>>>>>> REPLACE

list_files(path, recursive?, type?) - List directory.
search_files(path, regex) - Search files matching regex content.

EXECUTION

  - requires_approval: true (destructive), false (safe)
  - Supports chaining: cd dir && npm install

CONTEXT OPERATIONS

read_workspace_context() - Read current workspace.md.
update_workspace_context(content) - Update workspace.md.
read_workspace_rules_context() - Read current workspace_rules.md.
update_workspace_rules_context(content) - Update workspace_rules.md.
read_current_conversation_summary_context() - Read summary.md.
update_current_conversation_summary_context(content) - Update summary.md.

CONVERSATION SUMMARY BEST PRACTICES:
- USE context summary tools for complex, multi-step tasks that span many turns.
- UPDATE the summary after significant milestones or when the context becomes dense.
- SKIP summary updates for trivial tasks (e.g., writing a single README file, simple function additions, or quick questions).
- DO NOT use summary tools if the task is self-contained and easily fits in standard context window.

MANDATORY TAGS (Zero Exception):
- <task_progress>: You MUST create or update this tag BEFORE performing any work or tool calls (even for minor changes). Use it to track goals and progress in the Sidebar.
- <text>: Use for main conversational responses.
- <temp>: Use for status updates that should be hidden from the UI.
- <file>: Use to cite files in the <text> block.`;
