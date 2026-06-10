import { motion, AnimatePresence } from 'motion/react';
import { Download, Terminal, Settings2, Cpu, Play, CheckCircle2, FileCode2, ChevronRight, ChevronDown, Folder, FolderOpen, MessageSquare, GitMerge, Pencil, Trash2, FilePlus, FolderPlus, Type, X, MoreVertical, Link, Github, Activity, FileText, Upload, Box, Hash, GitPullRequest } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import debounce from 'lodash.debounce';

// Hook for polling
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { OllamaChat } from './components/OllamaChat';
import JSZip from 'jszip';
import Editor from '@monaco-editor/react';
import { PromptDialog } from './components/PromptDialog';
import { GitCommitDialog } from './components/GitCommitDialog';
import { MessageOverlay } from './components/MessageOverlay';
import { GithubExportDialog } from './components/GithubExportDialog';
import { DiffViewerModal } from './components/DiffViewerModal';
import { GitDiffModal } from './components/GitDiffModal';
import { WaveformViewer, WaveformViewerViewState } from './components/WaveformViewer';
import { TestbenchDialog } from './components/TestbenchDialog';
import { parseVCD } from './utils/vcdParser';
import { defaultVerilogMake, defaultCppMake } from './utils/templates';
import { parseVerilog } from './utils/verilogParser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

class ErrorBoundary extends React.Component<{children: React.ReactNode, fallback?: (err: Error) => React.ReactNode}, {error: Error | null}> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return this.props.fallback ? this.props.fallback(this.state.error) : <div className="p-4 text-red-500 overflow-auto"><pre>{this.state.error.message}{'\n'}{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}

