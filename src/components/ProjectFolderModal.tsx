import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, 
  FolderGit2, 
  Check, 
  Copy, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  FileCode, 
  ChevronDown, 
  ChevronUp,
  HardDrive
} from 'lucide-react';

interface ProjectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId: string;
  projectName: string;
  onSyncFromDisk: () => void;
  onProjectUpdated?: () => void;
}

interface DiskInfo {
  id: string;
  name: string;
  disk_path: string;
  default_path: string;
  custom_path: string | null;
  is_custom: boolean;
  exists: boolean;
  files_count: number;
  files: string[];
}

export function ProjectFolderModal({
  isOpen,
  onClose,
  activeProjectId,
  projectName,
  onSyncFromDisk,
  onProjectUpdated,
}: ProjectFolderModalProps) {
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null);
  const [customPathInput, setCustomPathInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFileList, setShowFileList] = useState(false);

  const fetchDiskInfo = async () => {
    if (!activeProjectId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/disk_info`);
      if (!res.ok) throw new Error('Не удалось получить информацию о папке проекта');
      const data = await res.json();
      setDiskInfo(data);
      setCustomPathInput(data.custom_path || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка загрузки информации о диске');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeProjectId) {
      fetchDiskInfo();
    }
  }, [isOpen, activeProjectId]);

  const handleCopyPath = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (andSync: boolean = false) => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const trimmed = customPathInput.trim();
      const res = await fetch(`/api/projects/${activeProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_path: trimmed || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Ошибка при сохранении папки проекта');
      }

      await fetchDiskInfo();
      if (onProjectUpdated) onProjectUpdated();

      if (andSync) {
        onClose();
        onSyncFromDisk();
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setCustomPathInput('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-[#18181b] border border-white/10 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121214]">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <FolderGit2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Папка синхронизации проекта
                  </h3>
                  <p className="text-xs text-slate-400">
                    Проект: <span className="text-slate-200 font-medium">{projectName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Current Active Path Card */}
              <div className="bg-[#121214] border border-white/10 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                    Текущая папка на сервере
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                      diskInfo?.is_custom
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                    }`}
                  >
                    {diskInfo?.is_custom ? 'Пользовательская' : 'По умолчанию (.workspace_export)'}
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded px-3 py-2">
                  <code className="text-[12px] font-mono text-emerald-400 break-all select-all flex-1">
                    {isLoading ? 'Загрузка...' : diskInfo?.disk_path || 'Определяется...'}
                  </code>
                  {diskInfo?.disk_path && (
                    <button
                      onClick={() => handleCopyPath(diskInfo.disk_path)}
                      title="Скопировать путь"
                      className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Status indicator */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px]">
                  <div className="flex items-center gap-2">
                    {diskInfo?.exists ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Папка существует на диске
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5" /> Папка пока не создана на диске
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-slate-300">
                    <span>Найдено файлов на диске: <strong>{diskInfo?.files_count ?? 0}</strong></span>
                    {diskInfo && diskInfo.files_count > 0 && (
                      <button
                        onClick={() => setShowFileList(!showFileList)}
                        className="text-amber-400 hover:text-amber-300 underline flex items-center gap-0.5"
                      >
                        {showFileList ? 'скрыть' : 'показать'}
                        {showFileList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* File list preview */}
                {showFileList && diskInfo && diskInfo.files && diskInfo.files.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5 max-h-36 overflow-y-auto space-y-1 bg-black/20 p-2 rounded">
                    {diskInfo.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
                        <FileCode className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{file}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Path Input Form */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-medium">
                    Задать путь к рабочей папке на сервере:
                  </label>
                  {customPathInput && (
                    <button
                      onClick={handleResetToDefault}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Сбросить на стандартную
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    placeholder="Оставьте пустым для пути по умолчанию или укажите путь, например: /home/zaqc/my_fpga_project"
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500/50 transition-colors placeholder:text-slate-600"
                  />
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 Вы можете указать абсолютный путь на сервере (например, <code className="text-slate-300 bg-white/5 px-1 py-0.5 rounded font-mono">/home/zaqc/FPGA_Workspace/my_project</code>) или относительный. При нажатии «Sync from Disk» файлы будут браться именно из указанной папки.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-[#121214]">
              <button
                onClick={fetchDiskInfo}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Проверить папку
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-slate-200 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                >
                  <RefreshCw className="w-3 h-3" />
                  {isSaving ? 'Сохранение...' : 'Сохранить и Sync'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
