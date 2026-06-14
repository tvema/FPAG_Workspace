import { Link, Box, FolderPlus, FilePlus, Upload } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import Editor from '@monaco-editor/react';

import { useInterval } from './hooks/useInterval';
import { useCustomDialogs } from './hooks/useCustomDialogs';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { OllamaChat } from './components/OllamaChat';
import { GitCommitDialog } from './components/GitCommitDialog';
import { MessageOverlay } from './components/MessageOverlay';
import { DiffViewerModal } from './components/DiffViewerModal';
import { GitDiffModal } from './components/GitDiffModal';
import { WaveformViewerViewState } from './components/WaveformViewer';
import { TestbenchDialog } from './components/TestbenchDialog';
import { defaultVerilogMake, defaultCppMake } from './utils/templates';
import { parseVerilog } from './utils/verilogParser';
import { MarkdownWrapper } from './components/MarkdownWrapper';
import { VCDWrapper } from './components/VCDWrapper';
import { VCDScopeTree } from './components/VCDScopeTree';
import { initialFiles } from './utils/initialFiles';
import { BuildOutputPanel } from './components/BuildOutputPanel';
import { TabsBar } from './components/TabsBar';
import { ProjectTree, TreeNode } from './components/ProjectTree';
import { Header } from './components/Header';

import { VerilogDiagramViewer } from './components/VerilogDiagramViewer';
import { VerilogASTViewer } from './components/VerilogASTViewer';

const ResizeObserverErrorPatch = () => {
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || e.message === 'ResizeObserver loop limit exceeded') {
        const errContainer = document.getElementById('webpack-dev-server-client-overlay');
        if (errContainer) {
            errContainer.style.display = 'none';
        }
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);
  return null;
};

