import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

export function TestbenchDialog({
  isOpen,
  onClose,
  filesData,
  parentPath,
  onCreate
}: {
  isOpen: boolean;
  onClose: () => void;
  filesData: Record<string, any>;
  parentPath: string;
  onCreate: (tbName: string, filesToInclude: string[]) => void;
}) {
  const [tbName, setTbName] = useState('tb_module');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setTbName('tb_module');
      setSelectedFiles(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validFiles = Array.from(new Set(Object.values(filesData).filter((f: any) => 
     f.path.endsWith('.v') || f.path.endsWith('.sv')
  ).map((f: any) => f.path as string)));

  const toggleFile = (path: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      return newSet;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#16161a] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-[#121214]">
          <h3 className="text-sm font-medium text-slate-200">Create Testbench</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400">Testbench Module Name</label>
            <input 
              type="text" 
              value={tbName}
              onChange={(e) => setTbName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. tb_adder"
              autoFocus
            />
          </div>
          
          <div className="flex justify-between items-center">
            <label className="text-xs text-slate-400">Select Verilog Files to Include in Build</label>
            <button 
              className="text-[10px] text-indigo-400 hover:underline"
              onClick={() => {
                if (validFiles.length > 0 && selectedFiles.size === validFiles.length) {
                  setSelectedFiles(new Set());
                } else {
                  setSelectedFiles(new Set(validFiles));
                }
              }}
            >
              {validFiles.length > 0 && selectedFiles.size === validFiles.length ? 'Unselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="bg-black/30 border border-white/5 rounded-md p-2 max-h-48 overflow-y-auto flex flex-col gap-1">
             {validFiles.length === 0 ? (
                 <div className="text-xs text-slate-500 text-center py-2">No .v / .sv files found in project</div>
             ) : validFiles.map((path: string) => (
               <div key={path} onClick={() => toggleFile(path)} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white/5 rounded-md">
                 <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${selectedFiles.has(path) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-600 bg-transparent'}`}>
                    {selectedFiles.has(path) && <Check className="w-3 h-3" />}
                 </div>
                 <span className="text-xs text-slate-300 font-mono tracking-tight">{path}</span>
               </div>
             ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/5 bg-[#121214] flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
                onCreate(tbName, Array.from(selectedFiles));
                onClose();
            }}
            disabled={!tbName || selectedFiles.size === 0}
            className="px-4 py-2 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
