import React, { useMemo, useEffect, useState, useCallback, memo } from 'react';
import {
  ReactFlow, Controls, Background, Node, Edge, Handle, Position, NodeProps,
  useNodesState, useEdgesState, useNodes, EdgeProps, getSmoothStepPath, getBezierPath, ReactFlowProvider, useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseVerilog } from '../utils/verilogParser';
import { Cloud, Cpu, AlertTriangle } from 'lucide-react';
import dagre from 'dagre';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const diagramStateCache = new Map<string, { positions: Record<string, { x: number, y: number }>, viewport?: any }>();

const WireEdge = memo(({
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data, selected
}: EdgeProps) => {
  const routingMode = data?.routingMode || 'orthogonal';

  const edgePath = useMemo(() => {
     if (routingMode === 'smooth') {
         const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
         return path;
     }

     const hashString = (str: string) => {
         let hash = 0;
         for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
         return hash;
     };

     const maxSpread = Math.min(120, Math.abs(targetX - sourceX) * 0.8);
     const spread = Math.max(1, Math.floor(maxSpread));
     const offset = (Math.abs(hashString(id)) % spread) - (spread / 2);
     const centerX = (sourceX + targetX) / 2 + offset;

     const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 16, centerX });
     return path;
  }, [id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, routingMode]);

  const widthVal = data?.width;
  const isBus = typeof widthVal === 'number' ? widthVal > 1 : (typeof widthVal === 'string' && widthVal !== '1' && widthVal.length > 0);
  const isActive = selected || data?.isHovered;

  const colorStr = isBus ? '#3b82f6' : '#10b981';
  const activeColorStr = '#facc15';
  const strokeColor = isActive ? activeColorStr : colorStr;

  const baseStrokeWidth = isBus ? 4.5 : 2;
  const strokeWidth = isActive ? baseStrokeWidth + 2 : baseStrokeWidth;
  const outlineWidth = strokeWidth + 12;

  const opacity = (data?.hasHoveredNet && !isActive) ? 0.1 : 1;

  return (
    <g className="group pointer-events-auto" style={{ opacity, transition: 'opacity 0.2s' }}>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={outlineWidth}
        className="cursor-pointer"
      />
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        className="transition-all duration-200"
        style={{
          ...style,
          filter: isActive ? `drop-shadow(0 0 4px ${strokeColor})` : 'none'
        }}
      />
    </g>
  );
});

const InputPortNode = ({ data }: NodeProps) => {
  const wStr = data.width && data.width !== 1 ? (typeof data.width === 'number' ? `[${data.width-1}:0] ` : `${data.width} `) : '';
  const width = 140, height = 32;
  const points = `0,0 130,0 140,16 130,32 0,32`;
  return (
    <div className="relative group" style={{ width, height }}>
       <svg width={width} height={height} className="absolute inset-0 overflow-visible drop-shadow-md">
          <polygon points={points} fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" strokeWidth="1.5" />
       </svg>
       <div className="absolute inset-0 flex items-center pr-4 pl-3">
           <span className="text-[12px] text-blue-200 font-mono font-bold truncate z-10">{wStr}{data.name as string}</span>
       </div>
       <Handle type="source" position={Position.Right} id={data.name as string} className="!opacity-0 !w-1 !h-1 right-0 top-1/2 -translate-y-1/2" />
    </div>
  );
};

const OutputPortNode = ({ data }: NodeProps) => {
  const wStr = data.width && data.width !== 1 ? (typeof data.width === 'number' ? `[${data.width-1}:0] ` : `${data.width} `) : '';
  const width = 140, height = 32;
  const points = `0,0 140,0 140,32 0,32 10,16`;
  return (
    <div className="relative group" style={{ width, height }}>
       <svg width={width} height={height} className="absolute inset-0 overflow-visible drop-shadow-md">
          <polygon points={points} fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.6)" strokeWidth="1.5" />
       </svg>
       <div className="absolute inset-0 flex items-center pr-3 pl-5">
           <span className="text-[12px] text-emerald-200 font-mono font-bold truncate z-10 w-full text-right">{wStr}{data.name as string}</span>
       </div>
       <Handle type="target" position={Position.Left} id={data.name as string} className="!opacity-0 !w-1 !h-1 left-3 top-1/2 -translate-y-1/2" />
    </div>
  );
};

