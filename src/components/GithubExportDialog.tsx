import { motion, AnimatePresence } from 'motion/react';
import { Github, X, Link } from 'lucide-react';

interface GithubExportDialogProps {
  isOpen: boolean;
  logs: string[];
  finalUrl: string | null;
  error: string | null;
  isProcessing: boolean;
  onClose: () => void;
}

export function GithubExportDialog({ isOpen, logs, finalUrl, error, isProcessing, onClose }: GithubExportDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
                Exporting to Local Git Repository
              </h3>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto bg-[#121214] border border-white/5 rounded-md p-4 space-y-1.5 mb-4 shadow-inner">
              {logs.map((log, i) => (
                <div key={i} className="text-slate-300 font-mono text-[11px] leading-relaxed break-all flex">
                  <span className="text-emerald-400 mr-3 opacity-70 w-3 font-bold select-none">{'>'}</span>
                  <span className="flex-1">{log}</span>
                </div>
              ))}
              {error && (
                <div className="text-rose-400 mt-2 font-mono text-[11px] leading-relaxed flex">
                  <span className="mr-3 font-bold select-none">{'!'}</span>
                  <span className="flex-1">{error}</span>
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
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
              {finalUrl ? (
                <a 
                  href={finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white rounded transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  <Link className="w-3.5 h-3.5" />
                  Open in GitHub
                </a>
              ) : error ? null : isProcessing ? (
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
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
