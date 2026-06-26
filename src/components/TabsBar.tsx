import React from 'react';
import { FileCode2, X, MoreVertical, GitPullRequest, ArrowLeft } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface TabsBarProps {
  openedTabs: string[];
  activeFile: string;
  filesData: Record<string, { name: string; is_modified?: boolean; is_link?: boolean }>;
  tabsContainerRef: React.RefObject<HTMLDivElement>;
  tabsOverflowing: boolean;
  draggedTab: string | null;
  dragOverTab: string | null;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleDragOver: (e: React.DragEvent, id: string) => void;
  handleDragEnd: () => void;
  handleDrop: (e: React.DragEvent, id: string) => void;
  setActiveFile: (id: string) => void;
  closeTab: (e: React.MouseEvent, id: string) => void;
  fetchGitDiffForActiveFile: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export function TabsBar({
  openedTabs,
  activeFile,
  filesData,
  tabsContainerRef,
  tabsOverflowing,
  draggedTab,
  dragOverTab,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  handleDrop,
  setActiveFile,
  closeTab,
  fetchGitDiffForActiveFile,
  onBack,
  canGoBack
}: TabsBarProps) {
  return (
    <div className="flex bg-[#121214] border-b border-black/50 shrink-0 justify-between items-center min-w-0">
      <div className="flex items-center">
        {onBack && (
          <button 
            onClick={onBack} 
            disabled={!canGoBack}
            className={`px-3 py-2 border-r border-white/5 flex items-center justify-center transition-colors ${canGoBack ? 'text-slate-400 hover:text-white hover:bg-[#1e1e1e] cursor-pointer' : 'text-slate-700 cursor-not-allowed'}`}
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
      </div>
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
            <span>{filesData[id]?.name}{filesData[id]?.is_modified && <span className="text-emerald-400 font-bold ml-1">•</span>}</span>
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
                      <span className="truncate">{filesData[id]?.name}{filesData[id]?.is_modified && <span className="text-emerald-400 font-bold ml-1">•</span>}</span>
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
  );
}
