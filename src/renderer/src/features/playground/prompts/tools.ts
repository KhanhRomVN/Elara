export const TOOLS = `TOOLS REFERENCE

FILE OPERATIONS

read_file(path, start_line?, end_line?) - Read file content (start_line/end_line: 0-based)
write_to_file(path, content) - Create/overwrite file | Wrap in \`\`\`text
replace_in_file(path, diff) - Targeted edits | Format:
  <<<<<<< SEARCH
  EXACT_OLD_CODE
  =======
  NEW_CODE
  >>>>>>> REPLACE
list_files(path, recursive?, type?) - List directory (recursive: depth 1..max, type: "only_file"|"only_folder"|"all"). if path is empty, use current directory.
search_files(path, regex) - Search files matching regex content

EXECUTION

  - requires_approval: true (destructive), false (safe)
  - Supports chaining: cd dir && npm install

CONTEXT OPERATIONS

read_workspace_context() - Read the current workspace.md content.
update_workspace_context(content) - Update the workspace.md file for this project.
read_workspace_rules_context() - Read the current workspace_rules.md content.
update_workspace_rules_context(content) - Update the workspace_rules.md file for this project.
read_current_conversation_summary_context() - Read the current conversation summary (summary.md).
update_current_conversation_summary_context(content) - Update the summary for the current conversation.`;
