import { motion, AnimatePresence } from 'motion/react';
import { GitMerge } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface DiffViewerModalProps {
  proposedMergeCode: string | null;
  setProposedMergeCode: (val: string | null) => void;
  filesData: Record<string, any>;
  activeFile: string;
  handleAddFile: (path: string, content: string) => void;
}

export function DiffViewerModal({ proposedMergeCode, setProposedMergeCode, filesData, activeFile, handleAddFile }: DiffViewerModalProps) {
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
            
            <div className="flex-1 overflow-auto bg-[#1e1e1e]">
              <ReactDiffViewer
                oldValue={filesData[activeFile]?.content || ''}
                newValue={proposedMergeCode}
                splitView={window.innerWidth > 768}
                useDarkTheme={true}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: '#1e1e1e',
                      gutterBackground: '#16161a',
                      addedBackground: 'rgba(16, 185, 129, 0.1)',
                      addedGutterBackground: 'rgba(16, 185, 129, 0.2)',
                      wordAddedBackground: 'rgba(16, 185, 129, 0.3)',
                      removedBackground: 'rgba(239, 68, 68, 0.1)',
                      removedGutterBackground: 'rgba(239, 68, 68, 0.2)',
                      wordRemovedBackground: 'rgba(239, 68, 68, 0.3)',
                      codeFoldBackground: '#121214',
                      codeFoldContentColor: '#8b949e',
                      emptyLineBackground: '#1e1e1e'
                    }
                  },
                  line: { padding: '4px', fontSize: '13px', lineHeight: '1.5' },
                  gutter: { padding: '0 12px', minWidth: '40px' }
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
