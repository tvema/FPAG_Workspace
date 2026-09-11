import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  HardDriveDownload,
  Search,
  Check,
  CheckSquare,
  Square,
  RefreshCw,
  Folder,
  FileCode2,
  AlertCircle,
  FolderGit2,
  Copy,
  Link,
  SlidersHorizontal,
  FolderCheck,
  FilePlus,
  ArrowRight
} from 'lucide-react';

interface DiskFileItem {
  path: string;
  name: string;
  size: number;
  mtime: string;
  status: 'new' | 'modified' | 'identical';
  in_project: boolean;
  is_link: boolean;
  file_id: string | null;
}

interface DiskScanResponse {
  project_id: string;
  project_name: string;
  disk_path: string;
  exists: boolean;
  total_count: number;
  new_count: number;
  modified_count: number;
  identical_count: number;
  files: DiskFileItem[];
}

interface ImportDiskFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onFilesImported: () => void;
  onOpenFolderSettings?: () => void;
}

export function ImportDiskFilesModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onFilesImported,
  onOpenFolderSettings,
}: ImportDiskFilesModalProps) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<DiskScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    count: number;
    added_count: number;
    updated_count: number;
  } | null>(null);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [linkPaths, setLinkPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'new' | 'modified' | 'identical'>('all');
  const [importAsLinksGlobal, setImportAsLinksGlobal] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const fetchDiskFiles = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setSuccessResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/disk_files`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to scan disk files');
      }
      const json: DiskScanResponse = await res.json();
      setData(json);

      // By default, pre-select all 'new' and 'modified' files for user convenience
      const preselect = new Set<string>();
      json.files.forEach((f) => {
        if (f.status === 'new' || f.status === 'modified') {
          preselect.add(f.path);
        }
      });
      setSelectedPaths(preselect);
    } catch (e: any) {
      setError(e.message || 'Ошибка сканирования папки на диске');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiskFiles();
    } else {
      setSelectedPaths(new Set());
      setSearchQuery('');
      setFilterTab('all');
      setSuccessResult(null);
      setError(null);
    }
  }, [isOpen, projectId]);

  const copyDiskPath = () => {
    if (data?.disk_path) {
      navigator.clipboard.writeText(data.disk_path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!data?.files) return [];
    let list = data.files;

    if (filterTab !== 'all') {
      list = list.filter((f) => f.status === filterTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.path.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, filterTab, searchQuery]);

  const toggleSelect = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedPaths);
    filteredFiles.forEach((f) => next.add(f.path));
    setSelectedPaths(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedPaths);
    filteredFiles.forEach((f) => next.delete(f.path));
    setSelectedPaths(next);
  };

  const selectOnlyNew = () => {
    if (!data?.files) return;
    const next = new Set<string>();
    data.files.filter((f) => f.status === 'new').forEach((f) => next.add(f.path));
    setSelectedPaths(next);
  };

  const selectOnlyModified = () => {
    if (!data?.files) return;
    const next = new Set<string>();
    data.files.filter((f) => f.status === 'modified').forEach((f) => next.add(f.path));
    setSelectedPaths(next);
  };

  const toggleLinkMode = (path: string) => {
    const next = new Set(linkPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setLinkPaths(next);
  };

  const handleImport = async () => {
    if (selectedPaths.size === 0) return;
    setImporting(true);
    setError(null);
    setSuccessResult(null);

    try {
      const filesToImport = Array.from(selectedPaths).map((p) => {
        const as_link = importAsLinksGlobal || linkPaths.has(p);
        return { path: p, as_link };
      });

      const res = await fetch(`/api/projects/${projectId}/import_disk_files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesToImport }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import files from disk');
      }

      const result = await res.json();
      setSuccessResult({
        count: result.count,
        added_count: result.added_count,
        updated_count: result.updated_count,
      });

      // Refresh project files in workspace
      onFilesImported();

      // Refresh disk status list to reflect current state
      await fetchDiskFiles();
    } catch (e: any) {
      setError(e.message || 'Ошибка импорта файлов');
    } finally {
      setImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getExtensionBadge = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.v') || lower.endsWith('.vh')) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          .V
        </span>
      );
    }
    if (lower.endsWith('.sv') || lower.endsWith('.svh')) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
          .SV
        </span>
      );
    }
    if (
      lower.endsWith('.c') ||
      lower.endsWith('.h') ||
      lower.endsWith('.cpp') ||
      lower.endsWith('.hpp')
    ) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          C/C++
        </span>
      );
    }
    if (lower.endsWith('.tcl') || lower.endsWith('.sdc') || lower.endsWith('.qsf')) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          TCL
        </span>
      );
    }
    if (lower === 'makefile' || lower.endsWith('.mk')) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
          MAKE
        </span>
      );
    }
    if (lower.endsWith('.md')) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
          MD
        </span>
      );
    }
    if (lower.endsWith('.vcd')) {
      return (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30">
          VCD
        </span>
      );
    }
    const ext = filename.split('.').pop() || 'FILE';
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/30 uppercase">
        {ext.slice(0, 4)}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-[#18181b] border border-white/15 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Добавить файлы с диска в проект
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                  {projectName}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Выборочный импорт файлов из рабочей папки на сервере в проект
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDiskFiles}
              disabled={loading || importing}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Обновить список файлов на диске"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Disk Path Bar */}
        <div className="px-6 py-2.5 bg-black/20 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FolderGit2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Папка на диске:</span>
            <code className="text-amber-200/90 font-mono bg-white/5 px-2 py-0.5 rounded truncate max-w-xl">
              {data?.disk_path || 'Загрузка...'}
            </code>
            <button
              onClick={copyDiskPath}
              className="text-slate-400 hover:text-slate-200 transition-colors shrink-0"
              title="Скопировать путь"
            >
              {copiedPath ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Скопировано
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          {onOpenFolderSettings && (
            <button
              onClick={() => {
                onClose();
                onOpenFolderSettings();
              }}
              className="text-xs text-amber-400/90 hover:text-amber-300 hover:underline flex items-center gap-1 shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Изменить папку проекта
            </button>
          )}
        </div>

        {/* Notification Banners */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successResult && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Успешно добавлено/обновлено: <strong>{successResult.count}</strong> файлов
                (новых: {successResult.added_count}, обновлено: {successResult.updated_count})
              </span>
            </div>
            <span className="text-emerald-400/80 font-medium">Файлы синхронизированы в проект</span>
          </div>
        )}

        {/* Toolbar & Filter Tabs */}
        <div className="p-6 pb-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#121214] p-1 rounded-lg border border-white/10 text-xs overflow-x-auto">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  filterTab === 'all'
                    ? 'bg-amber-500/20 text-amber-300 font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Все на диске ({data?.total_count ?? 0})
              </button>
              <button
                onClick={() => setFilterTab('new')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  filterTab === 'new'
                    ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Новые ({data?.new_count ?? 0})
              </button>
              <button
                onClick={() => setFilterTab('modified')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  filterTab === 'modified'
                    ? 'bg-amber-500/20 text-amber-300 font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Изменённые ({data?.modified_count ?? 0})
              </button>
              <button
                onClick={() => setFilterTab('identical')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  filterTab === 'identical'
                    ? 'bg-slate-700 text-slate-200 font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Идентичные ({data?.identical_count ?? 0})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по пути / имени..."
                className="w-full bg-[#121214] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Selection Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllFiltered}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/5 flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                Выбрать все ({filteredFiles.length})
              </button>
              {(data?.new_count ?? 0) > 0 && (
                <button
                  onClick={selectOnlyNew}
                  className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors border border-emerald-500/20"
                >
                  Выбрать новые ({data?.new_count})
                </button>
              )}
              {(data?.modified_count ?? 0) > 0 && (
                <button
                  onClick={selectOnlyModified}
                  className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors border border-amber-500/20"
                >
                  Выбрать изменённые ({data?.modified_count})
                </button>
              )}
              {selectedPaths.size > 0 && (
                <button
                  onClick={() => setSelectedPaths(new Set())}
                  className="px-2.5 py-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Снять выбор
                </button>
              )}
            </div>

            {/* Global Link Mode Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={importAsLinksGlobal}
                onChange={(e) => setImportAsLinksGlobal(e.target.checked)}
                className="rounded border-white/20 bg-[#121214] text-amber-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1">
                <Link className="w-3 h-3 text-amber-400" />
                Импортировать как динамические ссылки (Linked files)
              </span>
            </label>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-[260px] max-h-[420px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <p className="text-xs">Сканирование папки на сервере...</p>
            </div>
          ) : !data?.exists ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-3 border border-dashed border-white/10 rounded-xl bg-white/2">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-sm font-medium text-slate-200">Папка проекта не найдена на диске</p>
              <p className="text-xs text-slate-400 max-w-md">
                Каталог <code className="text-amber-300">{data?.disk_path}</code> пока не существует. Вы можете сначала экспортировать проект или изменить путь в настройках.
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 gap-2 border border-dashed border-white/10 rounded-xl">
              <Search className="w-8 h-8 text-slate-600" />
              <p className="text-sm">Файлы по заданным критериям не найдены</p>
              <p className="text-xs text-slate-500">Попробуйте изменить поисковый запрос или фильтр</p>
            </div>
          ) : (
            <div className="border border-white/10 rounded-xl overflow-hidden bg-[#121214]/60 divide-y divide-white/5">
              {filteredFiles.map((file) => {
                const isSelected = selectedPaths.has(file.path);
                const isLinked = importAsLinksGlobal || linkPaths.has(file.path) || file.is_link;
                const pathParts = file.path.split('/');
                const fileName = pathParts.pop() || '';
                const dirPath = pathParts.join('/');

                return (
                  <div
                    key={file.path}
                    onClick={() => toggleSelect(file.path)}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors cursor-pointer select-none group ${
                      isSelected
                        ? 'bg-amber-500/10 hover:bg-amber-500/15'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(file.path);
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>

                      {/* Ext badge */}
                      {getExtensionBadge(fileName)}

                      {/* Path & Name */}
                      <div className="flex items-baseline gap-1 min-w-0 truncate">
                        {dirPath && (
                          <span className="text-slate-500 font-mono shrink-0">
                            {dirPath}/
                          </span>
                        )}
                        <span
                          className={`font-mono font-medium truncate ${
                            isSelected ? 'text-slate-100' : 'text-slate-300'
                          }`}
                        >
                          {fileName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {/* File size */}
                      <span className="text-slate-500 font-mono text-[11px]">
                        {formatSize(file.size)}
                      </span>

                      {/* Status Badge */}
                      {file.status === 'new' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <FilePlus className="w-3 h-3" /> Новый
                        </span>
                      )}
                      {file.status === 'modified' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5" /> Изменён
                        </span>
                      )}
                      {file.status === 'identical' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> В проекте
                        </span>
                      )}

                      {/* Link toggle button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLinkMode(file.path);
                        }}
                        title={
                          isLinked
                            ? 'Файл будет импортирован как динамическая ссылка (Linked)'
                            : 'Сделать ссылкой на файл на диске'
                        }
                        className={`p-1 rounded transition-colors ${
                          isLinked
                            ? 'text-amber-400 bg-amber-500/20'
                            : 'text-slate-600 hover:text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        <Link className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-[#121214]">
          <div className="text-xs text-slate-400">
            {selectedPaths.size > 0 ? (
              <span>
                Выбрано: <strong className="text-amber-400">{selectedPaths.size}</strong> из{' '}
                {data?.total_count ?? 0} файлов
              </span>
            ) : (
              <span>Выберите файлы для добавления в проект</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10 cursor-pointer disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleImport}
              disabled={selectedPaths.size === 0 || importing}
              className="px-4 py-2 text-xs font-medium text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Импорт файлов...</span>
                </>
              ) : (
                <>
                  <HardDriveDownload className="w-3.5 h-3.5" />
                  <span>Добавить в проект ({selectedPaths.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
