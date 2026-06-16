import React, { useMemo, useState, useEffect } from 'react';
import { parseVerilog, VerilogModule, VerilogSignal, VerilogInstance } from '../utils/verilogParser';
import { ChevronRight, ChevronDown, Box, Cpu, FileJson, ArrowRightToLine, ArrowLeftFromLine, ArrowRightLeft, FastForward, Database } from 'lucide-react';

const TreeFolder = ({ label, icon, children, defaultExpanded = true }: { label: string, icon?: React.ReactNode, children: React.ReactNode, defaultExpanded?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="flex flex-col">
      <div 
         className="flex items-center cursor-pointer hover:bg-white/5 w-fit pr-3 py-1 rounded select-none"
         onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 mr-1" /> : <ChevronRight className="w-4 h-4 text-slate-500 mr-1" />}
        {icon && <span className="mr-2 text-slate-400">{icon}</span>}
        <span className="text-slate-300 font-semibold text-sm">{label}</span>
      </div>
      {isExpanded && (
        <div className="pl-6 border-l border-white/5 ml-1.5 mt-0.5 flex flex-col gap-1">
          {children}
        </div>
      )}
    </div>
  );
};

const SignalNode = ({ signal, selectedNet, onSelectNet }: { signal: VerilogSignal, selectedNet?: string, onSelectNet?: (net: string) => void }) => {
    let _IconComponent: any = undefined;
    let color = "text-slate-400";

    if (signal.ioType === 'input') { _IconComponent = ArrowRightToLine; color = "text-blue-400"; }
    else if (signal.ioType === 'output') { _IconComponent = ArrowLeftFromLine; color = "text-emerald-400"; }
    else if (signal.ioType === 'inout') { _IconComponent = ArrowRightLeft; color = "text-purple-400"; }

    const isSelected = selectedNet === signal.name;

    const renderIcon = () => {
        if (_IconComponent) {
            const Icon = _IconComponent;
            return <Icon className={`w-3.5 h-3.5 mr-2 opacity-80 ${isSelected ? 'text-emerald-400' : color}`} />;
        }
        if (signal.type === 'wire') {
            return <div className={`w-3.5 h-3.5 mr-2 rounded-sm border flex items-center justify-center text-[9px] font-bold font-mono ${isSelected ? 'border-emerald-500 text-emerald-400' : 'border-slate-500 text-slate-400'}`}>w</div>;
        }
        if (signal.type === 'reg') {
            return <div className={`w-3.5 h-3.5 mr-2 rounded-sm border flex items-center justify-center text-[9px] font-bold font-mono ${isSelected ? 'border-emerald-500 text-emerald-400' : 'border-orange-500 text-orange-400'}`}>r</div>;
        }
        return <FastForward className={`w-3.5 h-3.5 mr-2 opacity-80 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />;
    };

    return (
        <div 
           className={`flex items-center py-1 px-2 rounded w-fit select-none shrink-0 group cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'hover:bg-white/5'}`}
           onClick={() => onSelectNet?.(signal.name)}
        >
            {renderIcon()}
            <span className={`${isSelected ? 'text-emerald-300 font-bold' : 'text-slate-300'} group-hover:text-white transition-colors`}>{signal.name}</span>
            {signal.width !== undefined && signal.width !== 1 && (
                 <span className={`ml-2 text-[10px] uppercase border px-1 rounded block ${isSelected ? 'text-emerald-400 border-emerald-500/50 bg-emerald-900/30' : 'text-slate-500 border-slate-700/50 bg-slate-800/30'}`}>[{signal.width}]</span>
            )}
            <span className="ml-3 text-[10px] uppercase text-slate-500 hidden group-hover:inline-block">{signal.type}</span>
        </div>
    );
};

const InstanceNode = ({ inst, selectedNet, onSelectNet }: { inst: VerilogInstance, selectedNet?: string, onSelectNet?: (net: string) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
      <div className="flex flex-col">
        <div 
           className="flex items-center cursor-pointer hover:bg-white/5 w-fit pr-3 py-1 rounded select-none group"
           onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 mr-1" />}
          <Cpu className="w-3.5 h-3.5 text-indigo-400 mr-2 opacity-80" />
          <span className="text-slate-200 font-medium group-hover:text-white transition-colors">{inst.name}</span>
          <span className="ml-2 text-slate-500 text-xs">({inst.type})</span>
        </div>
        {isExpanded && (
          <div className="pl-7 border-l border-white/5 ml-1.5 mt-0.5 flex flex-col gap-0.5">
            {inst.connections.map((conn, idx) => {
                const isSelected = selectedNet === conn.connectedNet;
                return (
                  <div key={idx} className="flex items-center py-0.5 px-1 rounded hover:bg-white/5 text-xs select-none w-fit cursor-pointer" onClick={() => onSelectNet?.(conn.connectedNet)}>
                      <span className="text-slate-500 w-24">.{conn.portName}</span>
                      <span className="text-slate-600 mx-1">(</span>
                      <span className={`${isSelected ? 'text-emerald-300 font-bold bg-emerald-500/20 px-1 rounded' : 'text-emerald-400/80'}`}>{conn.connectedNet}</span>
                      <span className="text-slate-600 mx-1">)</span>
                  </div>
                );
            })}
          </div>
        )}
      </div>
    );
};

const ModuleNode = ({ mod, selectedNet, onSelectNet }: { mod: VerilogModule, selectedNet?: string, onSelectNet?: (net: string) => void }) => {
    const inputs = mod.signals.filter(s => s.ioType === 'input');
    const outputs = mod.signals.filter(s => s.ioType === 'output');
    const inouts = mod.signals.filter(s => s.ioType === 'inout');
    const wires = mod.signals.filter(s => !s.ioType && s.type === 'wire');
    const regs = mod.signals.filter(s => !s.ioType && s.type === 'reg');

    return (
        <TreeFolder label={mod.name} icon={<Box className="w-4 h-4 text-cyan-500" />}>
           {inputs.length > 0 && (
               <TreeFolder label={`Inputs (${inputs.length})`} defaultExpanded={true}>
                   {inputs.map(s => <SignalNode key={s.name} signal={s} selectedNet={selectedNet} onSelectNet={onSelectNet} />)}
               </TreeFolder>
           )}
           {outputs.length > 0 && (
               <TreeFolder label={`Outputs (${outputs.length})`} defaultExpanded={true}>
                   {outputs.map(s => <SignalNode key={s.name} signal={s} selectedNet={selectedNet} onSelectNet={onSelectNet} />)}
               </TreeFolder>
           )}
           {inouts.length > 0 && (
               <TreeFolder label={`Inouts (${inouts.length})`} defaultExpanded={false}>
                   {inouts.map(s => <SignalNode key={s.name} signal={s} selectedNet={selectedNet} onSelectNet={onSelectNet} />)}
               </TreeFolder>
           )}
           {wires.length > 0 && (
               <TreeFolder label={`Wires (${wires.length})`} defaultExpanded={false}>
                   {wires.map(s => <SignalNode key={s.name} signal={s} selectedNet={selectedNet} onSelectNet={onSelectNet} />)}
               </TreeFolder>
           )}
           {regs.length > 0 && (
               <TreeFolder label={`Regs (${regs.length})`} defaultExpanded={false}>
                   {regs.map(s => <SignalNode key={s.name} signal={s} selectedNet={selectedNet} onSelectNet={onSelectNet} />)}
               </TreeFolder>
           )}
           {mod.instances.length > 0 && (
               <TreeFolder label={`Instances (${mod.instances.length})`} defaultExpanded={true}>
                   {mod.instances.map((inst, idx) => <InstanceNode key={`${inst.name}_${idx}`} inst={inst} selectedNet={selectedNet} onSelectNet={onSelectNet} />)}
               </TreeFolder>
           )}
        </TreeFolder>
    );
}

export function VerilogASTViewer({ content, selectedNet, onSelectNet }: { content: string, selectedNet?: string, onSelectNet?: (net: string) => void }) {
  const [debouncedContent, setDebouncedContent] = useState(content);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContent(content), 800);
    return () => clearTimeout(t);
  }, [content]);

  const parsed = useMemo(() => {
     try {
         return parseVerilog(debouncedContent);
     } catch(e) {
         return { error: String(e) };
     }
  }, [debouncedContent]);

  return (
    <div className="flex-1 overflow-auto bg-[#121216] p-6 text-[13px] font-sans text-slate-300 leading-relaxed shadow-inner">
       <div className="flex items-center gap-2 font-bold mb-6 border-b border-white/10 pb-4">
           <FileJson className="w-5 h-5 text-cyan-500" />
           <span className="text-slate-200 text-sm">Verilog Structure</span>
       </div>
       <div className="pb-20 flex flex-col gap-4 font-mono text-[12px]">
           {Array.isArray(parsed) ? (
               parsed.length > 0 ? (
                   parsed.map((mod, idx) => <ModuleNode key={idx} mod={mod} selectedNet={selectedNet} onSelectNet={onSelectNet} />)
               ) : (
                   <span className="text-slate-500 italic">No modules found.</span>
               )
           ) : (
               <span className="text-red-400">Error parsing file.</span>
           )}
       </div>
    </div>
  );
}
