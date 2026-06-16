import React, { useMemo, useState } from 'react';
import { VCDData, parseVCD } from '../utils/vcdParser';
import { Box, ChevronDown, ChevronRight, Eye, EyeOff, Hash, Type, Save, List, Check, X, ArrowRightToLine, ArrowLeftFromLine, ArrowRightLeft, FastForward, Cpu, Database } from 'lucide-react';
import { WaveformViewerViewState } from './WaveformViewer';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { parseVerilog, VerilogModule } from '../utils/verilogParser';

export function VCDScopeTree({ vcdContent, viewState, updateViewState, activeFilePath, filesData, onAddFile, activeProject }: { vcdContent: string, viewState?: WaveformViewerViewState, updateViewState: (updater: (prev: any) => any) => void, activeFilePath?: string, filesData?: any, onAddFile?: (path: string, content: string, project_id?: string) => Promise<void>, activeProject?: string | null }) {
  const vcd = useMemo(() => parseVCD(vcdContent), [vcdContent]);
  
  const configFilePath = useMemo(() => {
     if (!activeFilePath) return null;
     return activeFilePath + '.configs.json';
  }, [activeFilePath]);

  const savedConfigs = useMemo(() => {
     if (!configFilePath || !filesData) return {};
     const f = Object.values(filesData).find((f: any) => f.path === configFilePath);
     if (f) {
        try { return JSON.parse((f as any).content); } catch(e) { return {}; }
     }
     return {};
  }, [configFilePath, filesData]);

  const [savingName, setSavingName] = useState('');
  const [isSavingDialog, setIsSavingDialog] = useState(false);

  const handleSaveConfig = async () => {
    if (!savingName.trim() || !configFilePath || !onAddFile) return;
    const newConfigs = { ...savedConfigs, [savingName.trim()]: viewState?.tracks || [] };
    await onAddFile(configFilePath, JSON.stringify(newConfigs, null, 2), activeProject || undefined);
    setIsSavingDialog(false);
    setSavingName('');
  };

  const handleLoadConfig = (name: string) => {
     const tracks = savedConfigs[name];
     if (tracks) {
        updateViewState(prev => ({ ...prev, tracks }));
     }
  };

  const tbConfig = useMemo(() => {
     if (!activeFilePath || !filesData) return null;
     const parts = activeFilePath.split('/');
     parts.pop();
     const configPath = parts.join('/') + '/tb_config.json';
     const tbConfigObj = (Object.values(filesData) as any[]).find((f: any) => f.path === configPath);
     if (tbConfigObj) {
         try { return JSON.parse(tbConfigObj.content); } catch (e) { return null; }
     }
     return null;
  }, [activeFilePath, filesData]);

  const [debouncedFilesData, setDebouncedFilesData] = useState(filesData);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilesData(filesData), 1000);
    return () => clearTimeout(t);
  }, [filesData]);

  const parsedModules = useMemo(() => {
     const res: VerilogModule[] = [];
     if (!tbConfig || !debouncedFilesData) return res;
     
     tbConfig.filesToInclude.forEach((fPath: string) => {
         const f = (Object.values(debouncedFilesData) as any[]).find((f: any) => f.path === fPath || f.path.replace(/^\/+/, '') === fPath.replace(/^\/+/, ''));
         if (f && f.content) {
             res.push(...parseVerilog(f.content));
         }
     });
     // Fallback: parse all if tbConfig is weird
     if (res.length === 0) {
         for (const k in debouncedFilesData) {
             const f = debouncedFilesData[k] as any;
             if (f.type === 'verilog' || f.name.endsWith('.v') || f.name.endsWith('.sv')) {
                 res.push(...parseVerilog(f.content));
             }
         }
     }
     return res;
  }, [tbConfig, debouncedFilesData]);

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
    const matchVerilogModule = (node: any, parentVerilogModule?: VerilogModule) => {
       // if we have a parent verilog module, we can look up THIS node's name in parent's instances
       if (parentVerilogModule) {
           const inst = parentVerilogModule.instances.find(i => i.name === node.name);
           if (inst) {
               const mod = parsedModules.find(m => m.name === inst.type);
               if (mod) node.verilogModule = mod;
           }
       }

       if (!node.verilogModule && node.signals.length > 0 && parsedModules.length > 0) {
           const instanceSigNames = new Set(node.signals.map((s: any) => s.name.split('[')[0].trim()));
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
       Object.values(node.children).forEach((child: any) => matchVerilogModule(child, node.verilogModule));
    };
    matchVerilogModule(tree);
    
    return tree;
  }, [vcd, parsedModules]);

  const collapsedPaths = viewState?.collapsedPaths || {};
  const setCollapsedPaths = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      updateViewState(prev => ({ ...prev, collapsedPaths: updater(prev?.collapsedPaths || {}) }));
  };

  const toggleTrack = (signalId: string, signalModule: string, signalName: string, signal: any) => {
     updateViewState(prev => {
        let tracks = prev?.tracks || [];
        const uniqueId = `${signalId}_${signalName}_${signalModule}`;
        const existingInfo = tracks.find((t: any) => !t.uniqueId.includes('_filler_') ? (t.uniqueId === uniqueId || t.uniqueId.startsWith(uniqueId + '_')) : false);
        
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

  const setSignalsVisibility = (signals: any[], forceVisible: boolean) => {
      updateViewState(prev => {
         let tracks = prev?.tracks || [];
         let newTracks = [...tracks];
         
         signals.forEach(sig => {
            const uniqueId = `${sig.id}_${sig.name}_${sig.module}`;
            const existingInfo = newTracks.find((t: any) => !t.uniqueId.includes('_filler_') && (t.uniqueId === uniqueId || t.uniqueId.startsWith(uniqueId + '_')));
            if (existingInfo) {
                newTracks = newTracks.map((t: any) => t.uniqueId === existingInfo.uniqueId ? { ...t, isHidden: !forceVisible } : t);
            } else if (forceVisible) {
                newTracks.push({
                   uniqueId,
                   signal: sig,
                   format: sig.width > 1 ? 'hex' : 'bin',
                   isHidden: false
                });
            }
         });
         return { ...prev, tracks: newTracks };
      });
  };

  const getAllSignalsInNode = (n: any): any[] => {
       let res: any[] = [...n.signals];
       Object.values(n.children).forEach((child: any) => {
           res = res.concat(getAllSignalsInNode(child));
       });
       return res;
  };

  const renderTree = (node: any, depth = 0) => {
    const isCollapsed = collapsedPaths[node.path];
    const hasChildren = Object.keys(node.children).length > 0;
    
    const checkVisibility = (sigs: any[]) => {
        let visibleCount = 0;
        sigs.forEach(sig => {
            const uniqueId = `${sig.id}_${sig.name}_${sig.module}`;
            const track = (viewState?.tracks || []).find((t: any) => !t.uniqueId.includes('_filler_') && (t.uniqueId === uniqueId || t.uniqueId.startsWith(uniqueId + '_')));
            if (track && !track.isHidden) visibleCount++;
        });
        return { visibleCount, totalCount: sigs.length };
    };
    
    const branchSignals = node.path ? getAllSignalsInNode(node) : [];
    const branchVis = checkVisibility(branchSignals);
    
    return (
       <div key={node.path || 'root'} className="flex flex-col">
         {node.path && (
           <div className="flex items-center group w-max">
              <div className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-sm text-slate-200 select-none pr-3 rounded"
              onClick={() => setCollapsedPaths(p => ({ ...p, [node.path]: !isCollapsed }))}
           >
             {hasChildren ? (
                isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />
             ) : <div className="w-4" />}
             {node.verilogModule ? (
                 <Cpu className="w-3.5 h-3.5 text-indigo-400 opacity-80" />
             ) : (
                 <Box className="w-3.5 h-3.5 text-cyan-500 opacity-80" />
             )}
             <span className="font-medium group-hover:text-white transition-colors">{node.name}</span>
             {node.verilogModule && <span className="text-[11px] text-slate-500 ml-1">({node.verilogModule.name})</span>}
            </div>
            {branchSignals.length > 0 && (
                 <div 
                   className="opacity-0 group-hover:opacity-100 p-1 ml-1 cursor-pointer transition-all rounded hover:bg-white/10"
                   onClick={(e) => { e.stopPropagation(); setSignalsVisibility(branchSignals, branchVis.visibleCount === 0); }}
                   title={branchVis.visibleCount > 0 ? "Hide all" : "Show all"}
                 >
                   {branchVis.visibleCount > 0 ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                 </div>
            )}
           </div>
         )}
         
         {(!isCollapsed || !node.path) && (
           <div className={`flex flex-col ${node.path ? 'pl-6 border-l border-white/5 ml-1.5 mt-0.5' : ''}`}>
             {Object.values(node.children).map((child: any) => renderTree(child, depth + 1))}
             
             {(() => {
                 const inputs: any[] = [];
                 const outputs: any[] = [];
                 const inouts: any[] = [];
                 const regs: any[] = [];
                 const wires: any[] = [];
                 const others: any[] = [];
                 
                 node.signals.forEach((sig: any) => {
                     let matched = false;
                     if (node.verilogModule) {
                         const cleanSigName = sig.name.split('[')[0].trim();
                         const vSig = node.verilogModule.signals.find((s: any) => s.name === cleanSigName);
                         if (vSig) {
                             matched = true;
                             if (vSig.ioType === 'input') inputs.push(sig);
                             else if (vSig.ioType === 'output') outputs.push(sig);
                             else if (vSig.ioType === 'inout') inouts.push(sig);
                             else if (vSig.type === 'reg' || vSig.type === 'logic') regs.push(sig);
                             else wires.push(sig);
                         }
                     }
                     if (!matched) {
                         if (sig.type === 'reg' || sig.type === 'logic') regs.push(sig);
                         else if (sig.type === 'wire') wires.push(sig);
                         else others.push(sig);
                     }
                 });

                 const renderGroup = (title: string, sigs: any[], iconEl: React.ReactNode, defaultCollapsed: boolean = true) => {
                     if (sigs.length === 0) return null;
                     const groupPath = `${node.path || 'root'}._g_${title}`;
                     const groupCollapsed = collapsedPaths[groupPath] ?? defaultCollapsed;
                     const groupVis = checkVisibility(sigs);
                     
                     return (
                       <div key={groupPath} className="flex flex-col">
                          <div className="flex items-center group/group w-max">
                             <div 
                               className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-[13px] text-slate-300 font-semibold select-none rounded pr-2"
                               onClick={() => setCollapsedPaths(p => ({ ...p, [groupPath]: !groupCollapsed }))}
                             >
                               {groupCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                               <span className="truncate">{title}</span>
                             </div>
                             <div 
                               className="opacity-0 group-hover/group:opacity-100 p-1 ml-1 cursor-pointer transition-all rounded hover:bg-white/10"
                               onClick={(e) => { e.stopPropagation(); setSignalsVisibility(sigs, groupVis.visibleCount === 0); }}
                               title={groupVis.visibleCount > 0 ? "Hide all" : "Show all"}
                             >
                               {groupVis.visibleCount > 0 ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                             </div>
                          </div>
                          {!groupCollapsed && (
                            <div className="flex flex-col pl-6 border-l border-white/5 ml-1.5 mt-0.5">
                                {sigs.map(sig => {
                                  const uniqueId = `${sig.id}_${sig.name}_${sig.module}`;
                                  const track = (viewState?.tracks || []).find((t: any) => !t.uniqueId.includes('_filler_') && (t.uniqueId === uniqueId || t.uniqueId.startsWith(uniqueId + '_')));
                                  const isVisible = track && !track.isHidden;
                                  
                                  return (
                                    <div 
                                      key={sig.name}
                                      className="flex items-center justify-between py-1 px-2 hover:bg-white/5 cursor-pointer text-[13px] group select-none w-fit rounded"
                                      onClick={(e) => { e.stopPropagation(); toggleTrack(sig.id, sig.module, sig.name, sig); }}
                                    >
                                      <div className="flex items-center gap-1.5 overflow-hidden text-slate-300 group-hover:text-white transition-colors">
                                         {iconEl}
                                         <span className="truncate">{sig.name}</span>
                                         {sig.width > 1 && <span className="text-[10px] uppercase border px-1 rounded block text-slate-500 border-slate-700/50 bg-slate-800/30">[{sig.width}]</span>}
                                      </div>
                                      <div className={`transition-opacity pl-4 pr-2 ${isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                         {isVisible ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500 opacity-50" />}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                       </div>
                     );
                 };

                 return (
                    <>
                       {renderGroup(`Inputs (${inputs.length})`, inputs, <ArrowRightToLine className="w-3.5 h-3.5 text-blue-400 opacity-80 shrink-0" />)}
                       {renderGroup(`Outputs (${outputs.length})`, outputs, <ArrowLeftFromLine className="w-3.5 h-3.5 text-emerald-400 opacity-80 shrink-0" />)}
                       {renderGroup(`Inouts (${inouts.length})`, inouts, <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400 opacity-80 shrink-0" />, false)}
                       {renderGroup(`Wires (${wires.length})`, wires, <div className="w-3.5 h-3.5 rounded-sm border border-slate-500 text-slate-400 flex items-center justify-center text-[9px] font-bold font-mono shrink-0">w</div>, false)}
                       {renderGroup(`Registers (${regs.length})`, regs, <div className="w-3.5 h-3.5 rounded-sm border border-orange-500 text-orange-400 flex items-center justify-center text-[9px] font-bold font-mono shrink-0">r</div>, false)}
                       {renderGroup(`Other (${others.length})`, others, <FastForward className="w-3.5 h-3.5 text-slate-400 opacity-80 shrink-0" />, true)}
                    </>
                 );
             })()}
           </div>
         )}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col w-full h-full bg-[#121216] border-r border-[#27272a] font-mono flex-1 overflow-hidden shadow-inner">
       <div className="h-10 border-b border-[#27272a] bg-[#16161a] flex items-center justify-between px-4 shrink-0 font-medium text-slate-300 font-sans text-sm">
          <div className="flex items-center gap-2">
             <Database className="w-4 h-4 text-cyan-500" />
             <span>Signals Explorer</span>
          </div>
          <div className="flex items-center gap-1">
             <button title="Save Configuration" onClick={() => setIsSavingDialog(!isSavingDialog)} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-emerald-400 transition-colors">
                <Save className="w-3.5 h-3.5" />
             </button>
             {Object.keys(savedConfigs).length > 0 && (
                 <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                       <button title="Load Configuration" className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-indigo-400 transition-colors">
                           <List className="w-3.5 h-3.5" />
                       </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                       <DropdownMenu.Content align="end" className="z-50 min-w-[150px] bg-[#1e1e24] border border-[#27272a] rounded shadow-xl py-1">
                          <div className="px-3 py-1 text-xs text-slate-500 font-medium">Saved Presets</div>
                          {Object.keys(savedConfigs).map(key => (
                              <DropdownMenu.Item asChild key={key}>
                                 <button onClick={() => handleLoadConfig(key)} className="w-full px-3 py-1.5 text-xs text-left hover:bg-[#27272a] text-slate-300 truncate">
                                    {key}
                                 </button>
                              </DropdownMenu.Item>
                          ))}
                       </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                 </DropdownMenu.Root>
             )}
          </div>
       </div>
       
       {isSavingDialog && (
          <div className="bg-[#1e1e24] border-b border-[#27272a] p-2 flex items-center gap-2 shrink-0">
             <input 
                 autoFocus
                 type="text" 
                 value={savingName}
                 onChange={e => setSavingName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSaveConfig()}
                 placeholder="Config name..." 
                 className="flex-1 bg-black/30 border border-[#3f3f46] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
             />
             <button onClick={handleSaveConfig} className="p-1 text-emerald-400 hover:bg-white/10 rounded"><Check className="w-3.5 h-3.5" /></button>
             <button onClick={() => setIsSavingDialog(false)} className="p-1 text-slate-400 hover:bg-white/10 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
       )}

       <div className="flex-1 overflow-y-auto w-full pb-8 pt-4 px-2">
          {renderTree(root)}
       </div>
    </div>
  );
}
