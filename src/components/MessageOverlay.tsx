import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import React from 'react';

interface MessageOverlayProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  type?: 'info' | 'success' | 'error';
  onClose: () => void;
}

export function MessageOverlay({ isOpen, title, message, type = 'info', onClose }: MessageOverlayProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="bg-[#1e1e1e] border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-4">
            {type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
            {type === 'info' && <AlertCircle className="w-5 h-5 text-indigo-400" />}
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h3>
          </div>
          <div className="bg-[#121214] border border-white/5 rounded-md p-4 text-xs font-mono text-slate-300 max-h-[400px] overflow-auto whitespace-pre-wrap leading-relaxed">
            {message}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