function MarkdownWrapper({ content }: { content: string }) {
  return (
    <div className="w-full h-full overflow-auto bg-[#1e1e1e] p-8">
      <div className="max-w-4xl mx-auto prose prose-invert prose-emerald prose-headings:text-slate-200 prose-p:text-slate-300 prose-a:text-emerald-400 prose-code:text-emerald-300 prose-pre:bg-[#0d0d12] prose-pre:border prose-pre:border-white/10 prose-strong:text-slate-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function VCDWrapper({ content, viewState, onViewStateChange }: { content: string, viewState?: WaveformViewerViewState, onViewStateChange?: (state: WaveformViewerViewState) => void }) {
  const vcdData = useMemo(() => {
    try {
      return parseVCD(content);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [content]);

  if (!vcdData) {
    return <div className="p-4 text-rose-400">Error parsing VCD file. The file may be corrupted or unsupported.</div>;
  }
  return (
    <ErrorBoundary>
      <WaveformViewer vcd={vcdData} viewState={viewState} onViewStateChange={onViewStateChange} />
    </ErrorBoundary>
  );
}

const initialFiles: Record<string, any> = {
  readme: {
    name: 'README.md',
    path: 'README.md',
    type: 'markdown',
    content: `# Welcome to FPGA Web IDE\n\nThis is a clean workspace for standard FPGA development.\n\n## Dependencies Installation\nTo compile the Verilog project with the default Makefile, you will need to install the following packages on your system:\n\n\`\`\`bash\nsudo apt-get update\nsudo apt-get install iverilog verilator\n\`\`\`\n\nFor Intel Quartus projects, install Quartus Prime Lite.`
  }
};

export default function App() {
  const [filesData, setFilesData] = useState<Record<string, {name: string, path: string, type: string, content: string, is_link?: boolean}>>({});
  const [activeFile, setActiveFile] = useState<string>('');
  const [openedTabs, setOpenedTabs] = useState<string[]>([]);
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});
  const [fileUIStates, setFileUIStates] = useState<Record<string, { isTextMode?: boolean, vcd?: WaveformViewerViewState }>>({});
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  const fetchGitStatus = useCallback(async () => {
     if (!activeProject) return;
     try {
       const res = await fetch(`/api/git/status?projectId=${activeProject}`);
       if (res.ok) {
         const data = await res.json();
         setGitStatus(data);
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
  const [lineJumpTarget, setLineJumpTarget] = useState<string | null>(null);
  const editorRef = React.useRef<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingGist, setIsExportingGist] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(() => localStorage.getItem('github_token'));

  const [testbenchDialog, setTestbenchDialog] = useState<{
    isOpen: boolean;
    parentPath: string;
    filesToInclude: string[];
    tbName: string;
  }>({ isOpen: false, parentPath: '', filesToInclude: [], tbName: 'tb_module' });

  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue: string;
    onResolve: ((val: string | null) => void) | null;
  }>({
    isOpen: false,
    title: '',
    defaultValue: '',
    onResolve: null
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onResolve: ((val: boolean) => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onResolve: null
  });

  const [multiChoiceDialog, setMultiChoiceDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    choices: { label: string; value: string; variant?: 'primary' | 'danger' | 'secondary' }[];
    onResolve: ((val: string | null) => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    choices: [],
    onResolve: null
  });

  const [gistExportDialog, setGistExportDialog] = useState<{
    isOpen: boolean;
    logs: string[];
    finalUrl: string | null;
    error: string | null;
  }>({ isOpen: false, logs: [], finalUrl: null, error: null });

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

  const customPrompt = (title: string, defaultValue: string = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptDialog({
        isOpen: true,
        title,
        defaultValue,
        onResolve: resolve
      });
    });
  };

  const customConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onResolve: resolve
      });
    });
  };

  const customMultiChoice = (
    title: string, 
    message: string, 
    choices: { label: string; value: string; variant?: 'primary' | 'danger' | 'secondary' }[]
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setMultiChoiceDialog({
        isOpen: true,
        title,
        message,
        choices,
        onResolve: resolve
      });
    });
  };

  useEffect(() => {
    if (lineJumpTarget && editorRef.current) {
         setTimeout(() => { // wait for editor to apply model if active file just changed
             const model = editorRef.current.getModel();
             if (!model) return;
             const searchString = lineJumpTarget.split('\n')[0].trim();
             const matches = model.findMatches(searchString, false, false, false, null, true);
             if (matches && matches.length > 0) {
                 editorRef.current.revealLineInCenter(matches[0].range.startLineNumber);
                 editorRef.current.setPosition({ lineNumber: matches[0].range.startLineNumber, column: 1 });
                 editorRef.current.focus();
                 setLineJumpTarget(null);
             }
         }, 150);
    }
  }, [activeFile, lineJumpTarget]);

  const handleEditorDidMount = React.useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  const handleConnectGitHub = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await fetch(`/api/auth/github/url?redirectUri=${encodeURIComponent(redirectUri)}`);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        if (errData && errData.error && errData.error.includes('GITHUB_CLIENT_ID')) {
           alert("GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the app environment, and set the callback URL to: " + redirectUri);
           return;
        }
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();
  
      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );
  
      if (!authWindow) {
        alert('Please allow popups for this site to connect your GitHub account.');
      }
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      alert('Failed to initiate GitHub connect');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data.token;
        if (token) {
          localStorage.setItem('github_token', token);
          setGithubToken(token);
          alert('GitHub account connected successfully!');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  const handleExportLocalGit = async () => {
    setIsExportingGist(true);
    setGistExportDialog({ isOpen: true, logs: ['Starting local git repository export process...'], finalUrl: null, error: null });
    
    const addLog = (log: string) => {
      setGistExportDialog(prev => ({ ...prev, logs: [...prev.logs, log] }));
    };

    try {
      addLog('Sending project data to local server export endpoint...');
      const response = await fetch('/api/export/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject || 'default', commitMessage: 'Workspace export update' })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      
      addLog(`Success! Repository exported and committed to:`);
      addLog(data.path);
      
      setGistExportDialog(prev => ({ ...prev, finalUrl: null })); // No HTTP URL for local folder
    } catch (err: any) {
      console.error('Local export failed:', err);
      setGistExportDialog(prev => ({ ...prev, error: err.message || 'Export failed' }));
    } finally {
      setIsExportingGist(false);
    }
  };

  const handleRunMake = async () => {
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

  const debounceMap = useMemo(() => new Map<string, (...args: any[]) => void>(), []);
  
  const saveFileDirect = useCallback((id: string, fileObj: any, projId: string) => {
      return fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, project_id: projId, ...fileObj })
      }).catch(err => console.error("Failed to save file remotely", err));
  }, []);

  const saveFileToAPI = useCallback(
    (id: string, fileObj: any, projId: string) => {
      let debounced = debounceMap.get(id);
      if (!debounced) {
         debounced = debounce((idArg: string, fileObjArg: any, projIdArg: string) => {
            saveFileDirect(idArg, fileObjArg, projIdArg);
         }, 1000);
         debounceMap.set(id, debounced);
      }
      debounced(id, fileObj, projId);
    },
    [debounceMap, saveFileDirect]
  );

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

  const fileList = Object.entries(filesData).map(([id, f]) => ({id, ...f}));
  
  type TreeNode = {
    name: string;
    path: string;
    type: 'file' | 'folder' | 'module' | 'wire_reg';
    fileId?: string;
    content?: string;
    children: Record<string, TreeNode>;
    is_link?: boolean;
  };
  
  const treeRoot: Record<string, TreeNode> = {};
  fileList.forEach(f => {
      const parts = f.path.split('/');
      let currentLevel = treeRoot;
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
                    const modules = parseVerilog(f.content);
                    modules.forEach(mod => {
                        const modName = mod.name;
                        const modPath = `${currentPath}:${modName}`;
                        const modNode: TreeNode = { 
                            name: modName, 
                            path: modPath, 
                            type: 'module', 
                            content: mod.header,
                            fileId: f.id,
                            children: {} 
                        };
                        
                        mod.signals.forEach(sig => {
                            modNode.children[sig.name] = {
                                name: sig.name,
                                path: `${modPath}:${sig.name}`,
                                type: 'wire_reg',
                                content: sig.declaration,
                                fileId: f.id,
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

  const renderTree = (nodes: Record<string, TreeNode>, depth: number = 0) => {
    return Object.values(nodes)
      .sort((a, b) => {
        // Folders first, then files, then modules, then wires
        const getWeight = (t: string) => t === 'folder' ? 0 : t === 'file' ? 1 : t === 'module' ? 2 : 3;
        if (getWeight(a.type) !== getWeight(b.type)) return getWeight(a.type) - getWeight(b.type);
        return a.name.localeCompare(b.name);
      })
      .map(node => {
        const hasChildren = Object.keys(node.children).length > 0;
        const isCollapsed = collapsedDirs[node.path] ?? (node.type !== 'folder');

        if (node.type === 'folder') {
          const isTestbenchFolder = node.children['Makefile'] !== undefined || node.name.startsWith('tb_') || node.name.endsWith('_tb');
          return (
            <div key={node.path}>
              <div 
                className={`flex items-center justify-between text-sm text-slate-200 py-1.5 font-medium group pr-2 cursor-pointer hover:bg-white/5 rounded`}
                style={{ paddingLeft: `${depth * 16}px` }}
              >
                <div className="flex items-center gap-1.5" onClick={() => setCollapsedDirs(prev => ({ ...prev, [node.path]: !isCollapsed }))}>
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  {isTestbenchFolder ? <Box className="w-4 h-4 text-emerald-400 fill-emerald-400/20" /> : <FolderOpen className="w-4 h-4 text-amber-400" />}
                  <span className={isTestbenchFolder ? "text-emerald-300 font-semibold" : ""}>{node.name}</span>
                </div>
                <DropdownMenu.Root>
                   <DropdownMenu.Trigger asChild>
                      <button onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-1">
                         <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                   </DropdownMenu.Trigger>
                   <DropdownMenu.Portal>
                      <DropdownMenu.Content align="end" sideOffset={2} className="bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl py-1 min-w-[140px] z-50">
                         <DropdownMenu.Item 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              customPrompt(`Enter new file name (in ${node.path}/):`, 'new_file.v').then(name => {
                                if (name) handleAddFile(`${node.path}/${name}`, "// New file\n");
                              });
                           }} 
                           className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2"
                         >
                             <FilePlus className="w-3 h-3" /> New File Here
                         </DropdownMenu.Item>
                         <DropdownMenu.Item 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              customPrompt(`Enter new folder name (in ${node.path}/):`, 'new_folder').then(name => {
                                if (name) {
                                  const folderName = name.endsWith('/') ? name : name + '/';
                                  handleAddFile(`${node.path}/${folderName}.gitkeep`, "");
                                }
                              });
                           }} 
                           className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2"
                         >
                             <FolderPlus className="w-3 h-3" /> New Folder Here
                         </DropdownMenu.Item>
                         <DropdownMenu.Item 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              handleFileUploadMenu(node.path);
                           }} 
                           className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2"
                         >
                             <Upload className="w-3 h-3" /> Upload File(s)
                         </DropdownMenu.Item>
                         <DropdownMenu.Item 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              customPrompt(`Enter link file name (in ${node.path}/):`, 'output.vcd').then(name => {
                                if (name) handleAddFile(`${node.path}/${name}`, "Waiting for output...", activeProject || undefined, true);
                              });
                           }} 
                           className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2"
                         >
                             <Link className="w-3 h-3" /> Add Link to File
                         </DropdownMenu.Item>
                         {node.path !== '' && (
                         <DropdownMenu.Item 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              handleRenameFolder(node.path);
                           }} 
                           className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2"
                         >
                             <Type className="w-3 h-3" /> Rename Folder
                         </DropdownMenu.Item>
                         )}
                         <DropdownMenu.Separator className="h-px bg-white/5 my-1" />
                         <DropdownMenu.Item 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              setTestbenchDialog({ isOpen: true, parentPath: node.path === '' ? '' : node.path + '/', filesToInclude: [], tbName: 'tb_module' });
                           }} 
                           className="px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 cursor-pointer outline-none flex items-center gap-2"
                         >
                             <Box className="w-3 h-3" /> Create Testbench
                         </DropdownMenu.Item>
                      </DropdownMenu.Content>
                   </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  {renderTree(node.children, depth + 1)}
                </div>
              )}
            </div>
          );
        }

        const isFile = node.type === 'file';
        const isModule = node.type === 'module';
        // Base indent for non-folders. if inside a file, depth increases
        const pl = depth * 16 + (isFile ? 20 : 20);

        const isModified = gitStatus?.status?.modified?.includes(node.path);
        const isUntracked = gitStatus?.status?.not_added?.includes(node.path);
        const isAdded = gitStatus?.status?.created?.includes(node.path) || gitStatus?.status?.staged?.includes(node.path);

        let gitMarker = null;
        if (isUntracked) gitMarker = <span className="text-[10px] text-emerald-500 font-bold ml-1" title="Untracked">U</span>;
        else if (isAdded) gitMarker = <span className="text-[10px] text-emerald-400 font-bold ml-1" title="Added">A</span>;
        else if (isModified) gitMarker = <span className="text-[10px] text-amber-500 font-bold ml-1" title="Modified">M</span>;

        return (
          <div key={node.path}>
            <div 
              onClick={() => { 
                 if (node.fileId) {
                    setActiveFile(node.fileId); 
                    setOpenedTabs(p => p.includes(node.fileId!) ? p : [...p, node.fileId!]);
                    
                    if (isModule || node.type === 'wire_reg') {
                       setLineJumpTarget(node.content || null);
                    }
                 }
              }}
              className={`group py-1 pr-1 flex items-center justify-between cursor-pointer transition-colors ${isFile && activeFile === node.fileId ? 'text-emerald-400 bg-emerald-500/10 rounded' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded'}`}
              style={{ paddingLeft: `${pl}px` }}
            >
               <div className="flex items-center gap-1.5 text-[13px] overflow-hidden min-w-0">
                 {hasChildren && (
                    <div className="shrink-0" onClick={(e) => { e.stopPropagation(); setCollapsedDirs(prev => ({ ...prev, [node.path]: !isCollapsed })); }}>
                       {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                    </div>
                 )}
                 {!hasChildren && (
                    <div className="w-3.5" />
                 )}
                 {isFile ? (
                    node.is_link ? <Link className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> : <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                 ) : isModule ? (
                    <Box className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                 ) : (
                    <Hash className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                 )}
                 <span className={`truncate ${isModule ? 'text-indigo-300' : ''}`}>{node.name}</span>
                 {gitMarker}
               </div>
               
               <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                     <button onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-1">
                        <MoreVertical className="w-3.5 h-3.5" />
                     </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                     <DropdownMenu.Content align="end" sideOffset={2} className="bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl py-1 min-w-[120px] z-50">
                        <DropdownMenu.Item onClick={(e) => { 
                          e.stopPropagation(); 
                          setChatInputs((prev) => {
                             const aid = activeFile || '_global';
                             const current = prev[aid] || '';
                             return { ...prev, [aid]: current + (current.endsWith(' ') || current === '' ? '' : ' ') + `{${node.path}}` };
                          }); 
                          setIsChatOpen(true); 
                        }} className="px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 cursor-pointer outline-none flex items-center gap-2">
                            <Link className="w-3 h-3" /> Reference
                        </DropdownMenu.Item>
                        {node.fileId && (
                        <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); handleRenameFile(node.fileId!); }} className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2">
                            <Type className="w-3 h-3" /> Rename
                        </DropdownMenu.Item>
                        )}
                        {node.fileId && (
                        <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); handleDeleteFile(node.fileId!); }} className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer outline-none flex items-center gap-2">
                            <Trash2 className="w-3 h-3" /> Delete
                        </DropdownMenu.Item>
                        )}
                        {gitStatus?.isRepo && isFile && (
                           <>
                             <DropdownMenu.Separator className="h-px bg-white/5 my-1" />
                             {(isUntracked || isModified) && (
                               <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); handleGitAction('add', node.path); }} className="px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 cursor-pointer outline-none flex items-center gap-2">
                                   <FilePlus className="w-3 h-3" /> Git Add
                               </DropdownMenu.Item>
                             )}
                             {!isUntracked && (
                               <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); handleGitAction('rm', node.path); }} className="px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 cursor-pointer outline-none flex items-center gap-2">
                                   <Trash2 className="w-3 h-3" /> Git Rm/Restore
                               </DropdownMenu.Item>
                             )}
                           </>
                        )}
                     </DropdownMenu.Content>
                  </DropdownMenu.Portal>
               </DropdownMenu.Root>
            </div>
            {hasChildren && !isCollapsed && (
               <div className="flex flex-col">
                 {renderTree(node.children, depth + 1)}
               </div>
            )}
          </div>
        );
      });
  };

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
        $dumpfile("${tbName}.vcd");
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
  };

  const handleGitAction = async (action: 'init' | 'add' | 'rm' | 'commit', path?: string, commitMessage?: string) => {
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
      {/* Header */}
      <header className="border-b border-white/10 bg-[#121214] px-6 py-4 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Smart Workspace</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Connected
                </span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block"></div>
          
          <div className="flex items-center gap-3">
             <div className="relative">
                <select 
                  value={activeProject || ''} 
                  onChange={e => setActiveProject(e.target.value)}
                  className="appearance-none bg-[#1e1e1e] border border-white/10 text-sm text-slate-300 py-1.5 pl-3 pr-8 rounded focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                   <ChevronRight className="w-3 h-3 rotate-90" />
                </div>
             </div>
             
             <button onClick={createNewProject} className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
               <FilePlus className="w-3.5 h-3.5" />
               New
             </button>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
              isChatOpen 
                ? 'bg-indigo-500 text-white' 
                : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            AI Assistant
          </button>
          
          {activeFile && (['vcd', 'markdown'].includes(filesData[activeFile]?.type?.toLowerCase() || '') || filesData[activeFile]?.name?.endsWith('.md')) && (
             <button 
                onClick={() => updateFileUI(activeFile, s => ({ ...s, isTextMode: !s.isTextMode }))}
                className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-emerald-400 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
             >
                {fileUIStates[activeFile]?.isTextMode ? <Activity className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                {fileUIStates[activeFile]?.isTextMode ? (['vcd'].includes(filesData[activeFile]?.type?.toLowerCase() || '') ? 'Show Waveform' : 'Show Render') : 'Show Text'}
             </button>
          )}

          <button 
            onClick={handleImportZip}
            className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import ZIP
          </button>
          
          <button 
            onClick={handleExportZip}
            disabled={isExporting}
            className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Exporting...' : 'Export to ZIP'}
          </button>
          {!gitStatus?.isRepo ? (
            <button 
              onClick={() => handleGitAction('init')}
              className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Github className="w-3.5 h-3.5" />
              Init Git Repo
            </button>
          ) : (
            <>
              <button 
                onClick={() => handleGitAction('add', '.')}
                className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FilePlus className="w-3.5 h-3.5" />
                Git Add All
              </button>
              <button 
                onClick={() => {
                  setGitCommitDialogState(true);
                }}
                className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5" />
                Git Commit
              </button>
            </>
          )}
          
          <button 
            onClick={handleRunMake}
            disabled={isBuildingLocal}
            className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            {isBuildingLocal ? 'Building...' : 'Run Make'}
          </button>
          
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 p-1.5 rounded-md transition-colors outline-none hidden sm:flex items-center justify-center cursor-pointer">
                <Settings2 className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl py-1 min-w-[140px] z-50">
                <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Editor Theme</DropdownMenu.Label>
                <DropdownMenu.Item onClick={() => setEditorTheme('vs-dark')} className={`px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center gap-2 ${editorTheme === 'vs-dark' ? 'text-emerald-400 bg-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                  vs-dark
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => setEditorTheme('light')} className={`px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center gap-2 ${editorTheme === 'light' ? 'text-emerald-400 bg-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                  light
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => setEditorTheme('hc-black')} className={`px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center gap-2 ${editorTheme === 'hc-black' ? 'text-emerald-400 bg-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                  hc-black
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                <DropdownMenu.Item onClick={() => setShowMinimap(p => !p)} className="px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center justify-between text-slate-300 hover:bg-white/5 hover:text-white">
                  <span>Show Minimap</span>
                  {showMinimap && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                <DropdownMenu.Label className="px-3 py-2 text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">Makefile Templates</DropdownMenu.Label>
                <DropdownMenu.Item onClick={() => handleEditTemplate('v')} className="px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center justify-between text-slate-300 hover:bg-white/5 hover:text-white">
                  <span>Edit Verilog Template</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => handleEditTemplate('cpp')} className="px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center justify-between text-slate-300 hover:bg-white/5 hover:text-white">
                  <span>Edit C/C++ Template</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full overflow-hidden">
        <PanelGroup orientation="horizontal" id="workspace-horizontal-v5">
          {/* Ollama Chat Left Panel */}
          {isChatOpen && (
            <>
              <Panel id="chat" defaultSize={25} minSize={15} className="flex flex-col z-20 bg-[#16161a]">
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
                       [aid]: typeof val === 'function' ? val(prev[aid] || '') : val
                     }));
                   }}
                   allFiles={filesData}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-[#27272a] hover:bg-emerald-500/50 transition-colors cursor-col-resize z-50 relative" />
            </>
          )}

          {/* Editor Area (Middle) */}
          <Panel id="editor" defaultSize={isChatOpen ? 55 : 80} minSize={30} className="flex flex-col min-w-0 bg-[#1e1e1e]">
            <PanelGroup orientation="vertical" id="workspace-vertical-v5">
              <Panel id="editor-main" defaultSize={buildDialog.isOpen ? 70 : 100} className="flex flex-col relative min-h-0">
                <div className="flex bg-[#121214] border-b border-black/50 shrink-0 justify-between items-center min-w-0">
                  <div className="flex overflow-x-auto no-scrollbar flex-1 items-center" ref={tabsContainerRef}>
                    {openedTabs.map(id => (
                      <div 
                        key={id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, id)}
                        onDragOver={(e) => handleDragOver(e, id)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, id)}
                        onClick={() => setActiveFile(id)} 
                        className={`flex items-center gap-2 px-4 py-2 border-r border-white/5 cursor-pointer text-sm shrink-0 transition-colors ${activeFile === id ? 'bg-[#1e1e1e] text-slate-200 border-t border-t-emerald-500' : 'bg-[#16161a] text-slate-500 hover:text-slate-300 border-t border-transparent'} ${dragOverTab === id ? 'border-l-2 border-l-emerald-500' : ''} ${draggedTab === id ? 'opacity-50' : ''}`}
                      >
                        <FileCode2 className="w-3 h-3" />
                        <span>{filesData[id]?.name}</span>
                        <button onClick={(e) => closeTab(e, id)} className="hover:bg-white/10 rounded-md p-0.5 ml-1 transition-colors"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="shrink-0 flex items-center pr-4 pl-2 bg-[#121214] z-10 shadow-[-10px_0_15px_rgba(18,18,20,1)] relative gap-2 border-l border-white/5 h-full py-1">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button 
                            disabled={!tabsOverflowing}
                            className={`p-1 rounded transition-colors flex items-center ${tabsOverflowing ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 cursor-not-allowed opacity-50'}`}
                            title="Overflowing Tabs"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content align="end" className="bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl py-1 min-w-[200px] z-[120] max-h-[300px] overflow-y-auto">
                            {openedTabs.map(id => (
                              <DropdownMenu.Item 
                                key={id}
                                onClick={() => setActiveFile(id)}
                                className={`px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center justify-between gap-2 ${activeFile === id ? 'text-emerald-400 bg-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <FileCode2 className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{filesData[id]?.name}</span>
                                </div>
                                <button onClick={(e) => closeTab(e, id)} className="hover:bg-white/10 rounded-md p-1 ml-2 transition-colors shrink-0 text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    {activeFile && !filesData[activeFile]?.is_link && (
                      <button 
                        onClick={() => fetchGitDiffForActiveFile()}
                        className="text-xs flex items-center gap-2 text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors shrink-0 whitespace-nowrap"
                      >
                        <GitPullRequest className="w-3.5 h-3.5" />
                        View Git Diff
                      </button>
                    )}
                  </div>
                </div>
          <div className="flex-1 overflow-hidden relative">
            {activeFile ? (
              ['vcd'].includes(filesData[activeFile]?.type?.toLowerCase() || '') && !fileUIStates[activeFile]?.isTextMode ? (
                <div className="w-full h-full">
                  <VCDWrapper 
                      key={activeFile}
                      content={filesData[activeFile]?.content || ''} 
                      viewState={fileUIStates[activeFile]?.vcd}
                      onViewStateChange={(vcd) => updateFileUI(activeFile, p => ({ ...p, vcd }))}
                  />
                </div>
              ) : (['markdown'].includes(filesData[activeFile]?.type?.toLowerCase() || '') || (filesData[activeFile]?.name || '').endsWith('.md')) && !fileUIStates[activeFile]?.isTextMode ? (
                <MarkdownWrapper content={filesData[activeFile]?.content || ''} />
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
                beforeMount={(monaco) => {
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
                }}
                value={filesData[activeFile]?.content || ''}
                onChange={(val) => {
                  if (val !== undefined && activeFile) {
                    const content = val;
                    setFilesData(prev => ({
                      ...prev,
                      [activeFile]: { ...prev[activeFile], content }
                    }));
                    if (activeProject) saveFileToAPI(activeFile, { ...filesData[activeFile], content }, activeProject);
                  }
                }}
                options={{ minimap: { enabled: showMinimap }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: 'on' }}
              />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a file to edit</div>
            )}
          </div>
        </Panel>

          {buildDialog.isOpen && (
            <>
              <PanelResizeHandle className="h-1 bg-[#27272a] hover:bg-emerald-500/50 transition-colors cursor-row-resize z-50 relative" />
              <Panel id="build-output" defaultSize={30} minSize={10} className="bg-[#0a0a0c] flex flex-col border-t border-white/10 relative">
                 <div className="flex items-center justify-between p-2 pt-1 border-b border-white/5 bg-[#121214] shrink-0">
                   <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                     <Terminal className="w-3.5 h-3.5" /> Make Output
                   </div>
                   <button onClick={() => setBuildDialog(p => ({...p, isOpen: false}))} className="text-slate-500 hover:text-white p-1 outline-none">
                     <X className="w-3.5 h-3.5" />
                   </button>
                 </div>
                  <div className="p-3 overflow-y-auto font-mono text-[12px] text-slate-300 leading-relaxed whitespace-pre flex-1">
                  {buildDialog.logs.map((log, i) => {
                    // Match: file.v:10: message OR file.v(10) message OR %Error: file.v:10: message
                    const errorMatch = log.match(/([a-zA-Z0-9_.\-\/\\]+\.[a-zA-Z0-9]+)(?::|\()(\d+)(?::|\))?\s*(.+)/);
                    let clickable = null;
                    if (errorMatch) {
                      const file = errorMatch[1];
                      const line = parseInt(errorMatch[2], 10);
                      const msg = errorMatch[3];
                      
                      const isError = log.toLowerCase().includes('error');
                      const isWarning = log.toLowerCase().includes('warning');
                      const textColor = isError ? 'text-red-400 hover:text-red-300' : isWarning ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-300 hover:text-white';
                      
                      // split log to highlight just the error part
                      const matchIndex = log.indexOf(errorMatch[0]);
                      const prefix = log.substring(0, matchIndex);
                      
                      clickable = (
                        <span>
                          {prefix}
                          <span 
                            className={`${textColor} hover:underline cursor-pointer`}
                            onClick={() => {
                              // Find file by name
                              const fileName = file.split(/[/\\]/).pop() || file;
                              const foundId = Object.keys(filesData).find(id => filesData[id].path.endsWith(fileName));
                              if (foundId) {
                                 setActiveFile(foundId);
                                 if (!openedTabs.includes(foundId)) {
                                   setOpenedTabs(p => [...p, foundId]);
                                 }
                                 // jump to line
                                 setTimeout(() => {
                                   if (editorRef.current) {
                                      editorRef.current.revealLineInCenter(line);
                                      editorRef.current.setPosition({ lineNumber: line, column: 1 });
                                      editorRef.current.focus();
                                   }
                                 }, 100);
                              }
                            }}
                          >
                            {file}:{line} {msg}
                          </span>
                        </span>
                      );
                    }
                    return (
                      <div key={i} className="mb-0.5">
                        <span className="text-emerald-500/30 mr-3 border-r border-slate-700/50 pr-3 select-none inline-block w-[30px] text-right">
                          {i + 1}
                        </span>
                        {clickable || log}
                      </div>
                    );
                  })}
                  {buildDialog.error && (
                    <div className="mt-2 text-red-400">{buildDialog.error}</div>
                  )}
                  {isBuildingLocal && (
                     <div className="mt-2 text-slate-500 flex items-center gap-2 animate-pulse">
                        <Terminal className="w-3 h-3 text-emerald-500/50" />
                        Running...
                     </div>
                  )}
                 </div>
              </Panel>
            </>
          )}

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
                {renderTree(treeRoot)}
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
        parentPath={testbenchDialog.parentPath}
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
      <PromptDialog 
        isOpen={promptDialog.isOpen}
        title={promptDialog.title}
        defaultValue={promptDialog.defaultValue}
        onResolve={(val) => promptDialog.onResolve?.(val)}
        onClose={() => setPromptDialog(p => ({...p, isOpen: false}))}
      />

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e24] border border-[#27272a] shadow-2xl rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold text-white mb-2">{confirmDialog.title}</h2>
            <p className="text-sm text-slate-400 mb-6 whitespace-pre-wrap">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                   confirmDialog.onResolve?.(false);
                   setConfirmDialog(p => ({...p, isOpen: false}));
                }}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 rounded transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                   confirmDialog.onResolve?.(true);
                   setConfirmDialog(p => ({...p, isOpen: false}));
                }}
                className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors shadow-lg shadow-emerald-500/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {multiChoiceDialog.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e24] border border-[#27272a] shadow-2xl rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold text-white mb-2">{multiChoiceDialog.title}</h2>
            <p className="text-sm text-slate-400 mb-6 whitespace-pre-wrap">{multiChoiceDialog.message}</p>
            <div className="flex flex-col gap-3">
              {multiChoiceDialog.choices.map((choice) => (
                <button
                  key={choice.value}
                  onClick={() => {
                     multiChoiceDialog.onResolve?.(choice.value);
                     setMultiChoiceDialog(p => ({...p, isOpen: false}));
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                    choice.variant === 'primary' ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20' :
                    choice.variant === 'danger' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-500 hover:text-red-400 border border-red-500/30' :
                    'text-slate-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
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

      <GithubExportDialog 
        isOpen={gistExportDialog.isOpen}
        logs={gistExportDialog.logs}
        finalUrl={gistExportDialog.finalUrl}
        error={gistExportDialog.error}
        isProcessing={isExportingGist}
        onClose={() => setGistExportDialog(prev => ({...prev, isOpen: false}))}
      />
    </div>
  );
}
