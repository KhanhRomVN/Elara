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

CONTEXT OPERATIONS

  - Use this to store permanent information that should be remembered across sessions.

PROJECT CONTEXT UPDATES

update_workspace_rules_context(content) - Update the workspace_rules.md file for this project.
  - Use this to store project-specific rules, libraries, or coding styles.
update_workspace_context(content) - Update the workspace.md file for this project.
  - Use this to document project overview, goals, or important folder structures.
update_conversation_summary_context(content) - Update the summary of the current conversation session.
  - Use this to keep track of progress or important decisions made during the chat.

EXECUTION

execute_command(command, requires_approval)
  - requires_approval: true (destructive), false (safe)
  - Supports chaining: cd dir && npm install`;
