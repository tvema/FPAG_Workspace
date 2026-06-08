import { motion, AnimatePresence } from 'motion/react';
import { GitMerge, FileText, FilePlus, FileMinus, X } from 'lucide-react';
import React, { useState } from 'react';

interface GitCommitDialogProps {
  isOpen: boolean;
  gitStatus: any;
  onCommit: (message: string) => void;
  onClose: () => void;
}

export function GitCommitDialog({ isOpen, gitStatus, onCommit, onClose }: GitCommitDialogProps) {
  const [message, setMessage] = useState('Workspace update');

  if (!isOpen) return null;

  const modified = gitStatus?.status?.modified || [];
  const created = gitStatus?.status?.created || [];
  const staged = gitStatus?.status?.staged || [];
  const deleted = gitStatus?.status?.deleted || [];
  const not_added = gitStatus?.status?.not_added || [];

  // Combine to show what's likely to be committed or is currently in the working tree
  // Usually, a user of this basic UI either adds specific files or implies "Commit All" depending on backend logic.
  // We'll show staged, modified, created, deleted.

  const allFiles = Array.from(new Set([...modified, ...created, ...staged, ...deleted, ...not_added]));

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
          className="bg-[#1e1e1e] border border-white/10 p-6 rounded-xl w-full max-w-lg shadow-2xl flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-indigo-400" />
              Git Commit
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-[#121214] border border-white/5 rounded-md p-3 mb-4 max-h-[300px]">
            <div className="text-xs font-semibold text-slate-400 mb-2">Changed Files Overview:</div>
            {allFiles.length === 0 ? (
               <div className="text-xs text-slate-500 italic">No changes detected.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {allFiles.map(file => {
                  const isModified = modified.includes(file);
                  const isCreated = created.includes(file) || staged.includes(file) && !modified.includes(file);
                  const isUntracked = not_added.includes(file);
                  const isDeleted = deleted.includes(file);

                  let icon = <FileText className="w-3.5 h-3.5 text-slate-500" />;
                  let colorClass = "text-slate-300";
                  let marker = "";

                  if (isUntracked) {
                    icon = <FilePlus className="w-3.5 h-3.5 text-emerald-500" />;
                    colorClass = "text-emerald-400";
                    marker = "[Untracked]";
                  } else if (isCreated) {
                    icon = <FilePlus className="w-3.5 h-3.5 text-emerald-400" />;
                    colorClass = "text-emerald-300";
                    marker = "[Added]";
                  } else if (isDeleted) {
                     icon = <FileMinus className="w-3.5 h-3.5 text-red-500" />;
                     colorClass = "text-red-400";
                     marker = "[Deleted]";
                  } else if (isModified) {
                    icon = <FileText className="w-3.5 h-3.5 text-amber-500" />;
                    colorClass = "text-amber-400";
                    marker = "[Modified]";
                  }

                  return (
                    <div key={file} className="flex items-center gap-2 text-xs">
                      {icon}
                      <span className={colorClass}>{file}</span>
                      <span className="text-[10px] font-bold opacity-70 ml-1">{marker}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-4">
             <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Commit Message</label>
             <input 
               autoFocus
               type="text"
               value={message}
               onChange={(e) => setMessage(e.target.value)}
               className="w-full bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
               placeholder="Enter commit message"
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                   onCommit(message);
                   onClose();
                 }
               }}
             />
          </div>

          <div className="flex justify-end gap-3">
             <button 
               onClick={onClose}
               className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
             >
               Cancel
             </button>
             <button 
               onClick={() => {
                 onCommit(message);
                 onClose();
               }}
               disabled={allFiles.length === 0}
               className="px-4 py-2 text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]"
             >
               Confirm Commit
             </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
