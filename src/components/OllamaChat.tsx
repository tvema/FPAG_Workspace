import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Settings, Loader2, AlertCircle, Save, GitMerge } from 'lucide-react';
import { parseVerilog } from '../utils/verilogParser';
import debounce from 'lodash.debounce';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CodeBlock = ({ lang, code, onAddFile, onProposeMerge }: { lang: string, code: string, onAddFile: (p: string, c: string) => void, onProposeMerge: (code: string) => void }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [path, setPath] = useState(`src/new_module.v`);

    return (
        <div className="my-3 border border-white/10 rounded-lg overflow-hidden bg-[#0c0c0e]">
            <div className="bg-white/5 px-3 py-2 flex flex-wrap justify-between items-center text-xs text-slate-400 border-b border-white/10 gap-2">
                <span>{lang || 'code'}</span>
                {!isSaving ? (
                    <div className="flex gap-2">
                        <button onClick={() => onProposeMerge(code)} className="flex items-center gap-1.5 hover:text-white transition-colors text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 hover:bg-emerald-500/20" title="Merge this block">
                            <GitMerge className="w-3.5 h-3.5" /> Merge with active
                        </button>
                        <button onClick={() => setIsSaving(true)} className="flex items-center gap-1.5 hover:text-white transition-colors text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 hover:bg-indigo-500/20">
                            <Save className="w-3.5 h-3.5" /> Save New
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            value={path} 
                            onChange={e => setPath(e.target.value)}
                            className="bg-black/50 border border-white/20 rounded px-2 py-1 text-white w-48 text-[11px] focus:outline-none focus:border-indigo-500"
                            placeholder="src/module.v"
                            autoFocus
                        />
                        <button onClick={() => { onAddFile(path, code); setIsSaving(false); }} className="text-emerald-400 hover:text-emerald-300 font-semibold px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors">
                            Save
                        </button>
                        <button onClick={() => setIsSaving(false)} className="text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors">
                            Cancel
                        </button>
                    </div>
                )}
            </div>
            <pre className="p-3 overflow-x-auto text-[12px] font-mono text-slate-300 selection:bg-emerald-500/30 max-h-64 overflow-y-auto">
                {code}
            </pre>
        </div>
    );
};

