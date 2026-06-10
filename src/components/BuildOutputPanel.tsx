import React from 'react';
import { Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Terminal, X } from 'lucide-react';

interface BuildOutputPanelProps {
  isOpen: boolean;
  logs: string[];
  error: string | null;
  isBuildingLocal: boolean;
  onClose: () => void;
  filesData: Record<string, { path: string }>;
  setActiveFile: (id: string) => void;
  openedTabs: string[];
  setOpenedTabs: React.Dispatch<React.SetStateAction<string[]>>;
  editorRef: React.MutableRefObject<any>;
}

export function BuildOutputPanel({
  isOpen,
  logs,
  error,
  isBuildingLocal,
  onClose,
  filesData,
  setActiveFile,
  openedTabs,
  setOpenedTabs,
  editorRef
}: BuildOutputPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <PanelResizeHandle className="h-1 bg-[#27272a] hover:bg-emerald-500/50 transition-colors cursor-row-resize z-50 relative" />
      <Panel id="build-output" defaultSize={30} minSize={10} className="bg-[#0a0a0c] flex flex-col border-t border-white/10 relative">
         <div className="flex items-center justify-between p-2 pt-1 border-b border-white/5 bg-[#121214] shrink-0">
           <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
             <Terminal className="w-3.5 h-3.5" /> Make Output
           </div>
           <button onClick={onClose} className="text-slate-500 hover:text-white p-1 outline-none">
             <X className="w-3.5 h-3.5" />
           </button>
         </div>
          <div className="p-3 overflow-y-auto font-mono text-[12px] text-slate-300 leading-relaxed whitespace-pre flex-1">
          {logs.map((log, i) => {
            const errorMatch = log.match(/([a-zA-Z0-9_.\-\/\\]+\.[a-zA-Z0-9]+)(?::|\()(\d+)(?::|\))?\s*(.+)/);
            let clickable = null;
            if (errorMatch) {
              const file = errorMatch[1];
              const line = parseInt(errorMatch[2], 10);
              const msg = errorMatch[3];
              
              const isError = log.toLowerCase().includes('error');
              const isWarning = log.toLowerCase().includes('warning');
              const textColor = isError ? 'text-red-400 hover:text-red-300' : isWarning ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-300 hover:text-white';
              
              const matchIndex = log.indexOf(errorMatch[0]);
              const prefix = log.substring(0, matchIndex);
              
              clickable = (
                <span>
                  {prefix}
                  <span 
                    className={`${textColor} hover:underline cursor-pointer`}
                    onClick={() => {
                      const fileName = file.split(/[/\\]/).pop() || file;
                      const foundId = Object.keys(filesData).find(id => filesData[id].path.endsWith(fileName));
                      if (foundId) {
                         setActiveFile(foundId);
                         if (!openedTabs.includes(foundId)) {
                           setOpenedTabs(p => [...p, foundId]);
                         }
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
          {error && (
            <div className="mt-2 text-red-400">{error}</div>
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
  );
}
