import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Database, AlertTriangle, ChevronLeft, ChevronRight, Folder } from 'lucide-react';

interface StorageItem {
  key: string;
  sizeBytes: number;
  projectId: string | null;
  displayName: string;
}

interface LocalStorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const extractProjectId = (key: string): string | null => {
  const match = key.match(/(proj_\d+)/);
  return match ? match[1] : null;
};

export function LocalStorageManagerModal({ isOpen, onClose }: LocalStorageManagerModalProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filter, setFilter] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [subItems, setSubItems] = useState<StorageItem[]>([]);

  const calculateSubStorage = (key: string) => {
    try {
      const val = localStorage.getItem(key);
      if (!val) {
        setSelectedKey(null);
        setSubItems([]);
        return;
      }
      const parsed = JSON.parse(val);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return;
      }
      
      const newSubItems: StorageItem[] = [];
      for (const subKey in parsed) {
         const subVal = parsed[subKey];
         const sizeBytes = JSON.stringify(subVal).length * 2;
         
         let displayName = subKey;
         if (key === 'ai_chat_history') {
             if (subKey === '_project_global') {
                 displayName = 'Global Chat (Legacy)';
             } else if (subKey.startsWith('_project_global_')) {
                 displayName = `Global Chat`;
             } else {
                 const m = subKey.match(/proj_\d+_(.*)/);
                 if (m) {
                    let filePart = m[1];
                    const lastUnderscore = filePart.lastIndexOf('_');
                    if (lastUnderscore !== -1) {
                        filePart = filePart.substring(0, lastUnderscore) + '.' + filePart.substring(lastUnderscore + 1);
                    }
                    filePart = filePart.replace(/_/g, '/');
                    displayName = `File: ${filePart}`;
                 }
             }
         }
         
         newSubItems.push({ 
           key: subKey, 
           sizeBytes,
           projectId: extractProjectId(subKey),
           displayName
         });
      }
      setSubItems(newSubItems);
    } catch (e) {
      // not a json object
    }
  };

  const calculateStorage = () => {
    let total = 0;
    const newItems: StorageItem[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        const sizeBytes = value.length * 2;
        total += sizeBytes;
        newItems.push({ 
          key, 
          sizeBytes,
          projectId: extractProjectId(key),
          displayName: key
        });
      }
    }
    
    setTotalSize(total);
    setItems(newItems);
  };

  useEffect(() => {
    if (isOpen) {
      calculateStorage();
      if (selectedKey) {
        calculateSubStorage(selectedKey);
      }
    }
  }, [isOpen, selectedKey]);

  useEffect(() => {
    setSelectedProjectId('all');
    setFilter('');
  }, [selectedKey]);

  const handleDelete = (key: string) => {
    if (window.confirm(`Are you sure you want to delete data for "${key}"?`)) {
      localStorage.removeItem(key);
      if (selectedKey === key) {
        setSelectedKey(null);
      }
      calculateStorage();
    }
  };

  const handleDeleteSubItem = (subKey: string) => {
    if (!selectedKey) return;
    if (window.confirm(`Are you sure you want to delete "${subKey}" from "${selectedKey}"?`)) {
      try {
        const val = localStorage.getItem(selectedKey);
        if (val) {
          const parsed = JSON.parse(val);
          delete parsed[subKey];
          localStorage.setItem(selectedKey, JSON.stringify(parsed));
          calculateStorage();
          calculateSubStorage(selectedKey);
        }
      } catch(e) {
        console.error("Failed to delete sub item", e);
      }
    }
  };

  const handleClearChatHistory = () => {
     if (window.confirm('Are you sure you want to clear ALL chat history?')) {
       localStorage.removeItem('ai_chat_history');
       if (selectedKey === 'ai_chat_history') setSelectedKey(null);
       calculateStorage();
     }
  }

  const handleKeyClick = (key: string) => {
    try {
      const val = localStorage.getItem(key);
      if (!val) return;
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
         setSelectedKey(key);
      }
    } catch (e) {}
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const maxStorage = 5 * 1024 * 1024;
  const percentUsed = Math.min(100, Math.round((totalSize / maxStorage) * 100));

  const currentItemsList = selectedKey ? subItems : items;

  const allProjectIds = useMemo(() => {
    const ids = new Set<string>();
    currentItemsList.forEach(item => {
       if (item.projectId) ids.add(item.projectId);
    });
    return Array.from(ids).sort();
  }, [currentItemsList]);

  const filteredAndSortedItems = useMemo(() => {
    return currentItemsList
      .filter(item => {
        if (selectedProjectId === 'none') {
           if (item.projectId !== null) return false;
        } else if (selectedProjectId !== 'all') {
           if (item.projectId !== selectedProjectId) return false;
        }
        return item.displayName.toLowerCase().includes(filter.toLowerCase()) || item.key.toLowerCase().includes(filter.toLowerCase());
      })
      .sort((a, b) => {
        if (sortOrder === 'desc') return b.sizeBytes - a.sizeBytes;
        return a.sizeBytes - b.sizeBytes;
      });
  }, [currentItemsList, sortOrder, filter, selectedProjectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-[#16161a]">
          <div className="flex items-center gap-2">
            {selectedKey ? (
              <button 
                onClick={() => setSelectedKey(null)}
                className="p-1 -ml-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-medium">Back</span>
              </button>
            ) : (
              <Database className="w-5 h-5 text-emerald-400" />
            )}
            <h2 className="text-sm font-semibold text-white ml-2">
              {selectedKey ? `Properties inside "${selectedKey}"` : 'Local Storage Manager'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!selectedKey && (
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
        )}

        <div className="p-4 border-b border-white/5 flex gap-2 shrink-0 flex-wrap items-center bg-[#1a1a1f]">
          <input 
            type="text" 
            placeholder={selectedKey ? "Search properties..." : "Search keys..."}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 min-w-[150px]"
          />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500/50 max-w-[200px]"
          >
            <option value="all">All Projects</option>
            {allProjectIds.map(pid => (
              <option key={pid} value={pid}>{pid}</option>
            ))}
            <option value="none">No Project ID</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500/50"
          >
            <option value="desc">Largest first</option>
            <option value="asc">Smallest first</option>
          </select>
          {!selectedKey && (
            <button
               onClick={handleClearChatHistory}
               className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded transition-colors border border-red-500/20"
            >
               Clear ALL Chats
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs font-medium text-slate-400 border-b border-white/5 w-full">Item Name</th>
                <th className="p-2 text-xs font-medium text-slate-400 border-b border-white/5 whitespace-nowrap">Size</th>
                <th className="p-2 text-xs font-medium text-slate-400 border-b border-white/5 w-16 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-xs text-slate-500">
                    No items found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredAndSortedItems.map(item => {
                  let isJsonObject = false;
                  if (!selectedKey) {
                    try {
                      const val = localStorage.getItem(item.key);
                      if (val) {
                        const parsed = JSON.parse(val);
                        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                          isJsonObject = true;
                        }
                      }
                    } catch(e) {}
                  }

                  return (
                    <tr key={item.key} className="group hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                      <td className="p-2">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-slate-200 break-all flex items-center gap-1.5">
                              {isJsonObject && <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              {item.displayName}
                            </span>
                            {isJsonObject && !selectedKey && (
                              <button 
                                onClick={() => handleKeyClick(item.key)}
                                className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 shrink-0"
                              >
                                Explore <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {item.displayName !== item.key && (
                            <span className="text-[10px] text-slate-500 font-mono break-all line-clamp-1" title={item.key}>
                              {item.key}
                            </span>
                          )}
                          {item.projectId && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded w-fit">
                              {item.projectId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-xs text-slate-400 whitespace-nowrap font-mono align-top pt-3">
                        {formatBytes(item.sizeBytes)}
                      </td>
                      <td className="p-2 align-top pt-2.5 text-right">
                        <button 
                          onClick={() => selectedKey ? handleDeleteSubItem(item.key) : handleDelete(item.key)}
                          className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100 ml-auto"
                          title="Delete this item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
