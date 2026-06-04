import { motion, AnimatePresence } from 'motion/react';
import { Download, Terminal, Settings2, Cpu, Play, CheckCircle2, FileCode2, ChevronRight, Folder, FolderOpen, MessageSquare, GitMerge, Pencil, Trash2, FilePlus, FolderPlus, Type, X, MoreVertical, Link, Github } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import debounce from 'lodash.debounce';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { OllamaChat } from './components/OllamaChat';
import JSZip from 'jszip';
import ReactDiffViewer from 'react-diff-viewer-continued';
import Editor from '@monaco-editor/react';

const initialFiles = {
  sync_pulse_hub: {
    name: 'sync_pulse_hub.v',
    path: 'verilog/src/sync_pulse_hub.v',
    type: 'verilog',
    content: `` + "`" + `timescale 1ns/1ps

module sync_pulse_hub (
    input  wire sys_clk,
    input  wire adc_clk,
    input  wire log_clk,
    input  wire dac_clk,
    input  wire hi_clk,
    input  wire i_rst_n,
    input  wire i_sync,
    output wire o_sys_rst_n,
    output wire o_adc_rst_n,
    output wire o_log_rst_n,
    output wire o_dac_rst_n,
    output wire o_hi_rst_n,
    output reg  o_sys_sync,
    output wire o_adc_sync,
    output wire o_log_sync,
    output wire o_dac_sync,
    output wire o_hi_sync
);
    // Code loaded from project...
endmodule`
  },
  sync_pulse_hub_tb: {
    name: 'sync_pulse_hub_tb.v',
    path: 'verilog/tb/sync_pulse_hub_tb.v',
    type: 'verilog',
    content: `` + "`" + `timescale 1ns/1ps

module sync_pulse_hub_tb;
    reg sys_clk;
    reg adc_clk;
    reg log_clk;
    reg dac_clk;
    reg hi_clk;
    reg i_rst_n;
    reg i_sync;

    // Code loaded from project...
endmodule`
  },
  counter: {
    name: 'counter.v',
    path: 'verilog/src/counter.v',
    type: 'verilog',
    content: `module counter #(parameter WIDTH = 8) (
    input wire clk,
    input wire rst,
    output reg [WIDTH-1:0] count
);

    always @(posedge clk or posedge rst) begin
        if (rst)
            count <= 0;
        else
            count <= count + 1;
    end

endmodule`
  },
  testbench: {
    name: 'counter_tb.v',
    path: 'verilog/tb/counter_tb.v',
    type: 'verilog',
    content: `` + "`" + `timescale 1ns/1ps

module counter_tb;
    reg clk;
    reg rst;
    wire [7:0] count;

    counter #(.WIDTH(8)) uut (
        .clk(clk),
        .rst(rst),
        .count(count)
    );

    always #5 clk = ~clk;

    initial begin
        $dumpfile("counter_tb.vcd");
        $dumpvars(0, counter_tb);
        
        clk = 0; rst = 1;
        #20; rst = 0;
        #200;
        
        $display("Simulation complete.");
        $finish;
    end
endmodule`
  },
  makefile: {
    name: 'Makefile',
    path: 'verilog/Makefile',
    type: 'makefile',
    content: `CC = iverilog
SIM = vvp
WAVE = gtkwave

SRC_DIR = src
TB_DIR = tb
OUT_DIR = build

MODULE ?= counter
SRC = $(wildcard $(SRC_DIR)/*.v)
TB = $(TB_DIR)/$(MODULE)_tb.v

all: sim

$(OUT_DIR):
\tmkdir -p $(OUT_DIR)

compile: $(OUT_DIR)
\t$(CC) -o $(OUT_DIR)/$(MODULE).vvp $(SRC) $(TB)

sim: compile
\t$(SIM) $(OUT_DIR)/$(MODULE).vvp

wave: sim
\t$(WAVE) $(MODULE)_tb.vcd &`
  },
  tests: {
    name: 'run_tests.sh',
    path: 'verilog/scripts/run_tests.sh',
    type: 'bash',
    content: `#!/bin/bash
# Automated test script for all Verilog modules

mkdir -p build
echo "Starting Automated Tests..."

for tb in tb/*_tb.v; do
    filename=$(basename "$tb")
    module="\${filename%_tb.v}"

    iverilog -o build/\${module}.vvp src/\${module}.v tb/\${filename}
    if [ $? -ne 0 ]; then
        echo "[FAIL] Compilation failed for $module"
        continue
    fi

    vvp build/\${module}.vvp > build/\${module}_sim.log
    if [ $? -eq 0 ]; then
        echo "[PASS] Generated \${module}_tb.vcd"
    fi
done`
  },
  quartus: {
    name: 'setup_project.tcl',
    path: 'verilog/quartus/setup_project.tcl',
    type: 'tcl',
    content: `# Quartus II setup script
# Target FPGA: EP4CE55F23I7N
# Run via: quartus_sh -t setup_project.tcl

project_new fpga_project -overwrite

set_global_assignment -name FAMILY "Cyclone IV E"
set_global_assignment -name DEVICE EP4CE55F23I7N
set_global_assignment -name VERILOG_FILE ../src/counter.v
set_global_assignment -name VERILOG_FILE ../src/sync_pulse_hub.v
set_global_assignment -name SDC_FILE fpga_project.sdc
set_global_assignment -name TOP_LEVEL_ENTITY counter

export_assignments
project_close
puts "Quartus project generated."`
  },
  sdc_file: {
    name: 'fpga_project.sdc',
    path: 'verilog/quartus/fpga_project.sdc',
    type: 'sdc',
    content: `# Timing Constraints for EP4CE55F23I7N
# Top-level: sync_pulse_hub

# 1. Define Clocks
create_clock -name sys_clk -period 10.000 -waveform { 0.000 5.000 } [get_ports {sys_clk}]
create_clock -name adc_clk -period 8.000  -waveform { 0.000 4.000 } [get_ports {adc_clk}]
create_clock -name log_clk -period 12.000 -waveform { 0.000 6.000 } [get_ports {log_clk}]
create_clock -name dac_clk -period 4.000  -waveform { 0.000 2.000 } [get_ports {dac_clk}]
create_clock -name hi_clk  -period 3.000  -waveform { 0.000 1.500 } [get_ports {hi_clk}]

derive_pll_clocks
derive_clock_uncertainty

# 2. Clock Groups (Asynchronous setup)
set_clock_groups -asynchronous \\
    -group [get_clocks {sys_clk}] \\
    -group [get_clocks {adc_clk}] \\
    -group [get_clocks {log_clk}] \\
    -group [get_clocks {dac_clk}] \\
    -group [get_clocks {hi_clk}]

# 3. False Paths & Exceptions
set_false_path -from [get_ports {i_rst_n}] -to *
set_false_path -from [get_ports {i_sync}] -to [get_registers {sync_reg_d1}]`
  }
};

