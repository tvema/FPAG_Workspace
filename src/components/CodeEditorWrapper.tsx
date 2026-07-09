import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorWrapperProps {
  activeFile: string;
  filesData: Record<string, any>;
  editorTheme: string;
  handleEditorDidMount: (editor: any, monaco: any) => void;
  handleEditorBeforeMount: (monaco: any) => void;
  editorOptions: any;
  debouncedSetFilesData: (fileId: string, val: string) => void;
  breakpoints?: Record<string, number[]>;
  setBreakpoints?: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
}

const LOCAL_STORAGE_KEY = 'monaco_view_states_v1';
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
  setBreakpoints
}: CodeEditorWrapperProps) {
  const fileContent = filesData[activeFile]?.content || '';
  const [localValue, setLocalValue] = useState(fileContent);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  // Save view state when activeFile changes
  const activeFileRef = useRef(activeFile);
  useEffect(() => {
    if (editorRef.current && activeFileRef.current) {
      editorViewStates[activeFileRef.current] = editorRef.current.saveViewState();
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(editorViewStates));
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
        editorViewStates[activeFileRef.current] = editorRef.current.saveViewState();
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(editorViewStates));
        } catch (e) {
          // ignore quota errors
        }
      }
    };
  }, [activeFile]);

  useEffect(() => {
    setLocalValue(fileContent);
  }, [activeFile, fileContent]);

  const onChange = useCallback((val: string | undefined) => {
    if (val !== undefined && activeFile) {
      setLocalValue(val);
      debouncedSetFilesData(activeFile, val);
    }
  }, [activeFile, debouncedSetFilesData]);

  const updateBreakpoints = useCallback(() => {
    if (editorRef.current && monacoRef.current && breakpoints && activeFile) {
      const activeBreakpoints = breakpoints[activeFile] || [];
      const newDecorations = activeBreakpoints.map(line => ({
        range: new monacoRef.current.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'bg-red-500 rounded-full w-3 h-3 ml-1 mt-1 cursor-pointer',
        }
      }));
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        newDecorations
      );
    }
  }, [breakpoints, activeFile]);

  useEffect(() => {
    updateBreakpoints();
  }, [updateBreakpoints]);

  const handleMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    handleEditorDidMount(editor, monaco);

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
          glyphMarginClassName: 'bg-red-500 rounded-full w-3 h-3 ml-1 mt-1 cursor-pointer',
        }
      }));
      decorationsRef.current = editor.deltaDecorations([], newDecorations);
    }

    editor.onMouseDown((e: any) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position.lineNumber;
        const currentFile = activeFileRef.current;
        if (setBreakpoints && currentFile) {
          setBreakpoints(prev => {
            const current = prev[currentFile] || [];
            const newBreakpoints = current.includes(line)
              ? current.filter(l => l !== line)
              : [...current, line];
            return { ...prev, [currentFile]: newBreakpoints };
          });
        }
      }
    });
  }, [handleEditorDidMount, setBreakpoints]);

  useEffect(() => {
    const handleGotoLine = (e: any) => {
      if (e.detail && e.detail.fileId === activeFile && editorRef.current) {
        editorRef.current.revealLineInCenter(e.detail.line);
        editorRef.current.setPosition({ lineNumber: e.detail.line, column: 1 });
        editorRef.current.focus();
      }
    };
    window.addEventListener('editor-goto-line', handleGotoLine);
    return () => window.removeEventListener('editor-goto-line', handleGotoLine);
  }, [activeFile]);

  return (
    <Editor
      height="100%"
      width="100%"
      theme={editorTheme}
      onMount={handleMount}
      path={activeFile}
      language={
        ['v', 'sv', 'verilog'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'verilog' :
        ['tcl', 'sdc'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'tcl' :
        ['makefile', 'mak', 'mk', 'template'].includes(filesData[activeFile]?.type?.toLowerCase() || '') || (filesData[activeFile]?.name || '').toLowerCase() === 'makefile' || (filesData[activeFile]?.name || '').toLowerCase().includes('makefile') ? 'makefile' :
        ['c', 'h'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'c' :
        ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'cpp' :
        ['ts', 'tsx'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'typescript' :
        ['js', 'jsx'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'javascript' :
        ['json'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'json' :
        ['md', 'markdown'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'markdown' :
        ['css'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'css' :
        ['html'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'html' :
        ['sh', 'bash'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'shell' : 'plaintext'
      }
      beforeMount={handleEditorBeforeMount}
      value={localValue}
      onChange={onChange}
      options={editorOptions}
    />
  );
}
