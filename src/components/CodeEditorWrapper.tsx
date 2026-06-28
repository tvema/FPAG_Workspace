import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorWrapperProps {
  activeFile: string;
  filesData: Record<string, any>;
  editorTheme: string;
  handleEditorDidMount: (editor: any, monaco: any) => void;
  handleEditorBeforeMount: (monaco: any) => void;
  editorOptions: any;
  debouncedSetFilesData: (fileId: string, val: string) => void;
}

export function CodeEditorWrapper({
  activeFile,
  filesData,
  editorTheme,
  handleEditorDidMount,
  handleEditorBeforeMount,
  editorOptions,
  debouncedSetFilesData
}: CodeEditorWrapperProps) {
  const fileContent = filesData[activeFile]?.content || '';
  const [localValue, setLocalValue] = useState(fileContent);

  useEffect(() => {
    setLocalValue(fileContent);
  }, [activeFile, fileContent]);

  const onChange = useCallback((val: string | undefined) => {
    if (val !== undefined && activeFile) {
      setLocalValue(val);
      debouncedSetFilesData(activeFile, val);
    }
  }, [activeFile, debouncedSetFilesData]);

  return (
    <Editor
      height="100%"
      width="100%"
      theme={editorTheme}
      onMount={handleEditorDidMount}
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
