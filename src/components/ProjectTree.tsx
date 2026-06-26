import React from 'react';
import { ChevronRight, ChevronDown, FolderOpen, Box, MoreVertical, FilePlus, FolderPlus, FileCode2, Upload, Trash2, Link, Type, Hash, ArrowLeftRight, ArrowRightToLine, ArrowRightFromLine } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'folder' | 'module' | 'wire' | 'reg' | 'logic' | 'input' | 'output' | 'inout';
  fileId?: string;
  content?: string;
  lineStart?: number;
  children: Record<string, TreeNode>;
  is_link?: boolean;
  is_modified?: boolean;
  portDir?: string;
};

interface ProjectTreeProps {
  treeRoot: Record<string, TreeNode>;
  collapsedDirs: Record<string, boolean>;
  setCollapsedDirs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  customPrompt: (title: string, defaultValue?: string) => Promise<string | null>;
  handleAddFile: (path: string, content: string, projId?: string, is_link?: boolean, openTab?: boolean) => Promise<void>;
  setTestbenchDialog: React.Dispatch<React.SetStateAction<any>>;
  handleFileUploadMenu: (targetPath: string) => void;
  activeProject: string | null;
  handleRenameFolder: (folderPath: string) => Promise<void>;
  handleDeleteFile: (id: string) => void;
  handleRenameFile: (id: string) => Promise<void>;
  setActiveFile: (id: string) => void;
  activeFile: string | null;
  setOpenedTabs: React.Dispatch<React.SetStateAction<string[]>>;
  gitStatus: any;
  setLineJumpTarget: React.Dispatch<React.SetStateAction<number | string | null>>;
  setChatInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleGitAction: (action: string, file: string) => void;
}

export function ProjectTree({
  treeRoot,
  collapsedDirs,
  setCollapsedDirs,
  customPrompt,
  handleAddFile,
  setTestbenchDialog,
  handleFileUploadMenu,
  activeProject,
  handleRenameFolder,
  handleDeleteFile,
  handleRenameFile,
  setActiveFile,
  activeFile,
  setOpenedTabs,
  gitStatus,
  setLineJumpTarget,
  setChatInputs,
  setIsChatOpen,
  handleGitAction
}: ProjectTreeProps) {
  const renderTree = (nodes: Record<string, TreeNode>, depth: number = 0) => {
    return Object.values(nodes)
      .sort((a, b) => {
        // Folders first, then files, then modules, then IO, then wires
        const getWeight = (t: string) => t === 'folder' ? 0 : t === 'file' ? 1 : t === 'module' ? 2 : (t === 'input' || t === 'output' || t === 'inout') ? 3 : 4;
        if (getWeight(a.type) !== getWeight(b.type)) return getWeight(a.type) - getWeight(b.type);
        return a.name.localeCompare(b.name);
      })
      .map(node => {
        const hasChildren = Object.keys(node.children).length > 0;
        const isCollapsed = collapsedDirs[node.path] ?? (node.type !== 'folder'); // Default collapsed except folders

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
                {/* Folder Context Menu */}
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
                                  const folderName = name.endsWith('/') ? name : name + '/'; // force folder
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
                    
                    if (isModule || node.type === 'wire' || node.type === 'reg' || node.type === 'logic' || node.type === 'input' || node.type === 'output' || node.type === 'inout') {
                       if (node.lineStart !== undefined) {
                           setLineJumpTarget(node.lineStart);
                       } else {
                           const isSignal = !isModule;
                           setLineJumpTarget(isSignal ? `REGEX:^\\s*(?:input|output|inout|wire|reg|logic)[^;]*\\b${node.name}\\b` : `REGEX:^\\s*module\\s+${node.name}\\b`);
                       }
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
                 ) : node.type === 'input' ? (
                    <ArrowRightToLine className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                 ) : node.type === 'output' ? (
                    <ArrowRightFromLine className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                 ) : node.type === 'inout' ? (
                    <ArrowLeftRight className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                 ) : node.type === 'reg' ? (
                    <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] font-bold text-rose-400 bg-rose-400/10 rounded">r</div>
                 ) : node.type === 'wire' ? (
                    <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] font-bold text-cyan-400 bg-cyan-400/10 rounded">w</div>
                 ) : node.type === 'logic' ? (
                    <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] font-bold text-purple-400 bg-purple-400/10 rounded">l</div>
                 ) : (
                    <Hash className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                 )}
                 <span className={`truncate ${(isModule || node.type === 'input' || node.type === 'output' || node.type === 'inout' || node.type === 'reg' || node.type === 'wire' || node.type === 'logic') ? 'hover-ctrl-underline' : ''} ${isModule ? 'text-indigo-300' : ''} ${node.type === 'input' ? 'text-emerald-200' : node.type === 'output' ? 'text-amber-200' : node.type === 'inout' ? 'text-blue-200' : node.type === 'reg' ? 'text-rose-200' : node.type === 'wire' ? 'text-cyan-200' : node.type === 'logic' ? 'text-purple-200' : ''}`}>{node.name}</span>
                 {gitMarker}
               </div>
               
               { (isFile || isModule) && (
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
                        {isFile && node.fileId && (
                        <DropdownMenu.Item onClick={(e) => { e.stopPropagation(); handleRenameFile(node.fileId!); }} className="px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer outline-none flex items-center gap-2">
                            <Type className="w-3 h-3" /> Rename
                        </DropdownMenu.Item>
                        )}
                        {isFile && node.fileId && (
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
               )}
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

  return <>{renderTree(treeRoot)}</>;
}
