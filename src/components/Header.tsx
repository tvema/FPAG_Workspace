import React from 'react';
import { Cpu, ChevronRight, FilePlus, Save, Play, MessageSquare, Activity, FileText, Upload, Download, Github, GitMerge, Settings2, CheckCircle2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface HeaderProps {
  activeProject: string | null;
  setActiveProject: (id: string) => void;
  projects: { id: string; name: string }[];
  createNewProject: () => void;
  activeFile: string;
  filesData: Record<string, { is_modified?: boolean; type?: string; name?: string }>;
  saveFile: (id: string) => void;
  saveAllFiles: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (v: boolean) => void;
  updateFileUI: (id: string, updater: (s: any) => any) => void;
  fileUIStates: Record<string, any>;
  handleImportZip: () => void;
  handleExportZip: () => void;
  isExporting: boolean;
  gitStatus: any;
  handleGitAction: (action: string, path?: string, commitMessage?: string) => void;
  setGitCommitDialogState: (v: boolean) => void;
  handleRunMake: () => void;
  isBuildingLocal: boolean;
  editorTheme: string;
  setEditorTheme: (t: string) => void;
  showMinimap: boolean;
  setShowMinimap: React.Dispatch<React.SetStateAction<boolean>>;
  highlightCursorWord: boolean;
  setHighlightCursorWord: React.Dispatch<React.SetStateAction<boolean>>;
  handleEditTemplate: (type: 'v' | 'cpp') => void;
}

export function Header({
  activeProject,
  setActiveProject,
  projects,
  createNewProject,
  activeFile,
  filesData,
  saveFile,
  saveAllFiles,
  isChatOpen,
  setIsChatOpen,
  updateFileUI,
  fileUIStates,
  handleImportZip,
  handleExportZip,
  isExporting,
  gitStatus,
  handleGitAction,
  setGitCommitDialogState,
  handleRunMake,
  isBuildingLocal,
  editorTheme,
  setEditorTheme,
  showMinimap,
  setShowMinimap,
  highlightCursorWord,
  setHighlightCursorWord,
  handleEditTemplate
}: HeaderProps) {
  return (
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
           
           <div className="h-4 w-px bg-white/10 mx-1"></div>

           <button onClick={() => saveFile(activeFile)} disabled={!activeFile || !filesData[activeFile]?.is_modified} className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${!activeFile || !filesData[activeFile]?.is_modified ? 'text-slate-500 bg-white/5 cursor-not-allowed border border-white/5' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 cursor-pointer'}`}>
             <Save className="w-3.5 h-3.5" />
             Save
             <span className="text-[10px] opacity-60 ml-1">Ctrl+S</span>
           </button>
           
           <button onClick={saveAllFiles} disabled={!Object.values(filesData).some(f => f.is_modified)} className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${!Object.values(filesData).some(f => f.is_modified) ? 'text-slate-500 bg-white/5 cursor-not-allowed border border-white/5' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 cursor-pointer'}`}>
             <Save className="w-3.5 h-3.5" />
             Save All
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
        {activeFile && (['v', 'sv', 'verilog'].includes(filesData[activeFile]?.type?.toLowerCase() || '') || filesData[activeFile]?.name?.endsWith('.v') || filesData[activeFile]?.name?.endsWith('.sv')) && (
           <button 
              onClick={() => updateFileUI(activeFile, s => ({ ...s, isDiagramMode: !s.isDiagramMode }))}
              className="text-xs bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-emerald-400 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer"
           >
              {fileUIStates[activeFile]?.isDiagramMode ? <FileText className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
              {fileUIStates[activeFile]?.isDiagramMode ? 'Show Code' : 'Show Block Diagram'}
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
              <DropdownMenu.Item onClick={() => setEditorTheme('zstate-dark')} className={`px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center gap-2 ${editorTheme === 'zstate-dark' ? 'text-emerald-400 bg-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                zstate-dark
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setEditorTheme('zstate-light')} className={`px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center gap-2 ${editorTheme === 'zstate-light' ? 'text-emerald-400 bg-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                zstate-light
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setEditorTheme('zstate-hc-black')} className={`px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center gap-2 ${editorTheme === 'zstate-hc-black' ? 'text-emerald-400 bg-white/5' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                zstate-hc-black
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
              <DropdownMenu.Item onClick={() => setShowMinimap(p => !p)} className="px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center justify-between text-slate-300 hover:bg-white/5 hover:text-white">
                <span>Show Minimap</span>
                {showMinimap && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setHighlightCursorWord(p => !p)} className="px-3 py-1.5 text-xs cursor-pointer outline-none flex items-center justify-between text-slate-300 hover:bg-white/5 hover:text-white">
                <span>Auto-Highlight Cursor Word</span>
                {highlightCursorWord && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
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
  );
}
