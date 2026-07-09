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
}: {
  fileId: string;
  filePath: string;
  projectId: string | null;
  filesData?: Record<string, any>;
  onClose: () => void;
  breakpoints?: Record<string, number[]>;
  setBreakpoints?: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
}) {
  const [activeTab, setActiveTab] = useState<"variables" | "callstack" | "breakpoints">("variables");
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when output changes
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleOutput]);

  const startGdb = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const wsUrl = window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConsoleOutput(["Connected to GDB backend. Starting session..."]);
      
      const mappedBreakpoints: Record<string, number[]> = {};
      actualBreakpoints.forEach(bp => {
        if (!mappedBreakpoints[bp.file]) mappedBreakpoints[bp.file] = [];
        mappedBreakpoints[bp.file].push(bp.line);
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
        setConsoleOutput(prev => [...prev, msg.data]);
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
      setConsoleOutput(prev => [...prev, `(gdb) ${cmd}`]);
      wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
    }
  };

  const handleCommandSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && commandInput.trim()) {
      sendCommand(commandInput);
      setCommandInput("");
    }
  };

  // Mock data for visual layout
  const variables = [
    { name: "No variables (MI parsing not fully implemented)", value: "", type: "", expanded: false }
  ];

  const callstack = [
    { id: 1, frame: "No callstack (MI parsing not fully implemented)", file: "", line: 0, active: true },
  ];

  const actualBreakpoints = Object.entries(breakpoints || {}).flatMap(([fid, lines]) => {
    const p = (filesData && filesData[fid]) ? filesData[fid].path : fid;
    return lines.map((line, idx) => ({
      id: `${fid}-${line}`,
      fileId: fid,
      file: p,
      line,
      enabled: true
    }));
  });

  return (
    <div className="flex flex-col w-full h-full bg-[#18181b] border-l border-white/10 overflow-hidden font-sans">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1f1f23] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <button onClick={() => sendCommand("continue")} className="p-1.5 rounded-md hover:bg-white/10 text-emerald-400" title="Continue">
            <Play className="w-4 h-4" />
          </button>
          <button onClick={() => sendCommand("interrupt")} className="p-1.5 rounded-md hover:bg-white/10 text-slate-300" title="Pause">
            <Pause className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button onClick={() => sendCommand("next")} className="p-1.5 rounded-md hover:bg-white/10 text-blue-400" title="Step Over">
            <ArrowRightCircle className="w-4 h-4" />
          </button>
          <button onClick={() => sendCommand("step")} className="p-1.5 rounded-md hover:bg-white/10 text-blue-400" title="Step Into">
            <ArrowDownCircle className="w-4 h-4" />
          </button>
          <button onClick={() => sendCommand("finish")} className="p-1.5 rounded-md hover:bg-white/10 text-blue-400" title="Step Out">
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
              {variables.map((v, i) => (
                <div key={i} className="flex flex-col">
                  <div className="flex items-center gap-1 text-sm text-slate-300 hover:bg-white/5 rounded px-1 py-0.5">
                    <div className="w-3.5" />
                    <span className="text-blue-300 font-mono text-xs">{v.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "callstack" && (
            <div className="space-y-0.5">
              {callstack.map((frame, i) => (
                <div
                  key={i}
                  className={`flex flex-col py-1 px-2 rounded cursor-pointer ${
                    frame.active ? "bg-emerald-500/10 border-l-2 border-emerald-500" : "hover:bg-white/5 border-l-2 border-transparent"
                  }`}
                >
                  <div className="text-xs font-mono text-slate-300 truncate">{frame.frame}</div>
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
                    readOnly
                    className="w-3 h-3 rounded-sm bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500/50"
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
