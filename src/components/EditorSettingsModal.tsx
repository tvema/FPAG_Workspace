import { motion, AnimatePresence } from "motion/react";
import { Settings, X } from "lucide-react";

export interface EditorSettings {
  theme: string;
  fontSize: number;
  tabSize: number;
  insertSpaces: boolean;
  useTabStops: boolean;
  wordWrap: "off" | "on" | "wordWrapColumn" | "bounded";
  minimap: boolean;
  lineNumbers: "on" | "off" | "relative" | "interval";
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  cursorStyle:
    | "line"
    | "block"
    | "underline"
    | "line-thin"
    | "block-outline"
    | "underline-thin";
  smoothScrolling: boolean;
  highlightCursorWord: boolean;
  fontLigatures: boolean;
  formatOnPaste: boolean;
  bracketPairColorization: boolean;
}

export const defaultEditorSettings: EditorSettings = {
  theme: "zstate-dark",
  fontSize: 13,
  tabSize: 4,
  insertSpaces: true,
  useTabStops: true,
  wordWrap: "off",
  minimap: true,
  lineNumbers: "on",
  renderWhitespace: "none",
  cursorStyle: "line",
  smoothScrolling: false,
  highlightCursorWord: false,
  fontLigatures: false,
  formatOnPaste: true,
  bracketPairColorization: true,
};

interface EditorSettingsModalProps {
  isOpen: boolean;
  settings: EditorSettings;
  onChange: (newSettings: EditorSettings) => void;
  onClose: () => void;
}

export function EditorSettingsModal({
  isOpen,
  settings,
  onChange,
  onClose,
}: EditorSettingsModalProps) {
  const handleChange = (key: keyof EditorSettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

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
            className="bg-[#1e1e1e] border border-white/10 p-6 rounded-xl w-full max-w-xl shadow-2xl flex flex-col max-h-[80vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                Editor Settings
              </h3>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {/* Theme */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">
                  Theme
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => handleChange("theme", e.target.value)}
                  className="bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="zstate-dark">ZState Dark</option>
                  <option value="zstate-light">ZState Light</option>
                  <option value="zstate-hc-black">High Contrast Black</option>
                  <option value="vs-dark">VS Dark</option>
                  <option value="vs">VS Light</option>
                </select>
              </div>

              {/* Font Size & Tab Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Font Size
                  </label>
                  <input
                    type="number"
                    value={settings.fontSize}
                    onChange={(e) =>
                      handleChange("fontSize", parseInt(e.target.value) || 13)
                    }
                    className="bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Tab Size
                  </label>
                  <input
                    type="number"
                    value={settings.tabSize}
                    onChange={(e) =>
                      handleChange("tabSize", parseInt(e.target.value) || 4)
                    }
                    className="bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.insertSpaces}
                    onChange={(e) =>
                      handleChange("insertSpaces", e.target.checked)
                    }
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Insert Spaces
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.useTabStops}
                    onChange={(e) =>
                      handleChange("useTabStops", e.target.checked)
                    }
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Use Tab Stops
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.minimap}
                    onChange={(e) => handleChange("minimap", e.target.checked)}
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Show Minimap
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.highlightCursorWord}
                    onChange={(e) =>
                      handleChange("highlightCursorWord", e.target.checked)
                    }
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Highlight Selected Word
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.smoothScrolling}
                    onChange={(e) =>
                      handleChange("smoothScrolling", e.target.checked)
                    }
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Smooth Scrolling
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.bracketPairColorization}
                    onChange={(e) =>
                      handleChange("bracketPairColorization", e.target.checked)
                    }
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Bracket Pair Colorization
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.fontLigatures}
                    onChange={(e) =>
                      handleChange("fontLigatures", e.target.checked)
                    }
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Font Ligatures
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.formatOnPaste}
                    onChange={(e) =>
                      handleChange("formatOnPaste", e.target.checked)
                    }
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    Format on Paste
                  </span>
                </label>
              </div>

              {/* Dropdowns */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Word Wrap
                  </label>
                  <select
                    value={settings.wordWrap}
                    onChange={(e) => handleChange("wordWrap", e.target.value)}
                    className="bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="off">Off</option>
                    <option value="on">On</option>
                    <option value="wordWrapColumn">Word Wrap Column</option>
                    <option value="bounded">Bounded</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Line Numbers
                  </label>
                  <select
                    value={settings.lineNumbers}
                    onChange={(e) =>
                      handleChange("lineNumbers", e.target.value)
                    }
                    className="bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                    <option value="relative">Relative</option>
                    <option value="interval">Interval</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Cursor Style
                  </label>
                  <select
                    value={settings.cursorStyle}
                    onChange={(e) =>
                      handleChange("cursorStyle", e.target.value)
                    }
                    className="bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="line">Line</option>
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                    <option value="line-thin">Line Thin</option>
                    <option value="block-outline">Block Outline</option>
                    <option value="underline-thin">Underline Thin</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">
                    Render Whitespace
                  </label>
                  <select
                    value={settings.renderWhitespace}
                    onChange={(e) =>
                      handleChange("renderWhitespace", e.target.value)
                    }
                    className="bg-[#121214] border border-white/10 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="none">None</option>
                    <option value="boundary">Boundary</option>
                    <option value="selection">Selection</option>
                    <option value="trailing">Trailing</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
