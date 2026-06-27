import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GitMerge, Check, X, FileCode } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';

interface MultiFileMergeModalProps {
  proposedMultiMerge: Record<string, string> | null;
  setProposedMultiMerge: (val: Record<string, string> | null) => void;
  filesData: Record<string, any>;
  handleAddFile: (path: string, content: string) => void;
}

export function MultiFileMergeModal({ proposedMultiMerge, setProposedMultiMerge, filesData, handleAddFile }: MultiFileMergeModalProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [acceptedFiles, setAcceptedFiles] = useState<Set<string>>(new Set());
  const [rejectedFiles, setRejectedFiles] = useState<Set<string>>(new Set());

  // Set initial selected file if available
  React.useEffect(() => {
    if (proposedMultiMerge && Object.keys(proposedMultiMerge).length > 0 && !selectedFile) {
        setSelectedFile(Object.keys(proposedMultiMerge)[0]);
    }
  }, [proposedMultiMerge]);

  if (!proposedMultiMerge) return null;

  const filePaths = Object.keys(proposedMultiMerge);
  const pendingFiles = filePaths.filter(f => !acceptedFiles.has(f) && !rejectedFiles.has(f));

  const handleAcceptFile = (path: string) => {
    setAcceptedFiles(prev => new Set([...prev, path]));
    setRejectedFiles(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
    });
    
    // Auto-select next pending
    const nextPending = pendingFiles.find(f => f !== path);
    if (nextPending) setSelectedFile(nextPending);
  };

  const handleRejectFile = (path: string) => {
    setRejectedFiles(prev => new Set([...prev, path]));
    setAcceptedFiles(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
    });
    
    // Auto-select next pending
    const nextPending = pendingFiles.find(f => f !== path);
    if (nextPending) setSelectedFile(nextPending);
  };

  const handleApplyAll = () => {
    const toAccept = filePaths.filter(f => !rejectedFiles.has(f));
    toAccept.forEach(path => {
        handleAddFile(path, proposedMultiMerge[path]);
    });
    setProposedMultiMerge(null);
    setAcceptedFiles(new Set());
    setRejectedFiles(new Set());
  };

  const handleCancel = () => {
    setProposedMultiMerge(null);
    setAcceptedFiles(new Set());
    setRejectedFiles(new Set());
  };

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'v': case 'sv': return 'verilog';
        case 'c': case 'h': return 'c';
        case 'cpp': return 'cpp';
        case 'md': return 'markdown';
        case 'json': return 'json';
        case 'tcl': case 'sdc': return 'tcl';
        case 'makefile': case 'mak': case 'mk': return 'makefile';
        default: return 'plaintext';
    }
  };

  return (
    <AnimatePresence>
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
              <div className="bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-500/20">
                <GitMerge className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-indigo-400 font-semibold text-sm">Review Multi-File Changes</h2>
              <span className="hidden sm:inline-block text-xs text-slate-500 bg-black/30 px-2 py-1 rounded border border-white/5">{filePaths.length} files modified</span>
            </div>
            <div className="flex gap-3">
               <button onClick={handleCancel} className="px-4 py-2 rounded-md border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors">Discard All</button>
               <button 
                  onClick={handleApplyAll} 
                  className="px-4 py-2 text-xs font-semibold bg-indigo-500/90 text-white rounded-md hover:bg-indigo-400 transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
               >
                   Apply {pendingFiles.length === 0 ? 'Changes' : `(${filePaths.length - rejectedFiles.size} Files)`}
               </button>
            </div>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/5 bg-[#16161a] flex flex-col overflow-y-auto">
                <div className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Modified Files</div>
                {filePaths.map(path => (
                    <div 
                        key={path}
                        onClick={() => setSelectedFile(path)}
                        className={`flex items-center justify-between p-3 cursor-pointer border-l-2 transition-colors ${
                            selectedFile === path ? 'bg-white/10 border-indigo-500' : 'border-transparent hover:bg-white/5'
                        }`}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileCode className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-300 truncate" title={path}>{path.split('/').pop()}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {acceptedFiles.has(path) && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            {rejectedFiles.has(path) && <X className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Diff Editor */}
            <div className="flex-1 flex flex-col bg-[#1e1e1e]">
              {selectedFile ? (
                  <>
                      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-black/20">
                          <span className="text-xs font-mono text-slate-400">{selectedFile}</span>
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => handleRejectFile(selectedFile)}
                                  className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${rejectedFiles.has(selectedFile) ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-slate-300 hover:bg-red-500/20 hover:text-red-400'}`}
                              >
                                  Reject
                              </button>
                              <button 
                                  onClick={() => handleAcceptFile(selectedFile)}
                                  className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${acceptedFiles.has(selectedFile) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400'}`}
                              >
                                  Accept
                              </button>
                          </div>
                      </div>
                      <div className="flex-1 overflow-hidden">
                          <DiffEditor
                            original={Object.values(filesData).find((f: any) => f.path === selectedFile)?.content || ''}
                            modified={proposedMultiMerge[selectedFile]}
                            language={getLanguage(selectedFile)}
                            theme="vs-dark"
                            options={{
                              renderSideBySide: window.innerWidth > 768,
                              useInlineViewWhenSpaceIsLimited: true,
                              scrollBeyondLastLine: false,
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 13,
                              minimap: { enabled: false },
                              originalEditable: false,
                              readOnly: true,
                              renderIndicators: true,
                              renderOverviewRuler: false,
                              diffAlgorithm: 'advanced',
                              smoothScrolling: true,
                              padding: { top: 16, bottom: 16 }
                            }}
                          />
                      </div>
                  </>
              ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                      Select a file to review changes
                  </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
