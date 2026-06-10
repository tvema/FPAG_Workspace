import { useState } from 'react';
import { PromptDialog } from '../components/PromptDialog';

export function useCustomDialogs() {
  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue: string;
    onResolve: null | ((value: string | null) => void);
  }>({ isOpen: false, title: '', defaultValue: '', onResolve: null });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onResolve: null | ((value: boolean) => void);
  }>({ isOpen: false, title: '', message: '', onResolve: null });

  const [multiChoiceDialog, setMultiChoiceDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    choices: { label: string; value: string; variant?: 'primary' | 'danger' | 'secondary' }[];
    onResolve: null | ((value: string | null) => void);
  }>({ isOpen: false, title: '', message: '', choices: [], onResolve: null });

  const customPrompt = (title: string, defaultValue: string = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptDialog({
        isOpen: true,
        title,
        defaultValue,
        onResolve: resolve
      });
    });
  };

  const customConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onResolve: resolve
      });
    });
  };

  const customMultiChoice = (
    title: string, 
    message: string, 
    choices: { label: string; value: string; variant?: 'primary' | 'danger' | 'secondary' }[]
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setMultiChoiceDialog({
        isOpen: true,
        title,
        message,
        choices,
        onResolve: resolve
      });
    });
  };

  const CustomDialogsRenderer = () => (
    <>
      <PromptDialog 
        isOpen={promptDialog.isOpen}
        title={promptDialog.title}
        defaultValue={promptDialog.defaultValue}
        onResolve={(val) => promptDialog.onResolve?.(val)}
        onClose={() => setPromptDialog(p => ({...p, isOpen: false}))}
      />

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e24] border border-[#27272a] shadow-2xl rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold text-white mb-2">{confirmDialog.title}</h2>
            <p className="text-sm text-slate-400 mb-6 whitespace-pre-wrap">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  confirmDialog.onResolve?.(false);
                  setConfirmDialog(p => ({...p, isOpen: false}));
                }} 
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                Cancel
              </button>
              <button 
                autoFocus 
                onClick={() => {
                  confirmDialog.onResolve?.(true);
                  setConfirmDialog(p => ({...p, isOpen: false}));
                }} 
                className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors shadow-lg shadow-emerald-500/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {multiChoiceDialog.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1e24] border border-[#27272a] shadow-2xl rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold text-white mb-2">{multiChoiceDialog.title}</h2>
            <p className="text-sm text-slate-400 mb-6 whitespace-pre-wrap">{multiChoiceDialog.message}</p>
            <div className="flex flex-col gap-3">
              {multiChoiceDialog.choices.map((choice) => (
                <button
                  key={choice.value}
                  onClick={() => {
                     multiChoiceDialog.onResolve?.(choice.value);
                     setMultiChoiceDialog(p => ({...p, isOpen: false}));
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                    choice.variant === 'primary' ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20' :
                    choice.variant === 'danger' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-500 hover:text-red-400 border border-red-500/30' :
                    'text-slate-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return { customPrompt, customConfirm, customMultiChoice, CustomDialogsRenderer };
}