export default function App() {
  const [filesData, setFilesData] = useState<Record<string, {name: string, path: string, type: string, content: string}>>({});
  const [activeFile, setActiveFile] = useState<string>('');
  const [openedTabs, setOpenedTabs] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [proposedMergeCode, setProposedMergeCode] = useState<string | null>(null);

  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  const [editorTheme, setEditorTheme] = useState<string>('vs-dark');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingGist, setIsExportingGist] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(() => localStorage.getItem('github_token'));

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

  const [gistExportDialog, setGistExportDialog] = useState<{
    isOpen: boolean;
    logs: string[];
    finalUrl: string | null;
    error: string | null;
  }>({ isOpen: false, logs: [], finalUrl: null, error: null });

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

  const handleExportGist = async () => {
    const token = localStorage.getItem('github_token');
    if (!token) return;
    
    setIsExportingGist(true);
    setGistExportDialog({ isOpen: true, logs: ['Starting GitHub repository export process...'], finalUrl: null, error: null });
    
    const addLog = (log: string) => {
      setGistExportDialog(prev => ({ ...prev, logs: [...prev.logs, log] }));
    };

    try {
      addLog('Fetching GitHub user profile...');
      const userResp = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${token}` }
      });
      if (!userResp.ok) throw new Error('Failed to fetch user profile');
      const user = await userResp.json();
      const owner = user.login;
      addLog(`Authenticated as GitHub user: ${owner}`);

      const projectName = projects.find(p => p.id === activeProject)?.name || 'ai-studio-export';
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const repoName = sanitize(projectName);
      
      addLog(`Checking if repository ${repoName} exists...`);
      const checkRepoResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        headers: { Authorization: `token ${token}` }
      });
      
      let repoData;
      if (checkRepoResp.ok) {
        repoData = await checkRepoResp.json();
        addLog(`Found existing repository: ${repoName}`);
      } else if (checkRepoResp.status === 404) {
        addLog(`Creating new private repository: ${repoName}...`);
        const repoResp = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: repoName, private: true, auto_init: true })
        });

        if (!repoResp.ok) {
          if (repoResp.status === 401) {
             localStorage.removeItem('github_token');
             setGithubToken(null);
             throw new Error('Missing repo scope or token expired. Please reconnect your GitHub account.');
          }
          throw new Error(`Failed to create repository (HTTP ${repoResp.status})`);
        }
        
        repoData = await repoResp.json();
        addLog('Repository created successfully! Waiting for initialization...');
        
        // Wait for GitHub to initialize the default branch (main)
        await new Promise(r => setTimeout(r, 2000));
      } else {
         if (checkRepoResp.status === 401) {
            localStorage.removeItem('github_token');
            setGithubToken(null);
            throw new Error('Missing repo scope or token expired. Please reconnect your GitHub account.');
         }
         throw new Error(`Failed to check repository (HTTP ${checkRepoResp.status})`);
      }

      const defaultBranch = repoData.default_branch || 'main';
      addLog(`Fetching HEAD reference for ${defaultBranch} branch...`);
      const refResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, {
         headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (!refResp.ok) throw new Error('Failed to get branch reference');
      const refData = await refResp.json();
      const commitSha = refData.object.sha;

      addLog('Fetching base commit details...');
      const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${commitSha}`, {
         headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (!commitResp.ok) throw new Error('Failed to fetch commit');
      const commitData = await commitResp.json();
      const baseTreeSha = commitData.tree.sha;

      addLog('Building file tree from workspace...');
      const tree = Object.values(filesData).filter((f: any) => !f.path.endsWith('.gitkeep')).map((f: any) => {
        addLog(`Preparing file: ${f.path}`);
        return {
          path: f.path,
          mode: '100644',
          type: 'blob',
          content: f.content || ' '
        };
      });

      if (tree.length === 0) {
        addLog('Workspace is empty, adding empty placeholder file.');
        tree.push({ path: 'empty.txt', mode: '100644', type: 'blob', content: 'Empty workspace' });
      }

      addLog('Pushing file tree to GitHub...');
      const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
        method: 'POST',
        headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
        body: JSON.stringify({ base_tree: baseTreeSha, tree })
      });
      if (!treeResp.ok) throw new Error('Failed to create git tree');
      const treeData = await treeResp.json();
      const newTreeSha = treeData.sha;

      addLog('Creating new commit with files...');
      const createCommitResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
        method: 'POST',
        headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
        body: JSON.stringify({
          message: `Exported ${projectName} from AI Studio Workspace`,
          tree: newTreeSha,
          parents: [commitSha]
        })
      });
      if (!createCommitResp.ok) throw new Error('Failed to create commit');
      const newCommitData = await createCommitResp.json();
      const newCommitSha = newCommitData.sha;

      addLog('Updating branch reference to final commit...');
      const updateRefResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, {
        method: 'PATCH',
        headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
        body: JSON.stringify({ sha: newCommitSha })
      });
      if (!updateRefResp.ok) throw new Error('Failed to update branch reference');

      addLog('Successfully exported to GitHub Repository!');
      addLog(`New Repository URL: https://github.com/${owner}/${repoName}`);
      setGistExportDialog(prev => ({ ...prev, finalUrl: `https://github.com/${owner}/${repoName}` }));
    } catch (error: any) {
      console.error('Repo export failed:', error);
      addLog(`Error exporting to GitHub: ${error.message}`);
      setGistExportDialog(prev => ({ ...prev, error: error.message || 'Failed to export to GitHub' }));
    } finally {
      setIsExportingGist(false);
    }
  };

  const saveFileToAPI = useCallback(
    debounce((id: string, fileObj: any, projId: string) => {
      fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, project_id: projId, ...fileObj })
      }).catch(err => console.error("Failed to save file remotely", err));
    }, 1000),
    []
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
  
  const tree: Record<string, { id: string, name: string, path: string }[]> = {};
  fileList.forEach(f => {
      const parts = f.path.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      if (!tree[dir]) tree[dir] = [];
      tree[dir].push({ id: f.id, name: f.name, path: f.path });
  });

  const sortedDirs = Object.keys(tree).sort();

  const handleAddFile = (path: string, content: string, projId?: string) => {
      const targetProj = projId || activeProject;
      const id = `${targetProj}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const name = path.split('/').pop() || id;
      const type = path.split('.').pop() || 'txt';
      const fileObj = { name, path, content, type };
      
      setFilesData(prev => ({
          ...prev,
          [id]: fileObj
      }));
      setActiveFile(id);
      setOpenedTabs(prev => prev.includes(id) ? prev : [...prev, id]);

      if (targetProj) saveFileToAPI(id, fileObj, targetProj);
  };

  const handleDeleteFile = (id: string) => {
      if (!confirm("Are you sure you want to delete this file?")) return;
      
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
          handleAddFile('Makefile', 'all:\n\t@echo "Project initialized"', id);
          handleAddFile('ai_context.md', '# Global AI Project Configuration\n\nThis is a global prompt for all files generated by the AI.\nWrite your general instructions here.', id);
          handleAddFile('src/.gitkeep', '', id);
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
              <h1 className="text-sm font-semibold text-white">FPGA Workspace</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  EP4CE55F23I7N
                </span>
                <span>•</span>
                <span>Icarus + GTKWave + Quartus</span>
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
          <button 
            onClick={handleExportZip}
            disabled={isExporting}
            className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Exporting...' : 'Export to ZIP'}
          </button>
          {githubToken ? (
            <button 
              onClick={handleExportGist}
              disabled={isExportingGist}
              className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Github className="w-3.5 h-3.5" />
              {isExportingGist ? 'Exporting...' : 'Export to GitHub'}
            </button>
          ) : (
            <button 
              onClick={() => handleConnectGitHub()}
              className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Github className="w-3.5 h-3.5" />
              Connect GitHub
            </button>
          )}
          
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
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Ollama Chat Left Panel */}
        {isChatOpen && (
          <div className="w-1/3 min-w-[350px] max-w-[450px] border-r border-white/10 flex flex-col z-20 bg-[#16161a] shrink-0">
            <OllamaChat 
               onAddFile={handleAddFile} 
               activeFileId={activeFile} 
               activeFilePath={filesData[activeFile]?.path || null} 
               activeFileContent={filesData[activeFile]?.content || null} 
               projectContext={Object.values(filesData).find((f: any) => f.path === 'ai_context.md' || f.name === 'ai_context.md')?.content || null}
               onProposeMerge={setProposedMergeCode}
               input={chatInput}
               setInput={setChatInput}
               allFiles={filesData}
            />
          </div>
        )}

        {/* Editor Area (Middle) */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
          <div className="flex bg-[#121214] border-b border-black/50 overflow-x-auto no-scrollbar shrink-0">
            {openedTabs.map(id => (
              <div 
                key={id} 
                onClick={() => setActiveFile(id)} 
                className={`flex items-center gap-2 px-4 py-2 border-r border-white/5 cursor-pointer text-sm transition-colors ${activeFile === id ? 'bg-[#1e1e1e] text-slate-200 border-t border-t-emerald-500' : 'bg-[#16161a] text-slate-500 hover:text-slate-300 border-t border-transparent'}`}
              >
                <FileCode2 className="w-3 h-3" />
                <span>{filesData[id]?.name}</span>
                <button onClick={(e) => closeTab(e, id)} className="hover:bg-white/10 rounded-md p-0.5 ml-1 transition-colors"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-hidden relative">
            {activeFile ? (
              <Editor
                height="100%"
                theme={editorTheme}
                language={
                  ['v', 'verilog'].includes(filesData[activeFile]?.type) ? 'verilog' :
                  ['tcl', 'sdc'].includes(filesData[activeFile]?.type) ? 'tcl' :
                  ['sh', 'bash'].includes(filesData[activeFile]?.type) ? 'shell' :
                  ['makefile', 'Makefile'].includes(filesData[activeFile]?.type) ? 'makefile' : 'plaintext'
                }
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
                options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: 'on' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a file to edit</div>
            )}
          </div>
        </div>

        {/* Sidebar Project Tree (Right) */}
        <div className="w-64 bg-[#121214] border-l border-white/10 flex flex-col z-10 hidden lg:flex shrink-0">
          <div className="p-4 overflow-y-auto w-full">
             <div className="flex items-center justify-between mb-3 w-full">
               <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project</h2>
               <div className="flex items-center gap-2">
                 <button onClick={async () => {
                     const newPath = await customPrompt("Enter complete new folder path (e.g. verilog/src/new_folder):");
                     if (newPath) {
                         const folderPath = newPath.endsWith('/') ? newPath : newPath + '/';
                         handleAddFile(folderPath + '.gitkeep', "");
                     }
                 }} className="text-slate-400 hover:text-white" title="New Folder"><FolderPlus className="w-4 h-4" /></button>
                 <button onClick={async () => {
                     const newPath = await customPrompt("Enter complete new file path (e.g. verilog/src/new_file.v):");
                     if (newPath) {
                         handleAddFile(newPath, "// New file\n");
                     }
                 }} className="text-slate-400 hover:text-white" title="New File"><FilePlus className="w-4 h-4" /></button>
               </div>
             </div>
            <div className="space-y-4">
              {sortedDirs.map(dir => (
                <div key={dir}>
                  <div className="flex items-center gap-2 text-sm text-slate-200 py-1.5 font-medium">
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>{dir || 'root'}</span>
                  </div>
                  <div className="pl-5 space-y-1 border-l border-white/5 ml-2 mt-1">
                    {tree[dir].map(file => (
                      <div 
                        key={file.id}
                        onClick={() => { setActiveFile(file.id); setOpenedTabs(p => p.includes(file.id) ? p : [...p, file.id]); }}
                        className={`group pl-2 py-1 pr-1 flex items-center justify-between cursor-pointer transition-colors ${activeFile === file.id ? 'text-emerald-400 bg-emerald-500/10 rounded' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded'}`}
                      >
                        <div className="flex items-center gap-2 text-[13px] overflow-hidden min-w-0">
                          <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <DropdownMenu.Root>
                           <DropdownMenu.Trigger asChild>
                              <button onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-1">
                                 <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                           </DropdownMenu.Trigger>
                           <DropdownMenu.Portal>
                              <DropdownMenu.Content align="end" sideOffset={2} className="bg-[#1e1e1e] border border-white/10 rounded-md shadow-xl py-1 min-w-[120px] z-50">
                                 <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); setChatInput((prev) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + `{${file.path}}`); setIsChatOpen(true); }} className="px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 cursor-pointer outline-none flex items-center gap-2">
                                     <Link className="w-3 h-3" /> Reference
                                 </DropdownMenu.Item>
                                 <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); handleRenameFile(file.id); }} className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2">
                                     <Type className="w-3 h-3" /> Rename
                                 </DropdownMenu.Item>
                                 <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }} className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer outline-none flex items-center gap-2">
                                     <Trash2 className="w-3 h-3" /> Delete
                                 </DropdownMenu.Item>
                              </DropdownMenu.Content>
                           </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Meld-style Diff Modal */}
      <AnimatePresence>
        {proposedMergeCode !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[#121214] border border-white/10 shadow-2xl rounded-xl w-full h-full flex flex-col overflow-hidden max-w-7xl max-h-[90vh]"
            >
              <div className="h-14 border-b border-white/10 bg-[#16161a] flex flex-wrap items-center justify-between px-6 shrink-0 gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                    <GitMerge className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 className="text-emerald-400 font-semibold text-sm">Review AI Proposal</h2>
                  <span className="hidden sm:inline-block text-xs text-slate-500 font-mono ml-4 px-2 py-1 bg-black/30 rounded border border-white/5">{filesData[activeFile]?.path}</span>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => setProposedMergeCode(null)} className="px-4 py-2 rounded-md border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors">Discard</button>
                   <button onClick={() => {
                      handleAddFile(filesData[activeFile].path, proposedMergeCode);
                      setProposedMergeCode(null);
                   }} className="px-4 py-2 text-xs font-semibold bg-emerald-500/90 text-white rounded-md hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">Accept Changes</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-[#0c0c0e]">
                <ReactDiffViewer 
                  oldValue={filesData[activeFile]?.content || ''} 
                  newValue={proposedMergeCode} 
                  splitView={true} 
                  useDarkTheme={true}
                  leftTitle={`${filesData[activeFile]?.name} (Current)`}
                  rightTitle={`${filesData[activeFile]?.name} (AI Proposed)`}
                  styles={{
                    variables: {
                      dark: {
                        diffViewerBackground: '#0c0c0e',
                        diffViewerColor: '#cbd5e1',
                        diffViewerTitleBackground: '#121214',
                        diffViewerTitleColor: '#94a3b8',
                        diffViewerTitleBorderColor: '#27272a',
                        addedBackground: '#064e3b',
                        addedColor: '#34d399',
                        removedBackground: '#4c0519',
                        removedColor: '#f43f5e',
                        wordAddedBackground: '#047857',
                        wordRemovedBackground: '#9f1239',
                        addedGutterBackground: '#064e3b',
                        removedGutterBackground: '#4c0519',
                        gutterBackground: '#0c0c0e',
                        gutterBackgroundDark: '#0c0c0e',
                        highlightBackground: '#1e1e24',
                        highlightGutterBackground: '#1e1e24',
                        codeFoldGutterBackground: '#0c0c0e',
                        codeFoldBackground: '#0c0c0e',
                        emptyLineBackground: '#0c0c0e',
                        gutterColor: '#475569',
                        addedGutterColor: '#10b981',
                        removedGutterColor: '#e11d48',
                        codeFoldContentColor: '#64748b',
                      }
                    }
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt Dialog */}
      <AnimatePresence>
        {promptDialog.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1e1e1e] border border-white/10 p-6 rounded-xl w-full max-w-md shadow-2xl"
            >
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">{promptDialog.title}</h3>
              <input 
                autoFocus
                type="text"
                className="w-full bg-[#121214] border border-white/10 rounded px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                defaultValue={promptDialog.defaultValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    promptDialog.onResolve?.(e.currentTarget.value);
                    setPromptDialog(p => ({...p, isOpen: false}));
                  } else if (e.key === 'Escape') {
                    promptDialog.onResolve?.(null);
                    setPromptDialog(p => ({...p, isOpen: false}));
                  }
                }}
              />
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => {
                    promptDialog.onResolve?.(null);
                    setPromptDialog(p => ({...p, isOpen: false}));
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.parentElement?.querySelector('input');
                    promptDialog.onResolve?.(input?.value || '');
                    setPromptDialog(p => ({...p, isOpen: false}));
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GitHub Gist Export Logs Dialog */}
      <AnimatePresence>
        {gistExportDialog.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1e1e1e] border border-white/10 p-6 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white tracking-wider flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  Exporting to GitHub Repository
                </h3>
                <button 
                  onClick={() => setGistExportDialog(prev => ({...prev, isOpen: false}))}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto bg-[#121214] border border-white/5 rounded-md p-4 space-y-1.5 mb-4 shadow-inner">
                {gistExportDialog.logs.map((log, i) => (
                  <div key={i} className="text-slate-300 font-mono text-[11px] leading-relaxed break-all flex">
                    <span className="text-emerald-400 mr-3 opacity-70 w-3 font-bold select-none">{'>'}</span>
                    <span className="flex-1">{log}</span>
                  </div>
                ))}
                {gistExportDialog.error && (
                  <div className="text-rose-400 mt-2 font-mono text-[11px] leading-relaxed flex">
                    <span className="mr-3 font-bold select-none">{'!'}</span>
                    <span className="flex-1">{gistExportDialog.error}</span>
                  </div>
                )}
                {/* Scroll anchor */}
                <div 
                  ref={el => el?.scrollIntoView({ behavior: 'smooth' })} 
                  className="h-1"
                />
              </div>

              <div className="flex justify-end gap-3 mt-auto">
                <button 
                  onClick={() => setGistExportDialog(prev => ({...prev, isOpen: false}))}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                {gistExportDialog.finalUrl ? (
                  <a 
                    href={gistExportDialog.finalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white rounded transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                  >
                    <Link className="w-3.5 h-3.5" />
                    Open in GitHub
                  </a>
                ) : gistExportDialog.error ? null : (
                  <button 
                    disabled
                    className="px-4 py-2 text-xs font-semibold bg-slate-800 text-slate-400 rounded flex items-center gap-2 cursor-not-allowed"
                  >
                    <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" xmlns="http://www.w3.org/AspectRatio" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