const InoutPortNode = ({ data }: NodeProps) => {
  const wStr = data.width && data.width !== 1 ? (typeof data.width === 'number' ? `[${data.width-1}:0] ` : `${data.width} `) : '';
  const width = 140, height = 32;
  const points = `0,0 130,0 140,16 130,32 0,32 10,16`;
  return (
    <div className="relative group" style={{ width, height }}>
       <svg width={width} height={height} className="absolute inset-0 overflow-visible drop-shadow-md">
          <polygon points={points} fill="rgba(168,85,247,0.15)" stroke="rgba(168,85,247,0.6)" strokeWidth="1.5" />
       </svg>
       <div className="absolute inset-0 flex items-center px-5 justify-center">
           <span className="text-[12px] text-purple-200 font-mono font-bold truncate z-10">{wStr}{data.name as string}</span>
       </div>
       <Handle type="target" position={Position.Left} id={data.name as string} className="!opacity-0 !w-1 !h-1 left-3 top-1/2 -translate-y-1/2" />
       <Handle type="source" position={Position.Right} id={data.name as string} className="!opacity-0 !w-1 !h-1 right-0 top-1/2 -translate-y-1/2" />
    </div>
  );
};

const InternalLogicNode = ({ data }: NodeProps) => {
  const inHandles = (data.inHandles as string[]) || [];
  const outHandles = (data.outHandles as string[]) || [];

  return (
    <div className="bg-[#1a1a20] border-2 border-dashed border-slate-600/50 rounded-xl p-8 shadow-2xl min-w-[300px] flex flex-col items-center justify-center relative group hover:border-slate-500/80 transition-colors" style={{ minHeight: `${Math.max(200, Math.max(inHandles.length, outHandles.length) * 24)}px` }}>
      {inHandles.map((h, i) => {
         const top = `${((i + 1) / (inHandles.length + 1)) * 100}%`;
         return (
             <div key={h} className="absolute left-0" style={{ top, transform: 'translateY(-50%)' }}>
                 <Handle type="target" position={Position.Left} id={h} className="!w-2.5 !h-2.5 !bg-slate-400 !border-none !-ml-1.5 rounded-sm" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                 <span className="text-[9px] text-slate-500 font-mono ml-2 pointer-events-none">{h}</span>
             </div>
         );
      })}
      {outHandles.map((h, i) => {
         const top = `${((i + 1) / (outHandles.length + 1)) * 100}%`;
         return (
             <div key={h} className="absolute right-0" style={{ top, transform: 'translateY(-50%)' }}>
                 <span className="text-[9px] text-slate-500 font-mono mr-2 pointer-events-none">{h.replace('out_', '')}</span>
                 <Handle type="source" position={Position.Right} id={h} className="!w-2.5 !h-2.5 !bg-slate-400 !border-none !-mr-1.5 rounded-sm" style={{ top: '50%', transform: 'translateY(-50%)' }} />
             </div>
         );
      })}
      <div className="flex flex-col items-center justify-center gap-4 text-slate-400 group-hover:text-slate-300 transition-colors py-10 px-8">
         <Cloud className="w-16 h-16 text-slate-500" />
         <span className="text-base font-bold uppercase tracking-wider text-center">Logic Core<br/><span className="text-[10px] lowercase text-slate-500 mt-1">comb / seq logic block</span></span>
      </div>
    </div>
  );
};