const MessageContent = React.memo(function MessageContent({ content, onAddFile, onProposeMerge, onProposeMultiMerge }: { content: string, onAddFile: (path: string, content: string) => void, onProposeMerge: (code: string) => void, onProposeMultiMerge?: (files: Record<string, string>) => void }) {
    const [viewMode, setViewMode] = useState<'render' | 'raw'>('render');
    
    // Check if there are any <file path="..."> blocks
    const multiFiles = useMemo(() => {
        const fileRegex = /<file\s+(?:[^>]*?)path=(?:['"]([^'"]+)['"]|([^\s>]+))[^>]*>\s*([\s\S]*?)\s*(?:<\/file>|--- END FILE ---|(?=<file\s)|$)/gi;
        const matches = [...content.matchAll(fileRegex)];
        if (matches.length > 0) {
            const files: Record<string, string> = {};
            matches.forEach(m => {
                let fileContent = m[3].trim();
                if (fileContent.startsWith('```')) {
                    const firstNewline = fileContent.indexOf('\n');
                    if (firstNewline !== -1) {
                        fileContent = fileContent.substring(firstNewline + 1);
                    }
                    if (fileContent.endsWith('```')) {
                        fileContent = fileContent.substring(0, fileContent.length - 3).trim();
                    }
                }
                files[m[1] || m[2]] = fileContent;
            });
            return files;
        }
        return null;
    }, [content]);

    const parts = useMemo(() => {
        let text = content;
        if (multiFiles) {
            text = text.replace(/```xml\s*<file\s+(?:[^>]*?)path=(?:['"]([^'"]+)['"]|([^\s>]+))[^>]*>\s*([\s\S]*?)\s*(?:<\/file>|--- END FILE ---|(?=<file\s)|$)\s*```/gi, '\n[File block extracted]\n');
            text = text.replace(/```\s*<file\s+(?:[^>]*?)path=(?:['"]([^'"]+)['"]|([^\s>]+))[^>]*>\s*([\s\S]*?)\s*(?:<\/file>|--- END FILE ---|(?=<file\s)|$)\s*```/gi, '\n[File block extracted]\n');
            text = text.replace(/<file\s+(?:[^>]*?)path=(?:['"]([^'"]+)['"]|([^\s>]+))[^>]*>\s*([\s\S]*?)\s*(?:<\/file>|--- END FILE ---|(?=<file\s)|$)/gi, '\n[File block extracted]\n');
        }
        
        const result = [];
        let currentIndex = 0;
        
        while (currentIndex < text.length) {
            const startIdx = text.indexOf('```', currentIndex);
            if (startIdx === -1) {
                result.push(text.slice(currentIndex));
                break;
            }
            
            // Text before the block
            if (startIdx > currentIndex) {
                result.push(text.slice(currentIndex, startIdx));
            }
            
            // Find the end of the line where ``` is
            const firstLineEnd = text.indexOf('\n', startIdx);
            if (firstLineEnd === -1) {
                result.push(text.slice(startIdx));
                break;
            }
            
            const lang = text.slice(startIdx + 3, firstLineEnd).trim();
            let endIdx = -1;

            if (lang === 'markdown') {
                let searchStart = firstLineEnd + 1;
                while(true) {
                    const nextTick = text.indexOf('\n```', searchStart - 1);
                    if (nextTick === -1) break;
                    
                    const lineEnd = text.indexOf('\n', nextTick + 1);
                    const afterTicks = text.slice(nextTick + 4, lineEnd === -1 ? undefined : lineEnd).trim();
                    
                    if (afterTicks !== '') {
                        // Opening an inner block with a language. Skip to its closing tag.
                        const closingTick = text.indexOf('\n```', lineEnd === -1 ? text.length : lineEnd);
                        if (closingTick === -1) {
                            endIdx = nextTick;
                            break;
                        }
                        const closingLineEnd = text.indexOf('\n', closingTick + 1);
                        searchStart = closingLineEnd === -1 ? text.length : closingLineEnd + 1;
                    } else {
                        // It has NO language. Look ahead.
                        const lookaheadTick = text.indexOf('\n```', lineEnd === -1 ? text.length : lineEnd + 1);
                        if (lookaheadTick === -1) {
                            endIdx = nextTick;
                            break;
                        }
                        
                        const lookaheadLineEnd = text.indexOf('\n', lookaheadTick + 1);
                        const lookaheadAfterTicks = text.slice(lookaheadTick + 4, lookaheadLineEnd === -1 ? undefined : lookaheadLineEnd).trim();
                        
                        if (lookaheadAfterTicks !== '') {
                            // Lookahead has a language, so current tick MUST be closing the markdown block
                            endIdx = nextTick;
                            break;
                        } else {
                            // Pair them up as an inner block
                            searchStart = lookaheadLineEnd === -1 ? text.length : lookaheadLineEnd + 1;
                        }
                    }
                }
            }
            
            if (endIdx === -1) {
                // We are looking for the closing ``` on a new line
                let searchStart = firstLineEnd + 1;
                
                while (true) {
                    const possibleEnd = text.indexOf('\n```', searchStart - 1); // -1 to catch if it's right at the start
                    if (possibleEnd === -1) {
                        break;
                    }
                    
                    // Check what's after ```
                    const afterTicks = possibleEnd + 4;
                    if (afterTicks >= text.length || text[afterTicks] === '\n' || text[afterTicks] === '\r') {
                        endIdx = possibleEnd;
                        break;
                    } else {
                        searchStart = afterTicks;
                    }
                }
            }
            
            if (endIdx === -1) {
                result.push(text.slice(startIdx));
                break;
            }
            
            let blockStr = text.slice(startIdx, endIdx + 4);
            result.push(blockStr);
            currentIndex = endIdx + 4;
        }
        
        return result;
    }, [content, multiFiles]);
    
    return (
        <div className="relative group text-[13px] leading-relaxed whitespace-pre-wrap w-full">
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10 -mt-2">
                {viewMode === 'raw' && (
                    <button 
                        onClick={() => {
                            const sel = window.getSelection()?.toString();
                            if (sel) onProposeMerge(sel);
                        }} 
                        className="bg-[#1e1e1e] border border-white/10 px-2 py-0.5 rounded text-[10px] hover:bg-white/10 text-slate-300 shadow-md"
                    >
                        Merge Selected
                    </button>
                )}
                <button onClick={() => setViewMode(viewMode === 'raw' ? 'render' : 'raw')} className="bg-[#1e1e1e] border border-white/10 px-2 py-0.5 rounded text-[10px] hover:bg-white/10 text-slate-300 shadow-md">
                    {viewMode === 'raw' ? 'Render' : 'Raw Text'}
                </button>
            </div>
            {viewMode === 'raw' ? (
                <pre className="whitespace-pre-wrap font-mono text-[12px] bg-black/20 p-3 pt-6 rounded-md break-all mt-2">
                    {content}
                </pre>
            ) : (
                <div className="pt-2">
                    {parts.map((part, i) => {
                        if (part.startsWith('```') && part.endsWith('```')) {
                            const lines = part.split('\n');
                            const lang = lines[0].slice(3).trim();
                            const code = lines.slice(1, -1).join('\n');
                            return <CodeBlock key={i} lang={lang} code={code} onAddFile={onAddFile} onProposeMerge={onProposeMerge} />;
                        }
                        return <span key={i}>{part}</span>;
                    })}
                    
                    {multiFiles && (
                        <div className="mt-4 border border-indigo-500/20 rounded-md overflow-hidden bg-indigo-500/5">
                            <div className="bg-indigo-500/10 px-3 py-2 flex justify-between items-center text-xs font-semibold text-indigo-300">
                                <span>Multiple Files Modified ({Object.keys(multiFiles).length})</span>
                                {onProposeMultiMerge && (
                                    <button 
                                        onClick={() => onProposeMultiMerge(multiFiles)}
                                        className="bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-400 transition-colors shadow-sm"
                                    >
                                        Review Merge
                                    </button>
                                )}
                            </div>
                            <div className="p-2 space-y-1">
                                {Object.keys(multiFiles).map(path => (
                                    <div key={path} className="text-[11px] font-mono text-slate-400 bg-black/20 px-2 py-1 rounded">
                                        {path}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}, (prev, next) => prev.content === next.content);

function ChatInput({ input, setInput, onSend, isLoading }: { input: string, setInput: (v: string) => void, onSend: (val: string) => void, isLoading: boolean }) {
    const [localInput, setLocalInput] = useState(input);
    const lastExt = useRef(input);

    useEffect(() => {
        if (input !== lastExt.current) {
            setLocalInput(input);
            lastExt.current = input;
        }
    }, [input]);

    const debouncedSetInput = useMemo(() => debounce((val: string) => {
        lastExt.current = val;
        setInput(val);
    }, 400), [setInput]);

    const handleInputChange = (val: string) => {
        setLocalInput(val);
        debouncedSetInput(val);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (localInput.trim() && !isLoading) {
                onSend(localInput);
            }
        }
    };

    return (
        <div className="relative flex items-end gap-2 bg-[#1a1a1f] p-2 rounded-xl border border-white/10 focus-within:border-indigo-500/50 transition-colors">
          <textarea 
            value={localInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI..."
            className="w-full bg-transparent resize-none text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none min-h-[140px] max-h-64 py-2 px-2"
            rows={Math.max(7, Math.min(localInput.split('\n').length, 15))}
          />
          <button 
            onClick={() => { if (localInput.trim() && !isLoading) onSend(localInput); }}
            disabled={!localInput.trim() || isLoading}
            className="p-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white rounded-lg transition-colors shrink-0 mb-0.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
    );
}

export function OllamaChat({ onAddFile, activeFileId, activeProjectId, activeFilePath, activeFileContent, projectContext, onProposeMerge, input, setInput, allFiles, onProposeMultiMerge, chatMode, setChatMode }: { onAddFile: (path: string, code: string) => void, activeFileId: string | null, activeProjectId: string | null, activeFilePath: string | null, activeFileContent: string | null, projectContext?: string | null, onProposeMerge: (code: string) => void, input: string, setInput: (v: string) => void, allFiles?: Record<string, any>, onProposeMultiMerge?: (files: Record<string, string>) => void, chatMode: 'file' | 'project', setChatMode: (mode: 'file' | 'project') => void }) {

  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(() => {
    try {
      const stored = localStorage.getItem('ai_chat_history');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse ai chat history", e);
    }
    return {};
  });

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});

  const actualTargetId = chatMode === 'project' ? `_project_global_${activeProjectId || 'default'}` : activeFileId;

  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(messagesMap));
    } catch (e) {
      console.error("Failed to save chat history to localStorage", e);
      if (actualTargetId) {
        setErrorMap(prev => ({ 
          ...prev, 
          [actualTargetId]: "Local storage quota exceeded. The chat history is too large to be saved. Please clear the chat." 
        }));
      }
    }
  }, [messagesMap, actualTargetId]);

  const messages = actualTargetId ? (messagesMap[actualTargetId] || []) : [];
  const isLoading = actualTargetId ? (loadingMap[actualTargetId] || false) : false;
  const error = actualTargetId ? (errorMap[actualTargetId] || null) : null;

  const [showSettings, setShowSettings] = useState(false);
  
  // Settings
  const [provider, setProvider] = useState(() => localStorage.getItem('ai_provider') || 'gemini_server');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [proxy, setProxy] = useState(() => localStorage.getItem('gemini_http_proxy') || '');
  const [model, setModel] = useState(() => {
    return localStorage.getItem('gemini_model') || '';
  });

  const setError = (err: string | null, targetFileId?: string) => {
    const fileId = targetFileId || actualTargetId;
    if (!fileId) return;
    setErrorMap(prev => ({ ...prev, [fileId]: err }));
  };

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[]), targetFileId?: string) => {
    const fileId = targetFileId || actualTargetId;
    if (!fileId) return;
    setMessagesMap(prev => ({
      ...prev,
      [fileId]: typeof updater === 'function' ? updater(prev[fileId] || []) : updater
    }));
  };

  const setIsLoading = (loading: boolean, targetFileId?: string) => {
    const fileId = targetFileId || actualTargetId;
    if (!fileId) return;
    setLoadingMap(prev => ({ ...prev, [fileId]: loading }));
  };

  const aiConfig = useMemo(() => {
    if (!allFiles) return {};
    const configFile = Object.values(allFiles).find((f: any) => 
      f.path === 'ai_config.json' || 
      f.name === 'ai_config.json' ||
      f.path === '.aiconfig.json' ||
      f.name === '.aiconfig.json' ||
      f.path === 'aiconfig.json' ||
      f.name === 'aiconfig.json'
    );
    if (configFile?.content) {
      try {
        return JSON.parse(configFile.content) || {};
      } catch (e) {
        return {};
      }
    }
    return {};
  }, [allFiles]);

  const effectiveApiKey = aiConfig.api_key ?? aiConfig.apiKey ?? apiKey;
  const effectiveModel = aiConfig.model ?? model;
  const effectiveProxy = aiConfig.proxy ?? proxy;

  const isConfigApiKey = (aiConfig.api_key ?? aiConfig.apiKey) !== undefined;
  const isConfigModel = aiConfig.model !== undefined;
  const isConfigProxy = aiConfig.proxy !== undefined;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    try { localStorage.setItem('gemini_api_key', apiKey); } catch (e) {}
  }, [apiKey]);

  useEffect(() => {
    try { localStorage.setItem('ai_provider', provider); } catch (e) {}
  }, [provider]);

  useEffect(() => {
    try { localStorage.setItem('gemini_http_proxy', proxy); } catch (e) {}
  }, [proxy]);

  useEffect(() => {
    try { localStorage.setItem('gemini_model', model); } catch (e) {}
  }, [model]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (actualTargetId && chatMode !== 'project') {
      // Background fetch to update cache from server
      fetch(`/api/messages/${actualTargetId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessagesMap(m => {
              if (JSON.stringify(m[actualTargetId]) !== JSON.stringify(data)) {
                return { ...m, [actualTargetId]: data };
              }
              return m;
            });
          }
        })
        .catch(err => console.error("Failed to load messages", err));
        
      setMessagesMap(prev => {
        if (!prev[actualTargetId]) {
          return { ...prev, [actualTargetId]: [] };
        }
        return prev;
      });
    } else if (actualTargetId && chatMode === 'project') {
        setMessagesMap(prev => {
            if (!prev[actualTargetId]) {
              return { ...prev, [actualTargetId]: [] };
            }
            return prev;
          });
    }
  }, [actualTargetId, chatMode]);

  const saveMessage = async (role: string, content: string, fileId: string) => {
    if (!fileId || chatMode === 'project') return;
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, role, content })
      });
    } catch (err) {
      console.error("Failed to save message", err);
    }
  };

  const handleSend = async (text: string) => {
    const targetFileId = actualTargetId;
    if (!targetFileId || !text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInput('');
    setError(null, targetFileId);
    
    // Add file context to system prompt if available
    let promptPrefix = "";
    if (projectContext) {
      promptPrefix += `[Global Project Context / Instructions:\n\`\`\`\n${projectContext}\n\`\`\`\n]\n\n`;
    }

    if (chatMode === 'project') {
       promptPrefix += `[Project Mode Context: Below are the files in the current project.]\n`;
       if (allFiles) {
           Object.values(allFiles).forEach((f: any) => {
               if (f.path.endsWith('.v') || f.path.endsWith('.sv') || f.path.endsWith('.c') || f.path.endsWith('.cpp') || f.path.endsWith('.h') || f.path.endsWith('.tcl') || f.path.endsWith('.sdc') || f.path.endsWith('Makefile') || f.path.endsWith('.md')) {
                 promptPrefix += `\n--- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\`\n--- END FILE ---\n`;
               }
           });
       }
       promptPrefix += `\n[Instruction: You are an AI assistant in "Project Mode". You can modify multiple files to implement the user's request. Output your modified files in the following XML format:\n<file path="path/to/file">\n// full new file content here\n</file>\nProvide your explanation first, then output the XML blocks.]\n\n`;
    } else {
        // Extract file references from the message (e.g. {verilog/src/file.v})
        const referenceRegex = /\{([^}]+)\}/g;
        const matches = [...userMessage.matchAll(referenceRegex)];
        const referencedPaths = [...new Set(matches.map(m => m[1].trim()))];
        
        if (referencedPaths.length > 0 && allFiles) {
          promptPrefix += `[Referenced Files Context:]\n`;
          referencedPaths.forEach((refPath) => {
            const [filePath, moduleName, signalName] = refPath.split(':');
            const theFile = Object.values(allFiles).find((f: any) => f.path === filePath || f.name === filePath);
            
            if (theFile) {
               if (!moduleName) {
                   promptPrefix += `\n--- START OF REFERENCED FILE: ${theFile.path} ---\n\`\`\`\n${theFile.content}\n\`\`\`\n--- END OF REFERENCED FILE ---\n`;
               } else {
                   if (theFile.path.endsWith('.v') || theFile.path.endsWith('.sv')) {
                       try {
                           const modules = parseVerilog(theFile.content);
                           const mod = modules.find(m => m.name === moduleName);
                           if (mod) {
                               if (!signalName) {
                                   promptPrefix += `\n--- START OF REFERENCED MODULE HEADER: ${theFile.path}:${mod.name} ---\n\`\`\`verilog\n${mod.header}\n\`\`\`\n--- END OF REFERENCED MODULE HEADER ---\n`;
                               } else {
                                   const sig = mod.signals.find(s => s.name === signalName);
                                   if (sig) {
                                       promptPrefix += `\n--- START OF REFERENCED SIGNAL: ${theFile.path}:${mod.name}:${sig.name} ---\n\`\`\`verilog\n${sig.declaration}\n\`\`\`\n--- END OF REFERENCED SIGNAL ---\n`;
                                   }
                               }
                           }
                       } catch (e) {}
                   }
               }
            }
          });
          promptPrefix += `\n`;
        }

        if (activeFilePath) {
          promptPrefix += `[Context: User is currently working on file: ${activeFilePath}]\n`;
          if (activeFileContent) {
            promptPrefix += `[Current File Content:\n\`\`\`\n${activeFileContent}\n\`\`\`\n]\n[Instruction: Below is the user's request. Modify the code to fulfill the request. When providing the updated code, please output the FULL file content with your changes integrated, preserving the rest of the existing code so it can be directly merged. IMPORTANT: Provide your textual explanation FIRST, and output the final code block LAST.]\n\n`;
          }
        }
    }

    const newMessageObj: Message = { role: 'user', content: userMessage };
    const currentMessages = targetFileId ? (messagesMap[targetFileId] || []) : [];
    const newMessages = [...currentMessages, newMessageObj];
    setMessages(newMessages, targetFileId);
    setIsLoading(true, targetFileId);

    await saveMessage('user', userMessage, targetFileId);

    // Prepare API messages 
    const apiMessages = [...newMessages];
    if (promptPrefix && apiMessages.length > 0) {
      // temporarily prepend context to the last message for the API call
      const lastMsg = apiMessages[apiMessages.length - 1];
      apiMessages[apiMessages.length - 1] = { ...lastMsg, content: promptPrefix + lastMsg.content };
    }

    try {
      let dataMsg = null;
      
      if (provider === 'gemini_client') {
          if (!effectiveApiKey) {
             throw new Error("API Key is required for client-side Gemini requests.");
          }
          const geminiModel = effectiveModel.trim() || 'gemini-2.5-flash';
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${effectiveApiKey}`;
          
          const geminiContents = apiMessages.map((m: any) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
          }));
          
          // If effectiveProxy is an HTTP/SOCKS proxy, typical browsers cannot use it via fetch URL.
          // It's likely only valid if effectiveProxy is a CORS reverse-proxy base URL.
          const fetchUrl = (effectiveProxy && !effectiveProxy.includes('127.0.0.1') && !effectiveProxy.includes('localhost')) 
            ? `${effectiveProxy.replace(/\/$/, '')}/v1beta/models/${geminiModel}:generateContent?key=${effectiveApiKey}` 
            : apiUrl;

          let response;
          try {
             response = await fetch(fetchUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ contents: geminiContents })
             });
          } catch (fetchErr: any) {
             console.error("Native fetch error:", fetchErr);
             throw new Error(`Direct connection failed: ${fetchErr.message}. If you are using a proxy or are in a restricted region, please switch 'AI Provider' to 'Gemini (via Server)'.`);
          }
          
          if (!response.ok) {
             const errData = await response.json();
             throw new Error(`Gemini API Error: ${errData?.error?.message || response.statusText}`);
          }
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          dataMsg = { role: 'assistant', content: text };
      } else {
          // Server Proxy (Ollama or Gemini)
          const response = await fetch(`/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider,
              model: effectiveModel.trim() || undefined,
              apiKey: effectiveApiKey.trim() || undefined,
              proxy: effectiveProxy.trim() || undefined,
              messages: apiMessages,
              stream: false,
            }),
          });
          if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
               const errData = await response.json();
               if (errData.error) errorMsg = errData.error;
            } catch(e) {}
            throw new Error(errorMsg);
          }

          const data = await response.json();
          dataMsg = data.message;
      }
      
      if (dataMsg && dataMsg.role) {
        setMessages(prev => [...prev, dataMsg], targetFileId);
        await saveMessage(dataMsg.role, dataMsg.content, targetFileId);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      setError(err.message, targetFileId);
    } finally {
      setIsLoading(false, targetFileId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#16161a]">
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-[#121214] shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex bg-black/40 p-1 rounded-lg">
            <button 
              onClick={() => setChatMode('file')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chatMode === 'file' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-300'}`}
            >
              File Mode
            </button>
            <button 
              onClick={() => setChatMode('project')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chatMode === 'project' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Project Mode
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-b border-white/5 bg-[#1a1a1f]"
          >
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">AI Provider</label>
                <select 
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="gemini_server">Gemini (via Server)</option>
                  <option value="gemini_client">Gemini (Direct from Client)</option>
                  <option value="ollama_server">Ollama (via Server)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Gemini API Key (Optional) {isConfigApiKey && <span className="text-emerald-400 ml-1">(from config)</span>}</label>
                <input 
                  type="password" 
                  value={isConfigApiKey ? effectiveApiKey : apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isConfigApiKey}
                  className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  placeholder="Paste your key to bypass server limits"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Model Name (Optional) {isConfigModel && <span className="text-emerald-400 ml-1">(from config)</span>}</label>
                <input 
                  type="text" 
                  value={isConfigModel ? effectiveModel : model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isConfigModel}
                  className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  placeholder="e.g. gemini-3.5-flash (defaults to server env)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Proxy URL or Ollama Node URL {isConfigProxy && <span className="text-emerald-400 ml-1">(from config)</span>}</label>
                <input 
                  type="text" 
                  value={isConfigProxy ? effectiveProxy : proxy}
                  onChange={(e) => setProxy(e.target.value)}
                  disabled={isConfigProxy}
                  className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  placeholder="e.g. http://127.0.0.1:8080 or http://127.0.0.1:11434"
                />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
                <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-3.5 h-3.5" /> API Proxy
                </h4>
                <p className="text-[11px] text-amber-200/70 leading-relaxed">
                  Requests are proxied securely to Gemini. Adding your own key above prevents rate limit errors.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <Bot className="w-12 h-12 text-slate-500 mb-2" />
            <p className="text-sm text-slate-400 max-w-[200px]">Ask the AI to refactor code or add new logic.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[85%] ${
                msg.role === 'user' 
                  ? 'bg-indigo-500/10 text-indigo-100/90 whitespace-pre-wrap text-[13px] leading-relaxed p-3 rounded-lg' 
                  : 'text-slate-300 w-full'
              }`}>
                {msg.role === 'user' ? msg.content : <MessageContent content={msg.content} onAddFile={onAddFile} onProposeMerge={onProposeMerge} onProposeMultiMerge={onProposeMultiMerge} />}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white/5 text-slate-400 p-3 rounded-lg flex items-center gap-2 text-[13px]">
              <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-[#121214] border-t border-white/5 shrink-0">
        <ChatInput input={input} setInput={setInput} onSend={handleSend} isLoading={isLoading} />
        <div className="text-[10px] text-slate-500 text-center mt-2">
          Powered by Google Gemini.
        </div>
      </div>
    </div>
  );
}
