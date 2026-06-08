import React, { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface BuildDialogProps {
  isOpen: boolean;
  logs: string[];
  error: string | null;
  isProcessing: boolean;
  onClose: () => void;
}

export function BuildDialog({ isOpen, logs, error, isProcessing, onClose }: BuildDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, error]);

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
            <Dialog.Content 
              asChild
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] p-6 pt-12"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    Local Server Build
                  </h3>
                  <button 
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div 
                  ref={scrollRef}
                  className="p-4 h-[500px] overflow-y-auto font-mono text-[13px] bg-[#0d0d0d] text-slate-300 leading-relaxed whitespace-pre"
                >
                  {logs.map((log, i) => (
                    <div key={i} className="mb-0.5">
                      <span className="text-emerald-500/30 mr-3 border-r border-slate-700/50 pr-3 select-none inline-block w-[30px] text-right">
                        {i + 1}
                      </span>
                      {log}
                    </div>
                  ))}
                  {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 flex items-start gap-2 whitespace-pre-wrap">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>{error}</div>
                    </div>
                  )}
                  {!isProcessing && !error && logs.length > 0 && (
                    <div className="mt-4 text-emerald-400 flex items-center gap-2 border-t border-emerald-500/20 pt-4">
                      <CheckCircle2 className="w-4 h-4" />
                      Make process completed successfully.
                    </div>
                  )}
                  {isProcessing && (
                     <div className="mt-4 text-slate-500 flex items-center gap-2 animate-pulse">
                        <Terminal className="w-4 h-4 text-emerald-500/50" />
                        Running...
                     </div>
                  )}
                </div>
                
                <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
                  <button 
                    onClick={onClose}
                    className="px-5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded transition-colors cursor-pointer border border-transparent hover:border-white/10"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