const InstanceNode = ({ data }: NodeProps) => {
  const conns = data.connections as any[];
  const hasUnconnected = conns.some(c => !c.connectedNet);
  const inPorts = conns.filter(c => c.direction === 'target');
  const outPorts = conns.filter(c => c.direction === 'source');
  
  return (
    <div className={`bg-[#121216] border ${hasUnconnected ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-orange-500/40 shadow-xl'} rounded-lg min-w-[240px] flex flex-col font-sans overflow-hidden transition-shadow`}>
       <div className={`${hasUnconnected ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'} border-b p-3 flex flex-col items-center justify-center relative`}>
         <div className={`flex items-center gap-2 ${hasUnconnected ? 'text-red-400' : 'text-orange-400'}`}>
            <Cpu className="w-4 h-4" />
            <span className="text-[13px] font-bold truncate max-w-[180px]">{data.name as string}</span>
         </div>
         <span className={`text-[10px] ${hasUnconnected ? 'text-red-200/50' : 'text-orange-200/50'} mt-1 truncate max-w-[180px]`}>mod: {data.type as string}</span>
         {hasUnconnected && (
             <div className="absolute top-2 right-2 text-red-500" title="Unconnected ports detected"><AlertTriangle className="w-3.5 h-3.5" /></div>
         )}
       </div>
       <div className="flex w-full min-h-[60px] pb-3 pt-2">
         <div className="flex flex-col w-1/2 gap-1.5 pl-1.5 pr-1">
            {inPorts.map((conn) => {
               const isUnconnected = !conn.connectedNet;
               return (
                 <div key={conn.portName} className={`flex relative items-center h-[22px] w-full rounded-sm transition-colors ${isUnconnected ? 'bg-red-500/5 hover:bg-red-500/10' : 'bg-white/5 hover:bg-white/10'}`}>
                    {!isUnconnected && (
                      <Handle type="target" position={Position.Left} id={`in_${conn.portName}`} className="!w-2.5 !h-2.5 !bg-orange-400 !border-[#121216] !-ml-1.5" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                    )}
                    <div className="flex flex-col text-[10px] pl-2 pr-1 w-full text-left">
                       <span className={`${isUnconnected ? 'text-red-400/80 font-bold' : 'text-slate-300 font-medium'} truncate`}>{conn.portName}</span>
                    </div>
                    {isUnconnected && <div className="absolute left-0 border-l-[3px] border-red-500 h-full w-1 rounded-[1px]" />}
                 </div>
               );
            })}
         </div>
         <div className="flex flex-col w-1/2 gap-1.5 pr-1.5 pl-1">
            {outPorts.map((conn) => {
               const isUnconnected = !conn.connectedNet;
               return (
                 <div key={conn.portName} className={`flex relative items-center h-[22px] w-full rounded-sm transition-colors ${isUnconnected ? 'bg-red-500/5 hover:bg-red-500/10' : 'bg-white/5 hover:bg-white/10'}`}>
                    <div className="flex flex-col text-[10px] pr-2 pl-1 w-full text-right">
                       <span className={`${isUnconnected ? 'text-red-400/80 font-bold' : 'text-slate-300 font-medium'} truncate`}>{conn.portName}</span>
                    </div>
                    {!isUnconnected && (
                      <Handle type="source" position={Position.Right} id={`out_${conn.portName}`} className="!w-2.5 !h-2.5 !bg-orange-400 !border-[#121216] !-mr-1.5" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                    )}
                    {isUnconnected && <div className="absolute right-0 border-r-[3px] border-red-500 h-full w-1 rounded-[1px]" />}
                 </div>
               );
            })}
         </div>
       </div>
    </div>
  );
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 260 });

  const coreNodes = nodes.filter(n => ['internalLogic', 'instance'].includes(n.type!));

  coreNodes.forEach((node) => {
    let width = 240, height = 200;
    if (node.type === 'internalLogic') { 
        width = 300; 
        const maxH = Math.max((node.data.inHandles as string[])?.length || 0, (node.data.outHandles as string[])?.length || 0);
        height = Math.max(200, maxH * 24 + 80); 
    } else if (node.type === 'instance') { 
        const conns = (node.data.connections as any[]) || [];
        const inL = conns.filter((c: any) => c.direction === 'target').length;
        const outL = conns.filter((c: any) => c.direction === 'source').length;
        height = 80 + Math.max(inL, outL) * 24; 
    }
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    if (coreNodes.find(n => n.id === edge.source) && coreNodes.find(n => n.id === edge.target)) {
       dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  coreNodes.forEach(node => {
     const pos = dagreGraph.node(node.id);
     if (pos) {
         node.position = { x: pos.x - pos.width/2, y: pos.y - pos.height/2 };
         minX = Math.min(minX, node.position.x);
         maxX = Math.max(maxX, node.position.x + pos.width);
         minY = Math.min(minY, node.position.y);
         maxY = Math.max(maxY, node.position.y + pos.height);
     }
  });

  if (minX === Infinity) { minX = 0; maxX = 300; minY = 0; maxY = 200; }

  const centerY = (minY + maxY) / 2;

  const inputNodes = nodes.filter(n => n.type === 'inputPort' || n.type === 'inoutPort');
  const outputNodes = nodes.filter(n => n.type === 'outputPort');
  const coreNodesFinal = nodes.filter(n => ['internalLogic', 'instance'].includes(n.type!));

  const inStartY = centerY - (inputNodes.length * 44) / 2;
  const outStartY = centerY - (outputNodes.length * 44) / 2;

  const finalNodes: Node[] = [...coreNodesFinal];

  if (inputNodes.length > 0) {
      finalNodes.push({
          id: 'inputs_group',
          type: 'group',
          data: {},
          position: { x: minX - 370, y: inStartY - 20 },
          style: { width: 140, height: inputNodes.length * 44 + 40, border: '1px dashed rgba(59,130,246,0.3)', backgroundColor: 'rgba(59,130,246,0.02)', borderRadius: 12, zIndex: -1 }
      });
      inputNodes.forEach((node, idx) => {
          node.parentId = 'inputs_group';
          node.position = { x: 20, y: idx * 44 + 20 };
          node.extent = 'parent';
          finalNodes.push(node);
      });
  }

  if (outputNodes.length > 0) {
      finalNodes.push({
          id: 'outputs_group',
          type: 'group',
          data: {},
          position: { x: maxX + 330, y: outStartY - 20 },
          style: { width: 140, height: outputNodes.length * 44 + 40, border: '1px dashed rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.02)', borderRadius: 12, zIndex: -1 }
      });
      outputNodes.forEach((node, idx) => {
          node.parentId = 'outputs_group';
          node.position = { x: 20, y: idx * 44 + 20 };
          node.extent = 'parent';
          finalNodes.push(node);
      });
  }

  return { nodes: finalNodes, edges };
};

const nodeTypes = {
  inputPort: InputPortNode,
  outputPort: OutputPortNode,
  inoutPort: InoutPortNode,
  internalLogic: InternalLogicNode,
  instance: InstanceNode,
};

const edgeTypes = {
  wireEdge: WireEdge,
};

function InnerDiagram({ content, selectedNet: externalSelectedNet, onSelectNet }: { content: string, selectedNet?: string, onSelectNet?: (net: string | null) => void }) {
  const parsedModules = useMemo(() => parseVerilog(content), [content]);
  const [selectedModuleIdx, setSelectedModuleIdx] = useState(0);
  
  const [localSelectedNet, setLocalSelectedNet] = useState<string | null>(null);
  const selectedNet = externalSelectedNet !== undefined ? externalSelectedNet : localSelectedNet;

  const [routingMode, setRoutingMode] = useState<'orthogonal' | 'smooth'>('orthogonal');
  const [edgesOnTop, setEdgesOnTop] = useState(false);

  const handleSelectNet = useCallback((net: string | null) => {
      setLocalSelectedNet(net);
      if (onSelectNet) onSelectNet(net);
  }, [onSelectNet]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const { setViewport, getViewport, fitView } = useReactFlow();
  const [resetToggle, setResetToggle] = useState(0);

  const nodesRef = React.useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  useEffect(() => {
     if (!parsedModules || parsedModules.length === 0) { setNodes([]); setEdges([]); return; }

     const topModule = parsedModules[selectedModuleIdx < parsedModules.length ? selectedModuleIdx : 0];
     if (!topModule) return;
     
     const newNodes: Node[] = [];
     const newEdges: Edge[] = [];
     
     const inputs = topModule.signals.filter(s => s.ioType === 'input');
     const outputs = topModule.signals.filter(s => s.ioType === 'output');
     const inouts = topModule.signals.filter(s => s.ioType === 'inout');

     const drivers = new Map<string, Array<{id: string, handle: string}>>();
     const readers = new Map<string, Array<{id: string, handle: string}>>();

     inputs.forEach(inp => {
         if (!drivers.has(inp.name)) drivers.set(inp.name, []);
         drivers.get(inp.name)!.push({ id: `in_${inp.name}`, handle: inp.name });
     });

     outputs.forEach(out => {
         if (!readers.has(out.name)) readers.set(out.name, []);
         readers.get(out.name)!.push({ id: `out_${out.name}`, handle: out.name });
     });

     inouts.forEach(io => {
         if (!drivers.has(io.name)) drivers.set(io.name, []);
         drivers.get(io.name)!.push({ id: `inout_${io.name}`, handle: io.name });
         if (!readers.has(io.name)) readers.set(io.name, []);
         readers.get(io.name)!.push({ id: `inout_${io.name}`, handle: io.name });
     });

     const getSigIdx = (name: string) => {
         const raw = name.replace(/^(in|out)_/, '');
         const idx = topModule.signals.findIndex(s => s.name === raw);
         return idx !== -1 ? idx : 999;
     };
     const sorter = (a: string, b: string) => {
         const ia = getSigIdx(a);
         const ib = getSigIdx(b);
         if (ia !== 999 && ib !== 999) return ia - ib;
         if (ia !== 999) return -1;
         if (ib !== 999) return 1;
         return a.localeCompare(b);
     };

     const preparedInstances = topModule.instances.map(inst => {
         const instModuleDef = parsedModules.find(m => m.name === inst.type);
         const annotatedConnections = inst.connections.map(conn => {
            let direction = 'target'; 
            if (instModuleDef) {
               const portDef = instModuleDef.signals.find(s => s.name === conn.portName);
               if (portDef?.ioType === 'output') direction = 'source';
               else if (portDef?.ioType === 'input' || portDef?.ioType === 'inout') direction = 'target';
            } else {
               if (outputs.some(o => o.name === conn.connectedNet)) direction = 'source';
               else if (inputs.some(i => i.name === conn.connectedNet)) direction = 'target';
               else if (/(out|res|q|tx_|miso|txd)/i.test(conn.portName)) direction = 'source';
               else if (/(in|clk|en|rst|valid|ready|rx_|mosi|rxd)/i.test(conn.portName)) direction = 'target';
            }
            return { ...conn, direction };
         });
         
         annotatedConnections.sort((cA, cB) => {
             const netA = cA.connectedNet || '';
             const netB = cB.connectedNet || '';
             if (!netA && !netB) return cA.portName.localeCompare(cB.portName);
             if (!netA) return 1;
             if (!netB) return -1;
             return sorter(netA, netB);
         });

         annotatedConnections.forEach(conn => {
            if (!conn.connectedNet) return;
            if (conn.direction === 'source') {
                if (!drivers.has(conn.connectedNet)) drivers.set(conn.connectedNet, []);
                drivers.get(conn.connectedNet)!.push({ id: `inst_${inst.name}`, handle: `out_${conn.portName}` });
            } else {
                if (!readers.has(conn.connectedNet)) readers.set(conn.connectedNet, []);
                readers.get(conn.connectedNet)!.push({ id: `inst_${inst.name}`, handle: `in_${conn.portName}` });
            }
         });
         return { ...inst, connections: annotatedConnections };
     });

     const logicInHandles = new Set<string>();
     const logicOutHandles = new Set<string>();
     const allNetNames = new Set([...topModule.signals.map(s => s.name)]);
     [...drivers.keys()].forEach(k => allNetNames.add(k));
     [...readers.keys()].forEach(k => allNetNames.add(k));

     const getWidth = (n: string) => topModule.signals.find(s => s.name === n)?.width ?? 1;

     const addEdge = (src: string, srcH: string, tgt: string, tgtH: string, net: string) => {
         if (src === 'logic_core') logicOutHandles.add(srcH);
         if (tgt === 'logic_core') logicInHandles.add(tgtH);
         newEdges.push({
             id: `e_${src}_${srcH}_${tgt}_${tgtH}_${net}`,
             source: src, sourceHandle: srcH,
             target: tgt, targetHandle: tgtH,
             type: 'wireEdge',
             data: { width: getWidth(net), netName: net },
         });
     };

     allNetNames.forEach(net => {
         const nd = drivers.get(net) || [], nr = readers.get(net) || [];
         if (nd.length > 0 && nr.length > 0) nd.forEach(src => nr.forEach(tgt => addEdge(src.id, src.handle, tgt.id, tgt.handle, net)));
         else if (nd.length > 0) nd.forEach(src => addEdge(src.id, src.handle, 'logic_core', `in_${net}`, net));
         else if (nr.length > 0) nr.forEach(tgt => addEdge('logic_core', `out_${net}`, tgt.id, tgt.handle, net));
     });

     inputs.forEach(i => newNodes.push({ id: `in_${i.name}`, type: 'inputPort', position: {x:0, y:0}, data: { ...i } }));
     outputs.forEach(o => newNodes.push({ id: `out_${o.name}`, type: 'outputPort', position: {x:0, y:0}, data: { ...o } }));
     inouts.forEach(io => newNodes.push({ id: `inout_${io.name}`, type: 'inoutPort', position: {x:0, y:0}, data: { ...io } }));
     preparedInstances.forEach(i => newNodes.push({ id: `inst_${i.name}`, type: 'instance', position: {x:0, y:0}, data: { ...i } }));

     if (logicInHandles.size > 0 || logicOutHandles.size > 0) {
         newNodes.push({ 
             id: 'logic_core', type: 'internalLogic', position: {x:0, y:0}, 
             data: { name: topModule.name, inHandles: Array.from(logicInHandles).sort(sorter), outHandles: Array.from(logicOutHandles).sort(sorter) } 
         });
     }

     const { nodes: layN, edges: layE } = getLayoutedElements(newNodes, newEdges);
     
     const cached = diagramStateCache.get(topModule.name);
     if (cached) {
         layN.forEach(n => {
             if (cached.positions[n.id]) n.position = cached.positions[n.id];
         });
         setTimeout(() => {
             if (cached.viewport) {
                 setViewport(cached.viewport);
             }
         }, 50);
     } else {
         setTimeout(() => fitView({ padding: 0.1, duration: 200 }), 100);
     }
     
     setNodes(layN); setEdges(layE);
  }, [parsedModules, selectedModuleIdx, setNodes, setEdges, resetToggle]);
  
  useEffect(() => {
     setEdges((eds) => eds.map(e => ({
         ...e,
         selected: !!(selectedNet && e.data?.netName === selectedNet),
         zIndex: (selectedNet && e.data?.netName === selectedNet) ? 100 : (edgesOnTop ? 10 : 0),
         data: { 
             ...e.data, 
             isHovered: selectedNet && e.data?.netName === selectedNet, 
             hasHoveredNet: !!selectedNet,
             routingMode
         },
         animated: selectedNet && e.data?.netName === selectedNet,
     })));
     
     setNodes((nds) => nds.map(n => {
         if (n.id === 'inputs_group' || n.id === 'outputs_group') return { ...n, zIndex: -1 };
         return { ...n, zIndex: edgesOnTop ? 0 : 10 };
     }));
  }, [selectedNet, setEdges, setNodes, routingMode, edgesOnTop]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => { if (edge.data?.netName) handleSelectNet(edge.data.netName as string); }, [handleSelectNet]);
  const onPaneClick = useCallback(() => handleSelectNet(null), [handleSelectNet]);
  const activeModule = parsedModules?.[selectedModuleIdx];
  const activeModuleName = activeModule?.name || 'unknown';

  useEffect(() => {
      return () => {
         const currentNodes = nodesRef.current;
         const positions: Record<string, {x:number, y:number}> = {};
         currentNodes.forEach(n => {
             positions[n.id] = n.position;
         });
         diagramStateCache.set(activeModuleName, { positions, viewport: getViewport() });
      };
  }, [activeModuleName, getViewport]);

  return (
    <div className="w-full h-full bg-[#0a0a0c] relative flex flex-col font-sans">
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
         <div className="flex items-center gap-2">
           <div className="px-4 py-2 bg-[#121216]/90 backdrop-blur border border-white/10 rounded-lg shadow-xl text-xs flex items-center gap-3">
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> <span className="font-semibold text-white">Block Diagram</span></div>
               <div className="w-px h-4 bg-white/10" />
               {parsedModules && parsedModules.length > 1 ? (
                   <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                          <button className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 -my-1 rounded transition-colors text-slate-300">
                             <span className="text-slate-500">Module:</span> <span className="text-orange-300 font-mono font-bold">{activeModule?.name || 'N/A'}</span>
                          </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                          <DropdownMenu.Content align="start" className="z-50 min-w-[150px] bg-[#1e1e24] border border-[#27272a] rounded-lg shadow-xl py-1 mt-2 font-sans font-medium text-xs">
                             {parsedModules.map((m, i) => (
                                 <DropdownMenu.Item asChild key={m.name}>
                                     <button className="w-full text-left px-4 py-2 hover:bg-[#27272a] text-slate-300 focus:outline-none focus:bg-[#27272a]" onClick={() => setSelectedModuleIdx(i)}>
                                        {m.name}
                                     </button>
                                 </DropdownMenu.Item>
                             ))}
                          </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                   </DropdownMenu.Root>
               ) : (
                   <div className="flex items-center gap-1.5"><span className="text-slate-500">Module:</span> <span className="text-orange-300 font-mono font-bold">{activeModule?.name || 'N/A'}</span></div>
               )}
           </div>
         </div>
         <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121216]/80 backdrop-blur border border-white/5 rounded-lg shadow-xl w-fit">
             <button 
                 onClick={() => setRoutingMode('orthogonal')} 
                 className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors ${routingMode === 'orthogonal' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
             >
                 Orthogonal
             </button>
             <button 
                 onClick={() => setRoutingMode('smooth')} 
                 className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors ${routingMode === 'smooth' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
             >
                 Curved
             </button>
             <div className="w-px h-3 bg-white/10 mx-1" />
             <button 
                 onClick={() => setEdgesOnTop(!edgesOnTop)} 
                 className={`px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors ${edgesOnTop ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
             >
                 {edgesOnTop ? 'Wires on Top' : 'Nodes on Top'}
             </button>
             <div className="w-px h-3 bg-white/10 mx-1" />
             <button 
                 onClick={() => {
                     diagramStateCache.delete(activeModuleName);
                     setResetToggle(t => t + 1);
                 }} 
                 className="px-3 py-1 text-[10px] uppercase font-bold rounded transition-colors text-slate-500 hover:text-slate-300 hover:bg-white/5"
             >
                 Reset View
             </button>
         </div>
      </div>
      
      <div className="absolute bottom-4 left-24 z-10 p-4 bg-[#121216]/90 backdrop-blur border border-white/10 rounded-lg shadow-xl text-[10px] text-slate-400 flex flex-col gap-2.5 pointer-events-none">
         <div className="font-semibold text-slate-300 mb-1">Legend</div>
         <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-blue-500" /> Busses / Wide Nets</div>
         <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-emerald-500" /> 1-Bit Wires</div>
         <div className="h-px w-full bg-white/5 my-0.5" />
         <div className="flex items-center gap-2 text-red-400"><AlertTriangle className="w-3 h-3" /> Unconnected Port</div>
         <div className="flex items-center gap-2 text-yellow-500 mt-1.5 font-semibold opacity-80">Click wires to trace</div>
      </div>

      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
        elevateNodesOnSelect={false} elevateEdgesOnSelect={false}
        fitView fitViewOptions={{ padding: 0.1 }} minZoom={0.1} maxZoom={2} attributionPosition="bottom-right"
      >
        <Background color="#ffffff08" gap={20} size={1} />
        <Controls className="!bg-[#1a1a20] !border-[#27272a] !fill-slate-400 !text-slate-400 shadow-xl" />
      </ReactFlow>
    </div>
  );
}

export function VerilogDiagramViewer(props: { content: string, selectedNet?: string, onSelectNet?: (net: string | null) => void }) {
   return <ReactFlowProvider><InnerDiagram {...props}/></ReactFlowProvider>;
}
