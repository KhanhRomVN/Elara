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

ELARA.MD OPERATIONS (Project Context File)

write_to_file_elara(content) - Create/overwrite ELARA.md at project root | Use to document project structure, conventions, important files
replace_in_file_elara(diff) - Update ELARA.md | Same diff format as replace_in_file
  - ELARA.md is a project context file similar to CLAUDE.md
  - Use it to store: project overview, directory structure, key files, coding conventions, important notes
  - Update ELARA.md when discovering important project information
  - Read ELARA.md content is automatically provided in first message

EXECUTION

execute_command(command, requires_approval)
  - requires_approval: true (destructive), false (safe)
  - Supports chaining: cd dir && npm install`;
