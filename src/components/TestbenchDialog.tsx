import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { defaultVerilogMake, defaultCppMake } from '../utils/templates';

export function TestbenchDialog({
  isOpen,
  onClose,
  filesData,
  onCreate,
  initialData,
  isEdit
}: {
  isOpen: boolean;
  onClose: () => void;
  filesData: Record<string, any>;
  onCreate: (tbName: string, filesToInclude: string[], makefileTemplate: string, tbExt: string, isEdit: boolean) => void;
  initialData?: { tbName: string, filesToInclude: string[], tbExt: string, makefileTemplate?: string };
  isEdit?: boolean;
}) {
  const [tbName, setTbName] = useState('tb_module');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [tbExt, setTbExt] = useState('.v');
  
  const getTemplate = (ext: string) => {
    const customTemplate = Object.values(filesData).find((f: any) => f.path === (ext === '.v' ? 'templates/Makefile.v.template' : 'templates/Makefile.cpp.template'));
    if (customTemplate) return customTemplate.content;
    return ext === '.v' ? defaultVerilogMake : defaultCppMake;
  };

  const [makefileTemplate, setMakefileTemplate] = useState(getTemplate('.v'));

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      if (isEdit && initialData) {
        setTbName(initialData.tbName);
        setSelectedFiles(new Set(initialData.filesToInclude));
        setTbExt(initialData.tbExt || '.v');
        setMakefileTemplate(initialData.makefileTemplate || getTemplate(initialData.tbExt || '.v'));
      } else {
        setTbName('tb_module');
        setSelectedFiles(new Set());
        setTbExt('.v');
        setMakefileTemplate(getTemplate('.v'));
      }
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const validFiles = Array.from(new Set(Object.values(filesData).filter((f: any) => 
     f.path.endsWith('.v') || f.path.endsWith('.sv') || f.path.endsWith('.c') || f.path.endsWith('.cpp')
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
      <div className="bg-[#16161a] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-[#121214]">
          <h3 className="text-sm font-medium text-slate-200">{isEdit ? 'Configure Testbench' : 'Create Testbench'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Testbench Module Name</label>
              <input 
                type="text" 
                value={tbName}
                onChange={(e) => setTbName(e.target.value)}
                disabled={isEdit}
                className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                placeholder="e.g. tb_adder"
                autoFocus
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400">Template / Extension</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                     setTbExt('.v');
                     setMakefileTemplate(getTemplate('.v'));
                  }}
                  className={`flex-1 py-2 text-xs font-medium rounded-md border transition-colors ${tbExt === '.v' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'}`}
                >
                  Verilog (.v)
                </button>
                <button 
                  onClick={() => {
                     setTbExt('.cpp');
                     setMakefileTemplate(getTemplate('.cpp'));
                  }}
                  className={`flex-1 py-2 text-xs font-medium rounded-md border transition-colors ${tbExt === '.cpp' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'}`}
                >
                  C++ (.cpp)
                </button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Left Col: Files */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-400">Select Files to Include</label>
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
              
              <div className="bg-black/30 border border-white/5 rounded-md p-2 h-48 overflow-y-auto flex flex-col gap-1">
                 {validFiles.length === 0 ? (
                     <div className="text-xs text-slate-500 text-center py-2 flex-col flex items-center justify-center h-full">No source files found</div>
                 ) : validFiles.map((path: string) => (
                   <div key={path} onClick={() => toggleFile(path)} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white/5 rounded-md shrink-0">
                     <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${selectedFiles.has(path) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-600 bg-transparent'}`}>
                        {selectedFiles.has(path) && <Check className="w-3 h-3" />}
                     </div>
                     <span className="text-xs text-slate-300 font-mono tracking-tight truncate">{path}</span>
                   </div>
                 ))}
              </div>
            </div>

            {/* Right Col: Makefile Template */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Makefile Template</span>
                <span className="text-[10px] font-mono text-slate-500">{"{{tbName}}, {{files}}"}</span>
              </label>
              <textarea
                value={makefileTemplate}
                onChange={(e) => setMakefileTemplate(e.target.value)}
                className="w-full h-48 bg-black/40 border border-white/10 rounded-md p-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500 transition-colors whitespace-pre overflow-auto"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/5 bg-[#121214] flex justify-end gap-2 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
                onCreate(tbName, Array.from(selectedFiles), makefileTemplate, tbExt, !!isEdit);
                onClose();
            }}
            disabled={!tbName || selectedFiles.size === 0 || !makefileTemplate.trim()}
            className="px-4 py-2 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEdit ? 'Save Changes' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
