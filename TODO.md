# Project-Level AI Assistant (Multi-File Operations) - TODO
This document outlines the plan for implementing a project-level AI assistant capable of modifying multiple files at once.
## 1. Global Chat Interface
- [ ] Add a "Global Chat" tab or toggle in the AI Assistant sidebar.
- [ ] Update `OllamaChat` to differentiate between "File Mode" (current) and "Project Mode".
- [ ] In Project Mode, the chat should not be tied to a single `activeFileId`.
## 2. Multi-File Context Gathering
- [ ] Implement a function to collect the content of all files (or a selected subset) in the current project.
- [ ] Optimize context size: allow users to explicitly @-mention files or automatically include all files if the project is small enough.
- [ ] Construct a system prompt that includes the project structure (file tree) and the contents of the relevant files.
## 3. Structured AI Output
- [ ] Design a specific prompt instruction telling the AI how to format multi-file changes.
- [ ] Example format (XML-like or Markdown blocks):
  ```xml
  <file path="src/top.v">
  // new content
  </file>
  <file path="src/top_tb.v">
  // new content
  </file>
  ```
- [ ] Write a parser to extract these file blocks from the AI's response.
## 4. Batch Merge & Review UI
- [ ] Create a `MultiFileMergeViewer` component (similar to the current propose merge, but for a list of files).
- [ ] The UI should show a list of modified files on the side, and a diff viewer in the center for the selected file.
- [ ] Add "Accept All", "Reject All", and per-file "Accept/Reject" buttons.
## 5. Execution & Integration
- [ ] Wire the parsed AI output to the `MultiFileMergeViewer`.
- [ ] Implement the logic to apply the accepted changes to the `filesData` state and save them via the API.
