import React, { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";

interface CodeEditorWrapperProps {
  activeFile: string;
  filesData: Record<string, any>;
  editorTheme: string;
  handleEditorDidMount: (editor: any, monaco: any) => void;
  handleEditorBeforeMount: (monaco: any) => void;
  editorOptions: any;
  debouncedSetFilesData: (fileId: string, val: string) => void;
  breakpoints?: Record<string, number[]>;
  setBreakpoints?: React.Dispatch<
    React.SetStateAction<Record<string, number[]>>
  >;
}

const LOCAL_STORAGE_KEY = "monaco_view_states_v1";
const editorViewStates: Record<string, any> = (() => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
})();

export function CodeEditorWrapper({
  activeFile,
  filesData,
  editorTheme,
  handleEditorDidMount,
  handleEditorBeforeMount,
  editorOptions,
  debouncedSetFilesData,
  breakpoints,
  setBreakpoints,
}: CodeEditorWrapperProps) {
  const fileContent = filesData[activeFile]?.content || "";
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const lastKnownValue = useRef<string>(fileContent);

  const lastEditorOptionsRef = useRef(editorOptions);
  
  // Track when fileContent actually changes from props vs internal
  const lastPropFileContent = useRef(fileContent);
  const recentUserEditsRef = useRef<Set<string>>(new Set());
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });

  useEffect(() => {
    recentUserEditsRef.current.clear();
  }, [activeFile]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const prev = lastEditorOptionsRef.current;
      if (
        prev.selectionHighlight !== editorOptions.selectionHighlight ||
        prev.occurrencesHighlight !== editorOptions.occurrencesHighlight
      ) {
        const selections = editorRef.current.getSelections();
        if (selections && selections.length > 0) {
          const first = selections[0];
          editorRef.current.setSelection(
            new monacoRef.current.Selection(
              first.selectionStartLineNumber,
              first.selectionStartColumn,
              first.selectionStartLineNumber,
              first.selectionStartColumn
            )
          );
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.setSelections(selections);
            }
          }, 10);
        }
      }
      lastEditorOptionsRef.current = editorOptions;
    }
  }, [editorOptions]);

  // Save view state when activeFile changes
  const activeFileRef = useRef(activeFile);

  useEffect(() => {
    if (editorRef.current && activeFileRef.current) {
      editorViewStates[activeFileRef.current] =
        editorRef.current.saveViewState();
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify(editorViewStates),
        );
      } catch (e) {
        // ignore quota errors
      }
    }
    activeFileRef.current = activeFile;
    if (editorRef.current && editorViewStates[activeFile]) {
      editorRef.current.restoreViewState(editorViewStates[activeFile]);
    }

    return () => {
      if (editorRef.current && activeFileRef.current) {
        editorViewStates[activeFileRef.current] =
          editorRef.current.saveViewState();
        try {
          localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify(editorViewStates),
          );
        } catch (e) {
          // ignore quota errors
        }
      }
    };
  }, [activeFile]);

  const activeFileChangeRef = useRef(activeFile);

  const updateBreakpoints = useCallback(() => {
    if (editorRef.current && monacoRef.current && breakpoints && activeFile) {
      const activeBreakpoints = breakpoints[activeFile] || [];
      const newDecorations = activeBreakpoints.map((line) => ({
        range: new monacoRef.current.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName:
            "bg-red-500 rounded-full w-3 h-3 ml-1 mt-1 cursor-pointer",
        },
      }));
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        newDecorations,
      );
    }
  }, [breakpoints, activeFile]);

  useEffect(() => {
    if (activeFile !== activeFileChangeRef.current) {
      activeFileChangeRef.current = activeFile;
      if (editorRef.current) {
        editorRef.current.setValue(fileContent);
      }
      setTimeout(() => {
        if (editorRef.current && activeFileRef.current === activeFile) {
          if (editorViewStates[activeFile]) {
            editorRef.current.restoreViewState(editorViewStates[activeFile]);
          }
          updateBreakpoints();
        }
      }, 100);
    } else if (editorRef.current) {
      if (fileContent !== lastPropFileContent.current) {
        lastPropFileContent.current = fileContent;
        if (fileContent !== editorRef.current.getValue()) {
          if (recentUserEditsRef.current.has(fileContent)) {
            // Stale prop from our own debounced onChange, ignore it to prevent jumping
            recentUserEditsRef.current.delete(fileContent);
          } else {
            const position = editorRef.current.getPosition();
            if (typeof editorRef.current.executeEdits === "function") {
              const model = editorRef.current.getModel();
              if (model) {
                editorRef.current.executeEdits("external", [
                  {
                    range: model.getFullModelRange(),
                    text: fileContent,
                    forceMoveMarkers: true,
                  },
                ]);
              } else {
                editorRef.current.setValue(fileContent);
              }
            } else {
              editorRef.current.setValue(fileContent);
            }
            if (position) {
              editorRef.current.setPosition(position);
            }
          }
        }
      }
    }
  }, [activeFile, fileContent, updateBreakpoints]);

  const onChange = useCallback(
    (val: string | undefined) => {
      if (val !== undefined && activeFile) {
        recentUserEditsRef.current.add(val);
        if (recentUserEditsRef.current.size > 50) {
          const it = recentUserEditsRef.current.values();
          recentUserEditsRef.current.delete(it.next().value);
        }
        debouncedSetFilesData(activeFile, val);
      }
    },
    [activeFile, debouncedSetFilesData],
  );

  useEffect(() => {
    updateBreakpoints();
  }, [updateBreakpoints]);

  const handleMount = useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      handleEditorDidMount(editor, monaco);

      const currentFileContent =
        filesData[activeFileRef.current]?.content || "";
      if (editor.getValue() !== currentFileContent) {
        editor.setValue(currentFileContent);
      }

      if (activeFileRef.current && editorViewStates[activeFileRef.current]) {
        editor.restoreViewState(editorViewStates[activeFileRef.current]);
      }

      // Apply breakpoints immediately on mount
      if (breakpoints && activeFileRef.current) {
        const activeBreakpoints = breakpoints[activeFileRef.current] || [];
        const newDecorations = activeBreakpoints.map((line: number) => ({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: false,
            glyphMarginClassName:
              "bg-red-500 rounded-full w-3 h-3 ml-1 mt-1 cursor-pointer",
          },
        }));
        decorationsRef.current = editor.deltaDecorations([], newDecorations);
      }

      editor.onMouseDown((e: any) => {
        if (
          e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        ) {
          const line = e.target.position.lineNumber;
          const currentFile = activeFileRef.current;
          if (setBreakpoints && currentFile) {
            setBreakpoints((prev) => {
              const current = prev[currentFile] || [];
              const newBreakpoints = current.includes(line)
                ? current.filter((l) => l !== line)
                : [...current, line];
              return { ...prev, [currentFile]: newBreakpoints };
            });
          }
        }
      });

      editor.onDidChangeCursorPosition((e: any) => {
        let visualColumn = e.position.column;
        const model = editor.getModel();
        if (model) {
          const tabSize = model.getOptions().tabSize || 4;
          const lineContent = model.getLineContent(e.position.lineNumber);
          const textBeforeCursor = lineContent.substring(0, e.position.column - 1);
          
          visualColumn = 1;
          for (let i = 0; i < textBeforeCursor.length; i++) {
            if (textBeforeCursor[i] === '\t') {
              visualColumn += tabSize - ((visualColumn - 1) % tabSize);
            } else {
              visualColumn++;
            }
          }
        }

        setCursorPosition({
          lineNumber: e.position.lineNumber,
          column: visualColumn
        });
      });
    },
    [handleEditorDidMount, setBreakpoints],
  );

  useEffect(() => {
    const handleGotoLine = (e: any) => {
      if (e.detail && e.detail.fileId === activeFile && editorRef.current) {
        editorRef.current.revealLineInCenter(e.detail.line);
        editorRef.current.setPosition({ lineNumber: e.detail.line, column: 1 });
        editorRef.current.focus();
      }
    };
    window.addEventListener("editor-goto-line", handleGotoLine);
    return () => window.removeEventListener("editor-goto-line", handleGotoLine);
  }, [activeFile]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          width="100%"
          theme={editorTheme}
          onMount={handleMount}
          path={filesData[activeFile] ? `${activeFile}/${filesData[activeFile].name}` : activeFile}
          language={
            ["sv"].includes(
              filesData[activeFile]?.type?.toLowerCase() || "",
            )
              ? "systemverilog"
              : ["v", "verilog"].includes(
                    filesData[activeFile]?.type?.toLowerCase() || "",
                  )
                ? "verilog"
                : ["tcl", "sdc"].includes(
                    filesData[activeFile]?.type?.toLowerCase() || "",
                  )
                ? "tcl"
                : ["makefile", "mak", "mk", "template"].includes(
                      filesData[activeFile]?.type?.toLowerCase() || "",
                    ) ||
                    (filesData[activeFile]?.name || "").toLowerCase() ===
                      "makefile" ||
                    (filesData[activeFile]?.name || "")
                      .toLowerCase()
                      .includes("makefile")
                  ? "makefile"
                  : ["c", "h"].includes(
                        filesData[activeFile]?.type?.toLowerCase() || "",
                      )
                    ? "c"
                    : ["cpp", "cc", "cxx", "hpp", "hh", "hxx"].includes(
                          filesData[activeFile]?.type?.toLowerCase() || "",
                        )
                      ? "cpp"
                      : ["ts", "tsx"].includes(
                            filesData[activeFile]?.type?.toLowerCase() || "",
                          )
                        ? "typescript"
                        : ["js", "jsx"].includes(
                              filesData[activeFile]?.type?.toLowerCase() || "",
                            )
                          ? "javascript"
                          : ["json"].includes(
                                filesData[activeFile]?.type?.toLowerCase() || "",
                              )
                            ? "json"
                            : ["md", "markdown"].includes(
                                  filesData[activeFile]?.type?.toLowerCase() || "",
                                )
                              ? "markdown"
                              : ["css"].includes(
                                    filesData[activeFile]?.type?.toLowerCase() ||
                                      "",
                                  )
                                ? "css"
                                : ["html"].includes(
                                      filesData[activeFile]?.type?.toLowerCase() ||
                                        "",
                                    )
                                  ? "html"
                                  : ["sh", "bash"].includes(
                                        filesData[
                                          activeFile
                                        ]?.type?.toLowerCase() || "",
                                      )
                                    ? "shell"
                                    : "plaintext"
          }
          beforeMount={handleEditorBeforeMount}
          value={undefined}
          onChange={onChange}
          options={editorOptions}
        />
      </div>
      <div className="h-6 flex items-center justify-end px-4 bg-[#1e1e1e] border-t border-black/20 text-xs text-slate-400 font-mono select-none">
        Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
      </div>
    </div>
  );
}
