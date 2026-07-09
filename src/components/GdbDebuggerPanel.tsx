import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  ArrowRightCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Square,
  RotateCcw,
  TerminalSquare,
  XCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

export function GdbDebuggerPanel({
  fileId,
  filePath,
  projectId,
  filesData,
  onClose,
  breakpoints,
  setBreakpoints,
  onNavigate,
}: {
  fileId: string;
  filePath: string;
  projectId: string | null;
  filesData?: Record<string, any>;
  onClose: () => void;
  breakpoints?: Record<string, number[]>;
  setBreakpoints?: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  onNavigate?: (fileId: string, line: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<"variables" | "callstack" | "breakpoints">(() => {
    const cached = localStorage.getItem("gdb_panel_active_tab");
    return (cached as any) || "variables";
  });
  const [isConsoleOpen, setIsConsoleOpen] = useState(() => {
    const cached = localStorage.getItem("gdb_panel_console_open");
    return cached ? JSON.parse(cached) : true;
  });

  useEffect(() => {
    localStorage.setItem("gdb_panel_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem("gdb_panel_console_open", JSON.stringify(isConsoleOpen));
  }, [isConsoleOpen]);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [programState, setProgramState] = useState<"none" | "running" | "stopped" | "exited">("none");
  const wsRef = useRef<WebSocket | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const [variables, setVariables] = useState<Array<{ name: string, value: string, type: string, expanded: boolean }>>([]);
  const [callstack, setCallstack] = useState<Array<{ id: number, frame: string, file: string, line: number, active: boolean }>>([]);
  const [disabledBreakpoints, setDisabledBreakpoints] = useState<Set<string>>(new Set());

  // Keep track of which breakpoints we have actually sent to GDB
  const activeGdbBreakpointsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    // Sync breakpoints dynamically
    Object.entries(breakpoints || {}).forEach(([fid, lines]) => {
      const p = (filesData && filesData[fid]) ? filesData[fid].path : fid;
      lines.forEach(line => {
        const bpId = `${fid}-${line}`;
        const shouldBeActive = !disabledBreakpoints.has(bpId);
        const isActiveInGdb = activeGdbBreakpointsRef.current.has(bpId);

        if (shouldBeActive && !isActiveInGdb) {
          wsRef.current?.send(JSON.stringify({ type: 'command', command: `-break-insert ${p}:${line}` }));
          activeGdbBreakpointsRef.current.add(bpId);
        } else if (!shouldBeActive && isActiveInGdb) {
          // Clear it in GDB (GDB CLI command 'clear file:line' can be used as MI command via -interpreter-exec console "clear file:line")
          wsRef.current?.send(JSON.stringify({ type: 'command', command: `-interpreter-exec console "clear ${p}:${line}"` }));
          activeGdbBreakpointsRef.current.delete(bpId);
        }
      });
    });

    // Handle deleted breakpoints from the editor
    activeGdbBreakpointsRef.current.forEach(bpId => {
      const [fid, lineStr] = bpId.split('-');
      const line = parseInt(lineStr, 10);
      if (!breakpoints?.[fid]?.includes(line)) {
        // Was removed from editor
        const p = (filesData && filesData[fid]) ? filesData[fid].path : fid;
        wsRef.current?.send(JSON.stringify({ type: 'command', command: `-interpreter-exec console "clear ${p}:${line}"` }));
        activeGdbBreakpointsRef.current.delete(bpId);
      }
    });
  }, [breakpoints, disabledBreakpoints, filesData]);

  useEffect(() => {
    // Scroll to bottom when output changes
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleOutput]);

  const autoRunRef = useRef(false);

  const parseMIString = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  };

  const parseMIVariables = (line: string) => {
    const vars: any[] = [];
    const regex = /{name="([^"]+)",.*?type="([^"]+)"(?:,value="([^"]+)")?}/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      vars.push({
        name: match[1],
        type: match[2],
        value: match[3] || "<complex>",
        expanded: false
      });
    }
    if (vars.length > 0) setVariables(vars);
  };

  const parseMIStack = (line: string) => {
    const frames: any[] = [];
    let topFrameFile = "";
    let topFrameLine = 0;
    
    const framesStr = line.split('frame={').slice(1);
    framesStr.forEach(fStr => {
      const getVal = (key: string) => {
        const m = fStr.match(new RegExp(key + '="([^"]+)"'));
        return m ? m[1] : "";
      };
      
      const level = getVal("level");
      const func = getVal("func");
      const fileRaw = getVal("file") || getVal("fullname");
      const lineNum = parseInt(getVal("line") || "0");
      const addr = getVal("addr");

      frames.push({
        id: parseInt(level || "0"),
        frame: `#${level} ${func} at ${addr}`,
        file: fileRaw,
        line: lineNum,
        active: level === "0"
      });
      if (level === "0" && fileRaw && lineNum > 0) {
        topFrameFile = fileRaw;
        topFrameLine = lineNum;
      }
    });

    if (frames.length > 0) {
      setCallstack(frames);
      if (topFrameFile && onNavigate && filesData) {
        // Find matching fileId
        const fileId = Object.keys(filesData).find(fid => {
          const p = filesData[fid].path.replace(/^\.\//, '');
          return topFrameFile.endsWith(p) || p.endsWith(topFrameFile);
        }) || topFrameFile;
        onNavigate(fileId, topFrameLine);
      }
    }
  };

  const startGdb = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const wsUrl = window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setVariables([]);
    setCallstack([]);
    setProgramState("none");
    autoRunRef.current = false;

    ws.onopen = () => {
      setConsoleOutput(["Connected to GDB backend. Starting session..."]);
      
      const mappedBreakpoints: Record<string, number[]> = {};
      Object.entries(breakpoints || {}).forEach(([fid, lines]) => {
        const p = (filesData && filesData[fid]) ? filesData[fid].path : fid;
        lines.forEach(line => {
          const bpId = `${fid}-${line}`;
          if (!disabledBreakpoints.has(bpId)) {
            if (!mappedBreakpoints[p]) mappedBreakpoints[p] = [];
            mappedBreakpoints[p].push(line);
          }
        });
      });

      ws.send(JSON.stringify({
        type: 'start',
        projectId: projectId || 'default',
        breakpoints: mappedBreakpoints
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output' || msg.type === 'error') {
        const lines = msg.data.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          
          if (line.trim() === '(gdb)' && !autoRunRef.current) {
            autoRunRef.current = true;
            sendCommand("-exec-run");
            setProgramState("running");
          }

          if (line.startsWith('~') || line.startsWith('@') || line.startsWith('&')) {
            setConsoleOutput(prev => [...prev, parseMIString(line.substring(1))]);
          } else if (line.startsWith('*stopped')) {
            setProgramState("stopped");
            setConsoleOutput(prev => [...prev, "Program stopped."]);
            // Program stopped, fetch stack and variables
            ws.send(JSON.stringify({ type: 'command', command: '-stack-list-frames' }));
            ws.send(JSON.stringify({ type: 'command', command: '-stack-list-variables --thread 1 --frame 0 --simple-values' }));
          } else if (line.startsWith('*running')) {
            setProgramState("running");
          } else if (line.startsWith('=thread-group-exited') || line.includes('reason="exited-normally"')) {
            setProgramState("exited");
          } else if (line.startsWith('^done,stack=')) {
            parseMIStack(line);
          } else if (line.startsWith('^done,variables=')) {
            parseMIVariables(line);
          } else if (line.startsWith('^error')) {
            setConsoleOutput(prev => [...prev, "Error: " + line]);
          } else if (!line.startsWith('^') && !line.startsWith('*') && !line.startsWith('=')) {
            // Unparsed output
            setConsoleOutput(prev => [...prev, line]);
          }
        }
      }
    };

    ws.onclose = () => {
      setConsoleOutput(prev => [...prev, "Disconnected from GDB backend."]);
    };
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
        wsRef.current.close();
      }
    };
  }, []);

  const sendCommand = (cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setConsoleOutput(prev => [...prev, `> ${cmd}`]);
      wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
    }
  };

  const handleCommandSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && commandInput.trim()) {
      sendCommand(commandInput);
      setCommandInput("");
    }
  };

  const actualBreakpoints = Object.entries(breakpoints || {}).flatMap(([fid, lines]) => {
    const p = (filesData && filesData[fid]) ? filesData[fid].path : fid;
    return lines.map((line, idx) => {
      const bpId = `${fid}-${line}`;
      return {
        id: bpId,
        fileId: fid,
        file: p,
        line,
        enabled: !disabledBreakpoints.has(bpId)
      };
    });
  });

  const handlePlay = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      startGdb();
    } else if (programState === "none" || programState === "exited") {
      sendCommand("-exec-run");
      setProgramState("running");
    } else {
      sendCommand("-exec-continue");
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#18181b] border-l border-white/10 overflow-hidden font-sans">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1f1f23] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <button onClick={handlePlay} className="p-1.5 rounded-md hover:bg-white/10 text-emerald-400" title="Start / Continue">
            <Play className="w-4 h-4" />
          </button>
          <button onClick={() => sendCommand("-exec-interrupt")} className="p-1.5 rounded-md hover:bg-white/10 text-slate-300" title="Pause">
            <Pause className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => sendCommand("-exec-next")} className="p-1.5 rounded-md hover:bg-white/10 text-blue-400" title="Step Over">
            <ArrowRightCircle className="w-4 h-4" />
          </button>
          <button onClick={() => sendCommand("-exec-step")} className="p-1.5 rounded-md hover:bg-white/10 text-blue-400" title="Step Into">
            <ArrowDownCircle className="w-4 h-4" />
          </button>
          <button onClick={() => sendCommand("-exec-finish")} className="p-1.5 rounded-md hover:bg-white/10 text-blue-400" title="Step Out">
            <ArrowUpCircle className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={startGdb} className="p-1.5 rounded-md hover:bg-white/10 text-green-400" title="Start/Restart">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => {
            if (wsRef.current) wsRef.current.send(JSON.stringify({ type: 'stop' }));
          }} className="p-1.5 rounded-md hover:bg-white/10 text-red-400" title="Stop">
            <Square className="w-4 h-4" fill="currentColor" />
          </button>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10 text-slate-400" title="Close Debugger">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Main Debugger Views */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center px-2 bg-[#1f1f23] border-b border-white/5 shrink-0">
          <button
            onClick={() => setActiveTab("variables")}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "variables" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Variables
          </button>
          <button
            onClick={() => setActiveTab("callstack")}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "callstack" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Call Stack
          </button>
          <button
            onClick={() => setActiveTab("breakpoints")}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "breakpoints" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            Breakpoints
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === "variables" && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Locals</div>
              {variables.length === 0 ? (
                <div className="text-xs text-slate-500">No variables available.</div>
              ) : variables.map((v, i) => (
                <div key={i} className="flex flex-col">
                  <div className="flex items-center gap-1 text-sm text-slate-300 hover:bg-white/5 rounded px-1 py-0.5">
                    <div className="w-3.5" />
                    <span className="text-blue-300 font-mono text-xs">{v.name}</span>
                    <span className="text-slate-500 text-xs">:</span>
                    <span className="text-emerald-300 font-mono text-xs truncate flex-1">{v.value}</span>
                    <span className="text-slate-500 text-[10px] ml-2 opacity-60">{v.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "callstack" && (
            <div className="space-y-0.5">
              {callstack.length === 0 ? (
                <div className="text-xs text-slate-500 p-1">Call stack empty.</div>
              ) : callstack.map((frame, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (frame.file && onNavigate && filesData) {
                      const fileId = Object.keys(filesData).find(fid => {
                        const p = filesData[fid].path.replace(/^\.\//, '');
                        return frame.file.endsWith(p) || p.endsWith(frame.file);
                      }) || frame.file;
                      onNavigate(fileId, frame.line);
                    }
                  }}
                  className={`flex flex-col py-1 px-2 rounded cursor-pointer ${
                    frame.active ? "bg-emerald-500/10 border-l-2 border-emerald-500" : "hover:bg-white/5 border-l-2 border-transparent"
                  }`}
                >
                  <div className="text-xs font-mono text-slate-300 truncate">{frame.frame}</div>
                  {frame.file && (
                    <div className="text-[10px] text-slate-500 mt-0.5">{frame.file}:{frame.line}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "breakpoints" && (
            <div className="space-y-1">
              {actualBreakpoints.length === 0 ? (
                <div className="text-xs text-slate-500 p-2">No breakpoints set. Click the editor gutter to set breakpoints.</div>
              ) : actualBreakpoints.map((bp) => (
                <div key={bp.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={bp.enabled}
                    onChange={(e) => {
                      setDisabledBreakpoints(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) {
                          next.delete(bp.id);
                        } else {
                          next.add(bp.id);
                        }
                        return next;
                      });
                    }}
                    className="w-3 h-3 rounded-sm bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <div className="text-xs text-slate-300">{bp.file}</div>
                    <div className="text-[10px] text-slate-500">Line {bp.line}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GDB Console */}
      <div className={`flex flex-col border-t border-white/10 bg-[#0d0d12] transition-all duration-300 ${isConsoleOpen ? "h-1/2" : "h-8"}`}>
        <div 
          className="flex items-center justify-between px-3 py-1.5 bg-[#16161a] border-b border-white/5 cursor-pointer hover:bg-white/5"
          onClick={() => setIsConsoleOpen(!isConsoleOpen)}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <TerminalSquare className="w-3.5 h-3.5" />
            GDB Console
          </div>
          {isConsoleOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
        </div>
        
        {isConsoleOpen && (
          <div className="flex-1 p-2 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1">
            {consoleOutput.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap font-mono">{line}</div>
            ))}
            <div ref={consoleEndRef} />
            <div className="flex items-center gap-1 mt-2">
              <span className="text-emerald-400">(gdb)</span>
              <input 
                type="text" 
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                onKeyDown={handleCommandSubmit}
                className="flex-1 bg-transparent border-none outline-none text-slate-300 placeholder-slate-600 font-mono text-[10px]" 
                placeholder="Enter GDB command..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
