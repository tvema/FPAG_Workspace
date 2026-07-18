import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Database, AlertTriangle } from 'lucide-react';

interface StorageItem {
  key: string;
  sizeBytes: number;
}

interface LocalStorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LocalStorageManagerModal({ isOpen, onClose }: LocalStorageManagerModalProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filter, setFilter] = useState('');

  const calculateStorage = () => {
    let total = 0;
    const newItems: StorageItem[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        // Approximate size in bytes (UTF-16 uses 2 bytes per char)
        const sizeBytes = value.length * 2;
        total += sizeBytes;
        newItems.push({ key, sizeBytes });
      }
    }
    
    setTotalSize(total);
    setItems(newItems);
  };

  useEffect(() => {
    if (isOpen) {
      calculateStorage();
    }
  }, [isOpen]);

  const handleDelete = (key: string) => {
    if (window.confirm(`Are you sure you want to delete data for "${key}"?`)) {
      localStorage.removeItem(key);
      calculateStorage();
    }
  };

  const handleClearChatHistory = () => {
     if (window.confirm('Are you sure you want to clear ALL chat history?')) {
       localStorage.removeItem('ai_chat_history');
       calculateStorage();
     }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const maxStorage = 5 * 1024 * 1024; // typical browser limit 5MB
  const percentUsed = Math.min(100, Math.round((totalSize / maxStorage) * 100));

  const filteredAndSortedItems = useMemo(() => {
    return items
      .filter(item => item.key.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => {
        if (sortOrder === 'desc') return b.sizeBytes - a.sizeBytes;
        return a.sizeBytes - b.sizeBytes;
      });
  }, [items, sortOrder, filter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-[#16161a]">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Local Storage Manager</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-white/5 bg-[#1a1a1f] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Estimated Usage</span>
            <span className={`text-xs font-semibold ${percentUsed > 80 ? 'text-red-400' : 'text-emerald-400'}`}>
              {formatBytes(totalSize)} / ~5 MB ({percentUsed}%)
            </span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full ${percentUsed > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          {percentUsed > 80 && (
             <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-2 rounded flex items-start gap-2">
                 <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                 <span>Storage is almost full. The browser may reject saving new data. Try clearing large unused chat histories or old projects.</span>
             </div>
          )}
        </div>

        <div className="p-4 border-b border-white/5 flex gap-2 shrink-0">
          <input 
            type="text" 
            placeholder="Search keys..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
          />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500/50"
          >
            <option value="desc">Largest first</option>
            <option value="asc">Smallest first</option>
          </select>
          <button
             onClick={handleClearChatHistory}
             className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors border border-red-500/20"
          >
             Clear ALL Chats
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs font-medium text-slate-400 border-b border-white/5">Key</th>
                <th className="p-2 text-xs font-medium text-slate-400 border-b border-white/5 w-24">Size</th>
                <th className="p-2 text-xs font-medium text-slate-400 border-b border-white/5 w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-xs text-slate-500">
                    No items found.
                  </td>
                </tr>
              ) : (
                filteredAndSortedItems.map(item => (
                  <tr key={item.key} className="group hover:bg-white/5 border-b border-white/5 last:border-0">
                    <td className="p-2 text-[11px] font-mono text-slate-300 break-all">
                      {item.key}
                    </td>
                    <td className="p-2 text-xs text-slate-400 whitespace-nowrap">
                      {formatBytes(item.sizeBytes)}
                    </td>
                    <td className="p-2">
                      <button 
                        onClick={() => handleDelete(item.key)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete this item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
