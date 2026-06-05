import { motion, AnimatePresence } from 'motion/react';

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  defaultValue: string;
  onResolve: (val: string | null) => void;
  onClose: () => void;
}

export function PromptDialog({ isOpen, title, defaultValue, onResolve, onClose }: PromptDialogProps) {
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
            className="bg-[#1e1e1e] border border-white/10 p-6 rounded-xl w-full max-w-md shadow-2xl"
          >
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">{title}</h3>
            <input 
              autoFocus
              type="text"
              className="w-full bg-[#121214] border border-white/10 rounded px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
              defaultValue={defaultValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onResolve(e.currentTarget.value);
                  onClose();
                } else if (e.key === 'Escape') {
                  onResolve(null);
                  onClose();
                }
              }}
            />
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => {
                  onResolve(null);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.parentElement?.querySelector('input');
                  onResolve(input?.value || '');
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
