import { motion, AnimatePresence } from 'motion/react';
import { GitMerge } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';

interface DiffViewerModalProps {
  proposedMergeCode: string | null;
  setProposedMergeCode: (val: string | null) => void;
  filesData: Record<string, any>;
  activeFile: string;
  handleAddFile: (path: string, content: string) => void;
}

export function DiffViewerModal({ proposedMergeCode, setProposedMergeCode, filesData, activeFile, handleAddFile }: DiffViewerModalProps) {
  const fileType = filesData[activeFile]?.type?.toLowerCase() || '';
  const fileName = (filesData[activeFile]?.name || '').toLowerCase();
  
  const language = 
    ['v', 'sv', 'verilog'].includes(fileType) ? 'verilog' :
    ['tcl', 'sdc'].includes(fileType) ? 'tcl' :
    ['makefile', 'mak', 'mk'].includes(fileType) || fileName === 'makefile' ? 'makefile' :
    ['c', 'h'].includes(fileType) ? 'c' :
    ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'].includes(fileType) ? 'cpp' :
    ['py', 'python'].includes(fileType) ? 'python' :
    ['json'].includes(fileType) ? 'json' :
    ['xml'].includes(fileType) ? 'xml' :
    ['md', 'markdown', 'txt', 'text'].includes(fileType) ? 'markdown' :
    'plaintext';

  return (
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
            
            <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
              <DiffEditor
                original={filesData[activeFile]?.content || ''}
                modified={proposedMergeCode}
                language={language}
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
                  diffAlgorithm: 'advanced'
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