export default function App() {
  const [filesData, setFilesData] = useState<Record<string, {name: string, path: string, type: string, content: string, is_link?: boolean, is_modified?: boolean}>>({});
  const [activeFile, setActiveFile] = useState<string>('');
  const [openedTabs, setOpenedTabs] = useState<string[]>([]);
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});
  const [fileUIStates, setFileUIStates] = useState<Record<string, { explorerWidth?: number, isTextMode?: boolean, isDiagramMode?: boolean, vcd?: WaveformViewerViewState, diagramSelectedNet?: string }>>({});
  const { customPrompt, customConfirm, customMultiChoice, customDialogsNode } = useCustomDialogs();
  
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  const fetchGitStatus = useCallback(async () => {
     if (!activeProject) return;
     try {
       const res = await fetch(`/api/git/status?projectId=${activeProject}`);
       if (res.ok) {
         const data = await res.json();
         setGitStatus(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
            return data;
         });
       }
     } catch (e) {
       console.error("Failed to fetch git status", e);
     }
  }, [activeProject]);

  useInterval(fetchGitStatus, 3000);
  useEffect(() => { fetchGitStatus(); }, [fetchGitStatus]);
  
  const updateFileUI = (fileId: string, updater: (prev: any) => any) => {
     setFileUIStates(prev => ({ ...prev, [fileId]: updater(prev[fileId] || {}) }));
  };
  
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [proposedMergeCode, setProposedMergeCode] = useState<string | null>(null);

  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);

  const [editorTheme, setEditorTheme] = useState<string>('vs-dark');
  const [showMinimap, setShowMinimap] = useState<boolean>(false);
  const [lineJumpTarget, setLineJumpTarget] = useState<number | string | null>(null);
  const editorRef = React.useRef<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const [testbenchDialog, setTestbenchDialog] = useState<{
    isOpen: boolean;
    parentPath: string;
    filesToInclude: string[];
    tbName: string;
  }>({ isOpen: false, parentPath: '', filesToInclude: [], tbName: 'tb_module' });

  const [buildDialog, setBuildDialog] = useState<{
    isOpen: boolean;
    logs: string[];
    error: string | null;
  }>({ isOpen: false, logs: [], error: null });
  const [isBuildingLocal, setIsBuildingLocal] = useState(false);

  const [gitCommitDialogState, setGitCommitDialogState] = useState(false);
  const [gitMessageOpen, setGitMessageOpen] = useState(false);
  const [gitMessageContent, setGitMessageContent] = useState<any>(null);

  const [gitDiffModalState, setGitDiffModalState] = useState<{isOpen: boolean, content: string}>({isOpen: false, content: ''});

  const isDraggingLeftPanel = useRef(false);
  const draggingSizeRef = useRef<number>(25);
  const [chatWidth, setChatWidth] = useState<number>(25);

  const isVCDMode = activeFile && ['vcd'].includes(filesData[activeFile]?.type?.toLowerCase() || '') && !fileUIStates[activeFile]?.isTextMode;
  const isSVMode = activeFile && ['v', 'sv', 'verilog'].includes(filesData[activeFile]?.type?.toLowerCase() || '') && fileUIStates[activeFile]?.isDiagramMode;

  const fetchGitDiffForActiveFile = async () => {
    if (!activeFile || !filesData[activeFile]) return;
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject, action: 'show', path: filesData[activeFile].path })
      });
      const data = await res.json();
      if (data.success && data.content !== null) {
        setGitDiffModalState({ isOpen: true, content: data.content });
      } else {
        alert("Could not fetch original file from git. Maybe it hasn't been committed yet?");
      }
    } catch(e) {
      console.error(e);
      alert("Error fetching diff");
    }
  };

  useEffect(() => {
    if (lineJumpTarget !== null && editorRef.current) {
         setTimeout(() => { // wait for editor to apply model if active file just changed
             const model = editorRef.current.getModel();
             if (!model) return;
             if (typeof lineJumpTarget === 'number') {
                 editorRef.current.revealLineInCenter(lineJumpTarget);
                 editorRef.current.setPosition({ lineNumber: lineJumpTarget, column: 1 });
                 editorRef.current.focus();
                 setLineJumpTarget(null);
             } else {
                 const searchString = lineJumpTarget.split('\n')[0].trim();
                 const matches = model.findMatches(searchString, false, false, false, null, true);
                 if (matches && matches.length > 0) {
                     editorRef.current.revealLineInCenter(matches[0].range.startLineNumber);
                     editorRef.current.setPosition({ lineNumber: matches[0].range.startLineNumber, column: 1 });
                     editorRef.current.focus();
                     setLineJumpTarget(null);
                 }
             }
         }, 150);
    }
  }, [activeFile, lineJumpTarget]);

  const handleEditorDidMount = React.useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  const editorOptions = useMemo(() => ({
    minimap: { enabled: showMinimap },
    fontSize: 13,
    scrollBeyondLastLine: false,
    wordWrap: 'off' as const,
    smoothScrolling: false,
  }), [showMinimap]);

  const handleEditorBeforeMount = useCallback((monaco: any) => {
    if (!monaco.languages.getLanguages().some((l: any) => l.id === 'makefile')) {
      monaco.languages.register({ id: 'makefile' });
      monaco.languages.setMonarchTokensProvider('makefile', {
        tokenizer: {
          root: [
            [/^[a-zA-Z0-9_.-]+:/, 'keyword'],
            [/^\s*#.*$/, 'comment'],
            [/\$\([a-zA-Z0-9_.-]+\)/, 'variable'],
            [/\$\{[a-zA-Z0-9_.-]+\}/, 'variable'],
            [/=/, 'operator'],
            [/\b(if|ifeq|else|endif)\b/, 'keyword'],
            [/".*?"/, 'string'],
            [/'.*?'/, 'string'],
          ]
        }
      });
    }
  }, []);

  const handleEditorChange = useCallback((val: string | undefined) => {
    if (val !== undefined && activeFile) {
      setFilesData(prev => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], content: val, is_modified: true }
      }));
    }
  }, [activeFile, setFilesData]);

  const handleImportZip = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const importChoice = await customMultiChoice(
           'Import ZIP Options', 
           'Choose how you want to import the ZIP file contents.', 
           [
              { label: 'Create New Project', value: 'new', variant: 'primary' },
              { label: 'Overwrite Current', value: 'overwrite', variant: 'danger' },
              { label: 'Cancel', value: 'cancel', variant: 'secondary' }
           ]
        );
        
        if (!importChoice || importChoice === 'cancel') return;
        
        let targetProjId = activeProject;
        
        if (importChoice === 'new') {
            const defaultName = file.name ? file.name.replace(/\.zip$/i, '') : "Imported Project";
            const name = await customPrompt("Enter new project name:", defaultName);
            if (!name) return;
            
            const newProjId = `proj_${Date.now()}`;
            await fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: newProjId, name })
            }).catch(console.error);
            setProjects(prev => [{id: newProjId, name}, ...prev]);
            targetProjId = newProjId;
        } else if (importChoice === 'overwrite') {
            if (!activeProject) return;
            const confirmOverwrite = await customConfirm('Are you sure?', 'All files in the current project will be permanently deleted.');
            if (!confirmOverwrite) return;
            
            // Delete all current files on server
            Object.keys(filesData).forEach(id => {
                fetch(`/api/files/${id}`, { method: 'DELETE' }).catch(console.error);
            });
            // Clear UI state
            setFilesData({});
            setOpenedTabs([]);
            setActiveFile('');
        }
        
        try {
            const zip = await JSZip.loadAsync(file);
            
            for (const [path, zipEntry] of Object.entries(zip.files)) {
                if (!zipEntry.dir) {
                    if (path.includes('__MACOSX') || path.includes('.DS_Store')) continue;
                    
                    const content = await zipEntry.async('string');
                    const cleanPath = path.replace(/\\/g, '/'); // normalize backslashes
                    if (targetProjId) {
                       await handleAddFile(cleanPath, content, targetProjId);
                    }
                }
            }
            
            if (targetProjId && targetProjId !== activeProject) {
                setActiveProject(targetProjId); // This will trigger useEffect to reload files!
            }
            
        } catch (err) {
            console.error("Failed to parse ZIP", err);
            alert("Failed to read ZIP file.");
        }
    };
    input.click();
  };

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      
      // Add files to zip
      Object.values(filesData).forEach(file => {
        if (!file.path.endsWith('.gitkeep')) {
           zip.file(file.path, file.content);
        }
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workspace.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export ZIP", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRunMake = async () => {
    if (Object.values(filesData).some(f => f.is_modified)) {
      alert("Please save all modified files before running Make.");
      return;
    }
    setIsBuildingLocal(true);
    
    // Determine working directory for make
    let workDir = '';
    if (activeFile && filesData[activeFile]) {
       const activePath = filesData[activeFile].path;
       const parts = activePath.split('/');
       parts.pop(); // remove file name
       workDir = parts.join('/');
       
       // Traverse up to find a Makefile
       while (workDir.length > 0) {
           const prefix = workDir + '/';
           const hasMakefile = Object.values(filesData).some(f => f.path === prefix + 'Makefile');
           if (hasMakefile) break;
           const pathParts = workDir.split('/');
           pathParts.pop();
           workDir = pathParts.join('/');
       }
       // If empty, check root
       if (workDir === '') {
           const hasRootMake = Object.values(filesData).some(f => f.path === 'Makefile');
           if (!hasRootMake) {
               // Make might fail, but let's just use root
           }
       }
    }

    const logPrefix = workDir ? `[${workDir}] ` : '';
    setBuildDialog({ isOpen: true, logs: [`${logPrefix}Syncing files and running Make...`], error: null });
    
    try {
      const response = await fetch('/api/build/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject || 'default', target: '', workDir })
      });
      
      const data = await response.json();
      const outputLines = data.output ? data.output.split('\n') : [];
      
      if (!response.ok) {
        throw new Error(data.output || data.error || `Server returned ${response.status}`);
      }
      
      setBuildDialog(prev => ({ 
        ...prev, 
        logs: [...prev.logs, ...outputLines] 
      }));
      
      // Reload any linked files (like VCD output)
      const linkFiles = Object.entries(filesData).filter(([_, f]) => f.is_link);
      for (const [id, f] of linkFiles) {
        try {
          const res = await fetch(`/api/build/local/file?projectId=${activeProject}&path=${encodeURIComponent(f.path)}`);
          if (res.ok) {
            const data = await res.json();
            setFilesData(prev => ({ ...prev, [id]: { ...f, content: data.content } }));
          }
        } catch (e) {
          console.error("Failed to fetch link file:", e);
        }
      }
    } catch (err: any) {
      console.error('Local build failed:', err);
      const outputLines = err.message ? err.message.split('\n') : [];
      setBuildDialog(prev => ({ 
        ...prev, 
        error: "Make process failed.",
        logs: [...prev.logs, ...outputLines] 
      }));
    } finally {
      setIsBuildingLocal(false);
    }
  };

  const saveFileDirect = useCallback((id: string, fileObj: any, projId: string) => {
      return fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, project_id: projId, ...fileObj })
      }).catch(err => console.error("Failed to save file remotely", err));
  }, []);

  const saveFile = useCallback(async (id: string) => {
    if (!activeProject || !filesData[id] || !filesData[id].is_modified) return;
    await saveFileDirect(id, filesData[id], activeProject);
    setFilesData(prev => ({
      ...prev,
      [id]: { ...prev[id], is_modified: false }
    }));
  }, [activeProject, filesData, saveFileDirect]);

  const saveAllFiles = useCallback(async () => {
    if (!activeProject) return;
    const modifiedIds = Object.keys(filesData).filter(id => filesData[id].is_modified);
    await Promise.all(modifiedIds.map(async id => {
      await saveFileDirect(id, filesData[id], activeProject);
      setFilesData(prev => ({
        ...prev,
        [id]: { ...prev[id], is_modified: false }
      }));
    }));
  }, [activeProject, filesData, saveFileDirect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'ы')) {
        e.preventDefault();
        e.stopPropagation();
        if (activeFile) {
          saveFile(activeFile);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [saveFile, activeFile]);

  // Load Projects on mount
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
         if (data && data.length > 0) {
           setProjects(data);
           setActiveProject(data[0].id);
         }
      })
      .catch(console.error);
  }, []);

  // Load files when active project changes
  useEffect(() => {
    if (!activeProject) return;

    fetch(`/api/projects/${activeProject}/files`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const parsed = data.reduce((acc: any, f: any) => {
            f.is_link = Boolean(f.is_link);
            acc[f.id] = f;
            return acc;
          }, {});
          
          let aiContextExists = Object.values(parsed).some((f: any) => f.path === 'ai_context.md');
          if (!aiContextExists) {
             const aiContextId = `ai_context_${Date.now()}`;
             const aiContextFile = {
                name: 'ai_context.md',
                path: 'ai_context.md',
                type: 'markdown',
                content: '# Global AI Project Configuration\n\nThis is a global prompt for all files generated by the AI.\nWrite your general instructions here.'
             };
             parsed[aiContextId] = aiContextFile;
             fetch('/api/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: aiContextId, project_id: activeProject, ...aiContextFile })
             }).catch(console.error);
          }

          setFilesData(parsed);
          const firstKey = Object.keys(parsed)[0];
          if (firstKey) {
            setActiveFile(firstKey);
            setOpenedTabs([firstKey]);
          } else {
            setActiveFile('');
            setOpenedTabs([]);
          }
        } else {
          // If default project is empty, seed it
          if (activeProject === 'default') {
             const seeded: Record<string, any> = {};
             Object.entries(initialFiles).forEach(([id, f]) => {
               seeded[id] = f;
               fetch('/api/files', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ id, project_id: activeProject, ...f })
               }).catch(e => console.error("Could not seed data", e));
             });
             setFilesData(seeded);
             const first = Object.keys(seeded)[0];
             setActiveFile(first || '');
             setOpenedTabs(first ? [first] : []);
          } else {
             setFilesData({});
             setActiveFile('');
             setOpenedTabs([]);
          }
        }
      })
      .catch(err => console.error('Failed to load files from server', err));
  }, [activeProject]);

  const fileList = useMemo(() => Object.entries(filesData).map(([id, f]) => ({id, ...f})), [filesData]);
  
  const treeRoot = useMemo(() => {
    const root: Record<string, TreeNode> = {};
    fileList.forEach(f => {
        const parts = f.path.split('/');
        let currentLevel = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const currentPath = parts.slice(0, i + 1).join('/');
            
            if (isFile) {
               const fileNode: TreeNode = { name: part, path: currentPath, type: 'file', fileId: f.id, is_link: f.is_link, children: {} };
               currentLevel[part] = fileNode;
               
               // If it's a Verilog file, parse and add module nodes
               if (part.endsWith('.v') || part.endsWith('.sv')) {
                  try {
                      const modules = parseVerilog(f.content || '');
                      modules.forEach(mod => {
                          const modName = mod.name;
                          const modPath = `${currentPath}:${modName}`;
                          const modNode: TreeNode = { 
                              name: modName, 
                              path: modPath, 
                              type: 'module', 
                              content: mod.header,
                              fileId: f.id,
                              lineStart: mod.lineStart,
                              children: {} 
                          };
                          
                          mod.signals.forEach(sig => {
                              modNode.children[sig.name] = {
                                  name: sig.name,
                                  path: `${modPath}:${sig.name}`,
                                  type: sig.ioType || sig.type,
                                  content: sig.declaration,
                                  fileId: f.id,
                                  lineStart: sig.lineStart,
                                  children: {}
                              };
                          });
                          
                          fileNode.children[modName] = modNode;
                      });
                  } catch (e) {
                      console.error("Failed to parse Verilog file for modules:", f.path);
                  }
               }
            } else {
               if (!currentLevel[part]) {
                  currentLevel[part] = { name: part, path: currentPath, type: 'folder', children: {} };
               }
               currentLevel = currentLevel[part].children;
            }
        }
    });
    return root;
  }, [fileList]);

  const handleEditTemplate = async (type: 'v' | 'cpp') => {
      const ext = type === 'v' ? 'v' : 'cpp';
      const path = `templates/Makefile.${ext}.template`;
      const defaultContent = type === 'v' ? defaultVerilogMake : defaultCppMake;
      
      const existingFileId = Object.keys(filesData).find(key => filesData[key].path === path);
      if (!existingFileId) {
          await handleAddFile(path, defaultContent);
      } else {
          if (!openedTabs.includes(existingFileId)) {
              setOpenedTabs(prev => [...prev, existingFileId]);
          }
          setActiveFile(existingFileId);
      }
  };

  const handleAddFile = async (path: string, content: string, projId?: string, is_link?: boolean, openTab: boolean = true) => {
      const targetProj = projId || activeProject;
      const id = `${targetProj}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const name = path.split('/').pop() || id;
      const type = path.split('.').pop() || 'txt';
      const fileObj = { name, path, content, type, is_link };
      
      setFilesData(prev => ({
          ...prev,
          [id]: fileObj
      }));
      if (openTab) {
          setActiveFile(id);
          setOpenedTabs(prev => prev.includes(id) ? prev : [...prev, id]);
      }

      if (targetProj && !is_link) await saveFileDirect(id, fileObj, targetProj);
      else if (targetProj && is_link) {
          // save link file explicitly using saveFileDirect with its flag
          fetch('/api/files', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ id, project_id: targetProj, ...fileObj })
          }).catch(console.error);
      }
  };

  const handleCreateTestbench = async (tbName: string, filesToInclude: string[], makefileTemplate: string, tbExt: string) => {
      const parent = testbenchDialog.parentPath;
      const tbFolder = parent + tbName + '/';

      // 1. Generate testbench file
      const tbPath = tbFolder + tbName + tbExt;
      let tbContent = '';
      if (tbExt === '.v') {
         tbContent = `\`timescale 1ns / 1ps

module ${tbName};

    // Auto-generated Testbench for ${tbName}
    // Add your signals and instantiation here
    
    initial begin
\`ifdef VCD_FILE
        $dumpfile(\`VCD_FILE);
\`else
        $dumpfile("${tbName}.vcd");
\`endif
        $dumpvars(0, ${tbName});
        
        // Simulation logic
        #100;
        
        $finish;
    end

endmodule
`;
      } else {
         tbContent = `#include <iostream>
#include <verilated.h>
// Include your verilated model header here:
// #include "V${tbName}.h"

int main(int argc, char** argv) {
    Verilated::commandArgs(argc, argv);
    // V${tbName}* top = new V${tbName};
    
    // while (!Verilated::gotFinish()) {
    //     top->eval();
    // }
    
    // delete top;
    std::cout << "Testbench completed." << std::endl;
    return 0;
}
`;
      }
      await handleAddFile(tbPath, tbContent, activeProject || undefined);

      // 2. Generate Makefile
      const makefilePath = tbFolder + 'Makefile';
      
      const mappedFiles = filesToInclude.map(f => {
          if (f.startsWith(parent)) {
              return '../' + f.slice(parent.length);
          }
          const depth = tbFolder.split('/').filter(Boolean).length;
          const up = '../'.repeat(depth);
          return up + f;
      });

      const makefileContent = makefileTemplate
          .replace(/\{\{tbName\}\}/g, tbName)
          .replace(/\{\{files\}\}/g, mappedFiles.join(' '));

      await handleAddFile(makefilePath, makefileContent, activeProject || undefined);

      // 3. Create a link to the output VCD file
      const vcdPath = tbFolder + tbName + '.vcd';
      await handleAddFile(vcdPath, 'Waiting for generated VCD file after Make...', activeProject || undefined, true);

      // 4. Save tb_config.json
      const tbConfigPath = tbFolder + 'tb_config.json';
      const tbConfigData = {
          tbName,
          filesToInclude: [...filesToInclude, tbPath],
          tbExt,
          vcdName: tbName + '.vcd'
      };
      await handleAddFile(tbConfigPath, JSON.stringify(tbConfigData, null, 2), activeProject || undefined);
  };

  const handleGitAction = async (action: 'init' | 'add' | 'rm' | 'commit', path?: string, commitMessage?: string) => {
    if (action === 'commit' || action === 'add' || action === 'init') {
      if (Object.values(filesData).some(f => f.is_modified)) {
        alert("Please save all modified files before performing Git actions.");
        return;
      }
    }
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject, action, path, commitMessage })
      });
      if (res.ok) {
         fetchGitStatus();
         const data = await res.json();
         if (action === 'commit' && data.commitResult) {
            setGitMessageContent(data.commitResult);
            setGitMessageOpen(true);
         }
      } else {
         const data = await res.json();
         setGitMessageContent(`Error: ${data.error}`);
         setGitMessageOpen(true);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleFileUploadMenu = (targetPath: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = async (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (!files) return;
          
          for (const file of Array.from(files)) {
              let finalName = file.name;
              let fullPath = targetPath ? `${targetPath}/${finalName}` : finalName;
              
              const isCollision = () => Object.values(filesData).some(f => f.path === fullPath);
              
              if (isCollision()) {
                 const newName = await customPrompt(`File "${fullPath}" already exists. Enter a new name, or leave same to overwrite:`, finalName);
                 if (newName === null) continue; // User cancelled
                 
                 finalName = newName;
                 fullPath = targetPath ? `${targetPath}/${finalName}` : finalName;
                 
                 if (isCollision()) {
                     const confirmed = await customConfirm('Overwrite File?', `Are you sure you want to overwrite "${fullPath}"?`);
                     if (!confirmed) continue;
                 }
              }
              
              const content = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (event) => resolve((event.target?.result as string) || '');
                  reader.readAsText(file);
              });
              
              handleAddFile(fullPath, content);
          }
      };
      input.click();
  };

  const confirmDeleteFile = (id: string) => {
      setFilesData(prev => {
          const newFiles = { ...prev };
          delete newFiles[id];
          return newFiles;
      });
      
      setOpenedTabs(prev => {
          const nextTabs = prev.filter(fid => fid !== id);
          if (activeFile === id) {
              setActiveFile(nextTabs[nextTabs.length - 1] || '');
          }
          return nextTabs;
      });
      
      fetch(`/api/files/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleDeleteFile = (id: string) => {
      setFileToDelete(id);
  };

  const handleRenameFile = async (id: string) => {
      const file = filesData[id];
      if (!file) return;
      const newPath = await customPrompt("Enter new path", file.path);
      if (newPath && newPath !== file.path) {
          const content = file.content;
          fetch(`/api/files/${id}`, { method: 'DELETE' }).catch(console.error);
          setFilesData(prev => { const next = {...prev}; delete next[id]; return next; });
          setOpenedTabs(prev => prev.filter(fid => fid !== id));
          handleAddFile(newPath, content);
      }
  };

  const handleRenameFolder = async (folderPath: string) => {
      const folderName = folderPath.split('/').pop() || '';
      const parentPath = folderPath.substring(0, folderPath.lastIndexOf('/'));
      
      const newName = await customPrompt(`Enter new folder name for ${folderName}`, folderName);
      if (newName && newName !== folderName) {
          const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName;
          
          const filesToRename = Object.entries(filesData).filter(([_, file]) => 
             file.path.startsWith(folderPath + '/')
          );

          if (filesToRename.length > 0) {
              setFilesData(prev => { 
                 const next = {...prev}; 
                 for (const [id] of filesToRename) delete next[id]; 
                 return next; 
              });
              
              setOpenedTabs(prev => {
                 let nextTabs = prev.filter(fid => !filesToRename.some(([id]) => id === fid));
                 if (activeFile && filesToRename.some(([id]) => id === activeFile)) {
                     setActiveFile(nextTabs[nextTabs.length - 1] || '');
                 }
                 return nextTabs;
              });
              
              const renamePromises = filesToRename.map(async ([id, file]) => {
                  const relativePath = file.path.substring(folderPath.length);
                  const newPath = newFolderPath + relativePath;
                  await fetch(`/api/files/${id}`, { method: 'DELETE' }).catch(console.error);
                  await handleAddFile(newPath, file.content, activeProject || undefined, file.is_link, false);
              });

              await Promise.all(renamePromises);
          }
      }
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setOpenedTabs(prev => {
          const nextTabs = prev.filter(fid => fid !== id);
          if (activeFile === id) {
              setActiveFile(nextTabs[nextTabs.length - 1] || '');
          }
          return nextTabs;
      });
  };

  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [tabsOverflowing, setTabsOverflowing] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const checkTabsOverflow = useCallback(() => {
    if (tabsContainerRef.current) {
      const { scrollWidth, clientWidth } = tabsContainerRef.current;
      setTabsOverflowing(scrollWidth > clientWidth);
    }
  }, []);

  useEffect(() => {
    checkTabsOverflow();
    window.addEventListener('resize', checkTabsOverflow);
    return () => window.removeEventListener('resize', checkTabsOverflow);
  }, [openedTabs, checkTabsOverflow]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTab(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverTab) {
      setDragOverTab(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== id) {
      setOpenedTabs(prev => {
        const newTabs = [...prev];
        const draggedIndex = newTabs.indexOf(draggedTab);
        const dropIndex = newTabs.indexOf(id);
        newTabs.splice(draggedIndex, 1);
        newTabs.splice(dropIndex, 0, draggedTab);
        return newTabs;
      });
    }
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const createNewProject = async () => {
    const name = await customPrompt("Enter new project name:");
    if (!name) return;
    
    const id = `proj_${Date.now()}`;
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name })
    })
    .then(res => res.json())
    .then(() => {
       setProjects(prev => [{id, name}, ...prev]);
       setActiveProject(id);
       
       // Create initial structure
       setTimeout(() => {
          handleAddFile('Makefile', 'all:\n\tiverilog -o sim/tb.vvp src/top.v src/top_tb.v\n\tvvp sim/tb.vvp\n\clean:\n\trm -f sim/tb.vvp sim/test.vcd', id);
          handleAddFile('ai_context.md', '# Global AI Project Configuration\n\nThis is a global prompt for all files generated by the AI.\nWrite your general instructions for Verilog/FPGA logic here.', id);
          handleAddFile('src/top.v', 'module top (\n    input wire clk,\n    input wire rst,\n    output reg [7:0] data_out\n);\n\n    always @(posedge clk or posedge rst) begin\n        if (rst) begin\n            data_out <= 8\'d0;\n        end else begin\n            data_out <= data_out + 1\'b1;\n        end\n    end\n\nendmodule\n', id);
          handleAddFile('src/top_tb.v', '`timescale 1ns/1ps\n\nmodule top_tb;\n    reg clk;\n    reg rst;\n    wire [7:0] data_out;\n\n    top uut (\n        .clk(clk),\n        .rst(rst),\n        .data_out(data_out)\n    );\n\n    initial begin\n        $dumpfile("sim/test.vcd");\n        $dumpvars(0, top_tb);\n        \n        clk = 0;\n        rst = 1;\n        #10 rst = 0;\n        #100 $finish;\n    end\n\n    always #5 clk = ~clk;\nendmodule\n', id);
          handleAddFile('quartus/project.qpf', 'PROJECT_REVISION = "project"\n', id);
          handleAddFile('quartus/project.qsf', 'set_global_assignment -name FAMILY "Cyclone IV E"\nset_global_assignment -name DEVICE EP4CE22F17C6\nset_global_assignment -name TOP_LEVEL_ENTITY top\nset_global_assignment -name VERILOG_FILE ../src/top.v\n', id);
          handleAddFile('sim/test.vcd', '$date\n   Today\n$end\n$version\n  Icarus Verilog\n$end\n$timescale\n  1ns\n$end\n$scope module top_tb $end\n$var wire 1 ! clk $end\n$var wire 1 " rst $end\n$var wire 8 # data_out [7:0] $end\n$upscope $end\n$enddefinitions $end\n#0\n$dumpvars\n0!\n1"\nb00000000 #\n$end\n#5\n1!\n#10\n0!\n0"\n#15\n1!\nb00000001 #\n#20\n0!\n', id);
       }, 500);
    })
    .catch(console.error);
  };

  return (
    <div className="h-screen flex flex-col font-sans">
      <ResizeObserverErrorPatch />
      {/* Header */}
      <Header 
        activeProject={activeProject}
        setActiveProject={setActiveProject}
        projects={projects}
        createNewProject={createNewProject}
        activeFile={activeFile}
        filesData={filesData}
        saveFile={saveFile}
        saveAllFiles={saveAllFiles}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        updateFileUI={updateFileUI}
        fileUIStates={fileUIStates}
        handleImportZip={handleImportZip}
        handleExportZip={handleExportZip}
        isExporting={isExporting}
        gitStatus={gitStatus}
        handleGitAction={handleGitAction}
        setGitCommitDialogState={setGitCommitDialogState}
        handleRunMake={handleRunMake}
        isBuildingLocal={isBuildingLocal}
        editorTheme={editorTheme}
        setEditorTheme={setEditorTheme}
        showMinimap={showMinimap}
        setShowMinimap={setShowMinimap}
        handleEditTemplate={handleEditTemplate}
      />

      {/* Main Content */}
      <div className="flex-1 w-full overflow-hidden">
        <PanelGroup orientation="horizontal" id="workspace-horizontal-v5">
          {/* Left Panel */}
          {isChatOpen && isVCDMode && (
             <>
               <Panel key={`vcd-panel-${activeFile}`} id={`vcd-panel-${activeFile}`} defaultSize={fileUIStates[activeFile]?.explorerWidth || 25} minSize={5} onResize={(size) => { draggingSizeRef.current = size; }} className="flex flex-col z-20 bg-[#16161a]">
                  <VCDScopeTree 
                      vcdContent={filesData[activeFile].content}
                      viewState={fileUIStates[activeFile]?.vcd}
                      updateViewState={(updater) => updateFileUI(activeFile, p => ({ ...p, vcd: updater(p.vcd) }))}
                      activeFilePath={filesData[activeFile]?.path}
                      filesData={filesData}
                      onAddFile={handleAddFile}
                      activeProject={activeProject}
                  />
               </Panel>
               <PanelResizeHandle className="w-1 bg-[#27272a] hover:bg-emerald-500/50 transition-colors cursor-col-resize z-50 relative" onMouseDown={() => { isDraggingLeftPanel.current = true; const handler = () => { window.setTimeout(() => { isDraggingLeftPanel.current = false; updateFileUI(activeFile, p => ({ ...p, explorerWidth: draggingSizeRef.current })); }, 0); window.removeEventListener('mouseup', handler); }; window.addEventListener('mouseup', handler); }} />
             </>
          )}

          {isChatOpen && isSVMode && (
             <>
               <Panel key="sv-panel" id="sv-panel" defaultSize={25} minSize={5} className="flex flex-col z-20 bg-[#16161a]">
                  <VerilogASTViewer 
                      content={filesData[activeFile]?.content || ''} 
                      selectedNet={fileUIStates[activeFile]?.diagramSelectedNet}
                      onSelectNet={(net) => updateFileUI(activeFile, p => ({ ...p, diagramSelectedNet: net }))}
                  />
               </Panel>
               <PanelResizeHandle className="w-1 bg-[#27272a] hover:bg-emerald-500/50 transition-colors cursor-col-resize z-50 relative" onMouseDown={() => { isDraggingLeftPanel.current = true; const handler = () => { window.setTimeout(() => { isDraggingLeftPanel.current = false; }, 0); window.removeEventListener('mouseup', handler); }; window.addEventListener('mouseup', handler); }} />
             </>
          )}

          {isChatOpen && !isVCDMode && !isSVMode && (
             <>
               <Panel key="chat-panel" id="chat" defaultSize={chatWidth || 25} minSize={5} onResize={(size) => { draggingSizeRef.current = size; }} className="flex flex-col z-20 bg-[#16161a]">
                  <OllamaChat 
                     onAddFile={handleAddFile} 
                     activeFileId={activeFile} 
                     activeFilePath={filesData[activeFile]?.path || null} 
                     activeFileContent={filesData[activeFile]?.content || null} 
                     projectContext={Object.values(filesData).find((f: any) => f.path === 'ai_context.md' || f.name === 'ai_context.md')?.content || null}
                     onProposeMerge={setProposedMergeCode}
                     input={activeFile ? (chatInputs[activeFile] || '') : ''}
                     setInput={(val) => {
                       const aid = activeFile || '_global';
                       setChatInputs(prev => ({
                         ...prev, 
                         [aid]: val as unknown as string
                       }));
                     }}
                     allFiles={filesData}
                  />
               </Panel>
               <PanelResizeHandle className="w-1 bg-[#27272a] hover:bg-emerald-500/50 transition-colors cursor-col-resize z-50 relative" onMouseDown={() => { isDraggingLeftPanel.current = true; const handler = () => { window.setTimeout(() => { isDraggingLeftPanel.current = false; setChatWidth(draggingSizeRef.current); }, 0); window.removeEventListener('mouseup', handler); }; window.addEventListener('mouseup', handler); }} />
             </>
          )}

          {/* Editor Area (Middle) */}
          <Panel id="editor" defaultSize={55} minSize={30} className="flex flex-col min-w-0 bg-[#1e1e1e]">
            <PanelGroup orientation="vertical" id="workspace-vertical-v5">
              <Panel id="editor-main" defaultSize={70} className="flex flex-col relative min-h-0">
                <TabsBar
                  openedTabs={openedTabs}
                  activeFile={activeFile}
                  filesData={filesData}
                  tabsContainerRef={tabsContainerRef}
                  tabsOverflowing={tabsOverflowing}
                  draggedTab={draggedTab}
                  dragOverTab={dragOverTab}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDragEnd={handleDragEnd}
                  handleDrop={handleDrop}
                  setActiveFile={setActiveFile}
                  closeTab={closeTab}
                  fetchGitDiffForActiveFile={fetchGitDiffForActiveFile}
                />
          <div className="flex-1 overflow-hidden relative">
            {activeFile ? (
              ['vcd'].includes(filesData[activeFile]?.type?.toLowerCase() || '') && !fileUIStates[activeFile]?.isTextMode ? (
                <div className="w-full h-full">
                  <VCDWrapper 
                      key={activeFile}
                      content={filesData[activeFile]?.content || ''} 
                      viewState={fileUIStates[activeFile]?.vcd}
                      onViewStateChange={(vcd) => updateFileUI(activeFile, p => ({ ...p, vcd }))}
                      filesData={filesData}
                  />
                </div>
              ) : (['markdown'].includes(filesData[activeFile]?.type?.toLowerCase() || '') || (filesData[activeFile]?.name || '').endsWith('.md')) && !fileUIStates[activeFile]?.isTextMode ? (
                <MarkdownWrapper content={filesData[activeFile]?.content || ''} />
              ) : (['v', 'sv', 'verilog'].includes(filesData[activeFile]?.type?.toLowerCase() || '') || filesData[activeFile]?.name?.endsWith('.v') || filesData[activeFile]?.name?.endsWith('.sv')) && fileUIStates[activeFile]?.isDiagramMode ? (
                <div className="w-full h-full">
                   <VerilogDiagramViewer 
                       content={filesData[activeFile]?.content || ''}
                       selectedNet={fileUIStates[activeFile]?.diagramSelectedNet}
                       onSelectNet={(net) => updateFileUI(activeFile, p => ({ ...p, diagramSelectedNet: net }))}
                   />
                </div>
              ) : (
                <Editor
                  height="100%"
                  theme={editorTheme}
                  onMount={handleEditorDidMount}
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
                  value={filesData[activeFile]?.content || ''}
                  onChange={handleEditorChange}
                  options={editorOptions}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a file to edit</div>
            )}
          </div>
        </Panel>

          <BuildOutputPanel
            isOpen={buildDialog.isOpen}
            logs={buildDialog.logs}
            error={buildDialog.error}
            isBuildingLocal={isBuildingLocal}
            onClose={() => setBuildDialog(p => ({...p, isOpen: false}))}
            filesData={filesData}
            setActiveFile={setActiveFile}
            openedTabs={openedTabs}
            setOpenedTabs={setOpenedTabs}
            editorRef={editorRef}
          />

            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1 bg-[#27272a] hover:bg-emerald-500/50 transition-colors cursor-col-resize z-50 relative" />

          {/* Sidebar Project Tree (Right) */}
          <Panel id="files" defaultSize={20} minSize={15} className="bg-[#121214] border-l border-white/10 flex flex-col z-10">
            <div className="p-4 overflow-y-auto w-full">
               <div className="flex items-center justify-between mb-3 w-full">
                 <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project</h2>
                 <div className="flex items-center gap-2">
                   <button onClick={async () => {
                       const name = await customPrompt("Enter new folder name in root:");
                       if (name) {
                           const folderPath = name.endsWith('/') ? name : name + '/';
                           handleAddFile(folderPath + '.gitkeep', "");
                       }
                   }} className="text-slate-400 hover:text-white" title="New Folder"><FolderPlus className="w-4 h-4" /></button>
                   <button onClick={async () => {
                       const name = await customPrompt("Enter new file name in root:", "new_file.v");
                       if (name) {
                           handleAddFile(name, "// New file\n");
                       }
                   }} className="text-slate-400 hover:text-white" title="New File"><FilePlus className="w-4 h-4" /></button>
                   <button onClick={() => {
                       setTestbenchDialog({ isOpen: true, parentPath: '', filesToInclude: [], tbName: 'tb_module' });
                   }} className="text-slate-400 hover:text-white" title="Create Testbench"><Box className="w-4 h-4" /></button>
                   <button onClick={async () => {
                       const name = await customPrompt("Enter linked file name in root:", "output.vcd");
                       if (name) {
                           handleAddFile(name, "Waiting for output...", activeProject || undefined, true);
                       }
                   }} className="text-slate-400 hover:text-white" title="Add Link to File"><Link className="w-4 h-4" /></button>
                   <button onClick={() => {
                       handleFileUploadMenu('');
                   }} className="text-slate-400 hover:text-white" title="Upload File"><Upload className="w-4 h-4" /></button>
                 </div>
               </div>
              <div className="space-y-1">
                <ProjectTree 
                  treeRoot={treeRoot}
                  collapsedDirs={collapsedDirs}
                  setCollapsedDirs={setCollapsedDirs}
                  customPrompt={customPrompt}
                  handleAddFile={handleAddFile}
                  setTestbenchDialog={setTestbenchDialog}
                  handleFileUploadMenu={handleFileUploadMenu}
                  activeProject={activeProject}
                  handleRenameFolder={handleRenameFolder}
                  handleDeleteFile={handleDeleteFile}
                  handleRenameFile={handleRenameFile}
                  setActiveFile={setActiveFile}
                  activeFile={activeFile}
                  setOpenedTabs={setOpenedTabs}
                  gitStatus={gitStatus}
                  setLineJumpTarget={setLineJumpTarget}
                  setChatInputs={setChatInputs}
                  setIsChatOpen={setIsChatOpen}
                  handleGitAction={handleGitAction}
                />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <DiffViewerModal
        proposedMergeCode={proposedMergeCode}
        setProposedMergeCode={setProposedMergeCode}
        filesData={filesData}
        activeFile={activeFile}
        handleAddFile={handleAddFile}
      />
      <TestbenchDialog
        isOpen={testbenchDialog.isOpen}
        onClose={() => setTestbenchDialog(p => ({ ...p, isOpen: false }))}
        filesData={filesData}
        onCreate={handleCreateTestbench}
      />
      
      <GitDiffModal 
        isOpen={gitDiffModalState.isOpen}
        onClose={() => setGitDiffModalState({ isOpen: false, content: '' })}
        originalContent={gitDiffModalState.content}
        filesData={filesData}
        activeFile={activeFile}
      />
      <GitCommitDialog
        isOpen={gitCommitDialogState}
        gitStatus={gitStatus}
        onClose={() => setGitCommitDialogState(false)}
        onCommit={(message) => {
          handleGitAction('commit', undefined, message);
        }}
      />
      <MessageOverlay 
        isOpen={gitMessageOpen}
        title="Git Output"
        message={gitMessageContent || ''}
        type={gitMessageContent?.toString().startsWith('Error') ? 'error' : 'success'}
        onClose={() => setGitMessageOpen(false)}
      />

      {customDialogsNode}
      
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e24] border border-[#27272a] shadow-2xl rounded-lg w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-medium text-slate-200 mb-2">Delete File</h3>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to delete <span className="font-mono text-emerald-400">{filesData[fileToDelete]?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-[#27272a] hover:bg-[#323236] rounded-md transition-colors outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  confirmDeleteFile(fileToDelete);
                  setFileToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm outline-none focus:ring-2 focus:ring-red-500/50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
