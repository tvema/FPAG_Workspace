import React, { useMemo, useState } from 'react';
import { VCDData, parseVCD } from '../utils/vcdParser';
import { Box, ChevronDown, ChevronRight, Eye, EyeOff, Hash, Type } from 'lucide-react';
import { WaveformViewerViewState } from './WaveformViewer';
import { parseVerilog, VerilogModule } from '../utils/verilogParser';

export function VCDScopeTree({ vcdContent, viewState, updateViewState, activeFilePath, filesData }: { vcdContent: string, viewState?: WaveformViewerViewState, updateViewState: (updater: (prev: any) => any) => void, activeFilePath?: string, filesData?: any }) {
  const vcd = useMemo(() => parseVCD(vcdContent), [vcdContent]);
  
  const tbConfig = useMemo(() => {
     if (!activeFilePath || !filesData) return null;
     const parts = activeFilePath.split('/');
     parts.pop();
     const configPath = parts.join('/') + '/tb_config.json';
     const tbConfigObj = Object.values(filesData).find((f: any) => f.path === configPath);
     if (tbConfigObj) {
         try { return JSON.parse(tbConfigObj.content); } catch (e) { return null; }
     }
     return null;
  }, [activeFilePath, filesData]);

  const parsedModules = useMemo(() => {
     const res: VerilogModule[] = [];
     if (!tbConfig || !filesData) return res;
     
     tbConfig.filesToInclude.forEach((fPath: string) => {
         const f = Object.values(filesData).find((f: any) => f.path === fPath || f.path.replace(/^\/+/, '') === fPath.replace(/^\/+/, ''));
         if (f && f.content) {
             res.push(...parseVerilog(f.content));
         }
     });
     // Fallback: parse all if tbConfig is weird
     if (res.length === 0) {
         for (const k in filesData) {
             const f = filesData[k];
             if (f.type === 'verilog' || f.name.endsWith('.v') || f.name.endsWith('.sv')) {
                 res.push(...parseVerilog(f.content));
             }
         }
     }
     return res;
  }, [tbConfig, filesData]);

  // Build a tree of scopes
  const root = useMemo(() => {
    const tree: any = { name: 'top', path: '', children: {}, signals: [], verilogModule: null };
    
    // In VCD, scopes are dot separated like 'top.dut.submodule'
    vcd.signals.forEach(sig => {
      const parts = sig.module.split('.');
      let current = tree;
      let path = '';
      
      parts.forEach((part, i) => {
        path += (path ? '.' : '') + part;
        if (!current.children[part]) {
          current.children[part] = { name: part, path, children: {}, signals: [], verilogModule: null };
        }
        current = current.children[part];
      });
      
      current.signals.push(sig);
    });

    // Try to match each node to a Verilog module using structural similarity of signals
    const matchVerilogModule = (node: any) => {
       if (node.signals.length > 0 && parsedModules.length > 0) {
           const instanceSigNames = new Set(node.signals.map((s: any) => s.name));
           let bestMatch: VerilogModule | null = null;
           let maxIntersection = 0;
           for (const mod of parsedModules) {
               let overlap = 0;
               for (const sig of mod.signals) {
                   if (instanceSigNames.has(sig.name)) overlap++;
               }
               if (overlap > maxIntersection) {
                   maxIntersection = overlap;
                   bestMatch = mod;
               }
           }
           if (bestMatch && maxIntersection > 0) {
               node.verilogModule = bestMatch;
           }
       }
       Object.values(node.children).forEach((child: any) => matchVerilogModule(child));
    };
    matchVerilogModule(tree);
    
    return tree;
  }, [vcd, parsedModules]);

  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});

  const toggleTrack = (signalId: string, signalModule: string, signalName: string, signal: any) => {
     updateViewState(prev => {
        let tracks = prev?.tracks || [];
        const uniqueId = `${signalId}_${signalName}_${signalModule}`;
        const existingInfo = tracks.find((t: any) => !t.uniqueId.includes('_filler_') ? t.uniqueId.startsWith(`${signalId}_${signalName}`) : false);
        
        let newTracks = [...tracks];
        if (existingInfo) {
           newTracks = newTracks.map((t: any) => t.uniqueId === existingInfo.uniqueId ? { ...t, isHidden: !t.isHidden } : t);
        } else {
           newTracks.push({
             uniqueId,
             signal,
             format: signal.width > 1 ? 'hex' : 'bin',
             isHidden: false
           });
        }
        return { ...prev, tracks: newTracks };
     });
  };

  const renderTree = (node: any, depth = 0) => {
    const isCollapsed = collapsedPaths[node.path];
    const hasChildren = Object.keys(node.children).length > 0;
    
    return (
      <div key={node.path || 'root'} className="flex flex-col">
         {node.path && (
           <div 
             className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-sm text-slate-300"
             style={{ paddingLeft: `${depth * 12 + 8}px` }}
             onClick={() => setCollapsedPaths(p => ({ ...p, [node.path]: !isCollapsed }))}
           >
             {hasChildren ? (
                isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
             ) : <div className="w-3.5" />}
             <Box className="w-3.5 h-3.5 text-emerald-400" />
             <span className="truncate">{node.name}</span>
             {node.verilogModule && <span className="text-[10px] text-slate-500 ml-2">({node.verilogModule.name})</span>}
           </div>
         )}
         
         {(!isCollapsed || !node.path) && (
           <div className="flex flex-col">
             {Object.values(node.children).map((child: any) => renderTree(child, node.path ? depth + 1 : 0))}
             
             {(() => {
                 const inputs: any[] = [];
                 const outputs: any[] = [];
                 const regs: any[] = [];
                 const wires: any[] = [];
                 const others: any[] = [];
                 
                 node.signals.forEach((sig: any) => {
                     let matched = false;
                     if (node.verilogModule) {
                         const vSig = node.verilogModule.signals.find((s: any) => s.name === sig.name);
                         if (vSig) {
                             matched = true;
                             if (vSig.ioType === 'input') inputs.push(sig);
                             else if (vSig.ioType === 'output' || vSig.ioType === 'inout') outputs.push(sig);
                             else if (vSig.type === 'reg' || vSig.type === 'logic') regs.push(sig);
                             else wires.push(sig);
                         }
                     }
                     if (!matched) {
                         others.push(sig);
                     }
                 });

                 const renderGroup = (title: string, sigs: any[], iconEl: React.ReactNode, defaultCollapsed: boolean = false) => {
                     if (sigs.length === 0) return null;
                     const groupPath = `${node.path || 'root'}._g_${title}`;
                     const groupCollapsed = collapsedPaths[groupPath] ?? defaultCollapsed;
                     
                     return (
                       <div key={groupPath} className="flex flex-col">
                          <div 
                            className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-xs text-slate-400 font-medium"
                            style={{ paddingLeft: `${(node.path ? depth + 1 : 0) * 12 + 16}px` }}
                            onClick={() => setCollapsedPaths(p => ({ ...p, [groupPath]: !groupCollapsed }))}
                          >
                            {groupCollapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                            <span className="truncate">{title}</span>
                            <span className="opacity-50 text-[10px]">({sigs.length})</span>
                          </div>
                          {!groupCollapsed && sigs.map(sig => {
                              const uniqueIdPrefix = `${sig.id}_${sig.name}`;
                              const track = (viewState?.tracks || []).find((t: any) => !t.uniqueId.includes('_filler_') && t.uniqueId.startsWith(uniqueIdPrefix));
                              const isVisible = track && !track.isHidden;
                              
                              return (
                                <div 
                                  key={sig.name}
                                  className="flex items-center justify-between py-1 px-2 hover:bg-white/5 cursor-pointer text-sm group"
                                  style={{ paddingLeft: `${(node.path ? depth + 1 : 0) * 12 + 28}px` }}
                                  onClick={(e) => { e.stopPropagation(); toggleTrack(sig.id, sig.module, sig.name, sig); }}
                                >
                                  <div className="flex items-center gap-1.5 overflow-hidden text-slate-400 group-hover:text-slate-200">
                                     {iconEl}
                                     {sig.width > 1 && <span className="opacity-70 text-[10px]">[{sig.width}]</span>}
                                     <span className="truncate">{sig.name}</span>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 pr-2">
                                     {isVisible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                                  </div>
                                </div>
                              );
                          })}
                       </div>
                     );
                 };

                 return (
                    <>
                       {renderGroup('Inputs', inputs, <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />)}
                       {renderGroup('Outputs', outputs, <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />)}
                       {renderGroup('Registers', regs, <Box className="w-3.5 h-3.5 text-orange-400 shrink-0" />)}
                       {renderGroup('Wires', wires, <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />)}
                       {renderGroup('Other / Internal', others, <Hash className="w-3.5 h-3.5 text-slate-500 shrink-0" />, true)}
                    </>
                 );
             })()}
           </div>
         )}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col w-full h-full bg-[#121214] border-r border-[#27272a] text-sm font-sans flex-1 overflow-hidden">
       <div className="h-10 border-b border-[#27272a] bg-[#16161a] flex items-center px-4 shrink-0 font-medium text-slate-300">
          VCD Scopes
       </div>
       <div className="flex-1 overflow-y-auto w-full pb-4">
          {renderTree(root)}
       </div>
    </div>
  );
}
