import React, { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseVerilog } from '../utils/verilogParser';
import { Cloud, Cpu, ArrowRightToLine, ArrowRightFromLine } from 'lucide-react';

const InputPortNode = ({ data }: NodeProps) => {
  return (
    <div className="bg-blue-500/20 border border-blue-500/50 rounded px-3 py-1 flex items-center justify-between min-w-[80px]">
       <span className="text-xs text-blue-200 font-mono pr-4">{data.name}</span>
       <Handle type="source" position={Position.Right} id={data.name} className="!w-2 !h-2 !bg-blue-400 !-mr-1" />
    </div>
  );
};

const OutputPortNode = ({ data }: NodeProps) => {
  return (
    <div className="bg-emerald-500/20 border border-emerald-500/50 rounded px-3 py-1 flex items-center justify-between min-w-[80px]">
       <Handle type="target" position={Position.Left} id={data.name} className="!w-2 !h-2 !bg-emerald-400 !-ml-1" />
       <span className="text-xs text-emerald-200 font-mono pl-4">{data.name}</span>
    </div>
  );
};

const InternalLogicNode = ({ data }: NodeProps) => {
  return (
    <div className="bg-[#1e1e24] border border-slate-500/30 rounded-lg p-6 shadow-xl min-w-[200px] relative">
      <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-around -ml-1">
         {data.inputs.map((inp: any) => (
             <React.Fragment key={inp.name}>
                 <Handle type="target" position={Position.Left} id={`in_${inp.name}`} className="!w-2 !h-2 !bg-slate-400" style={{ position: 'relative', transform: 'none', marginTop: '4px', marginBottom: '4px' }} />
             </React.Fragment>
         ))}
      </div>
      
      <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-around -mr-1">
         {data.outputs.map((out: any) => (
             <React.Fragment key={out.name}>
                 <Handle type="source" position={Position.Right} id={`out_${out.name}`} className="!w-2 !h-2 !bg-slate-400" style={{ position: 'relative', transform: 'none', marginTop: '4px', marginBottom: '4px' }} />
             </React.Fragment>
         ))}
      </div>

      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 py-10">
         <Handle type="target" position={Position.Top} className="!opacity-0" />
         <Handle type="source" position={Position.Bottom} className="!opacity-0" />
         <Cloud className="w-12 h-12 text-slate-400" />
         <span className="text-sm font-medium">Internal Comb/Seq Logic</span>
      </div>
    </div>
  );
};

const InstanceNode = ({ data }: NodeProps) => {
  return (
    <div className="bg-[#16161a] border border-orange-500/30 rounded-lg p-3 shadow-xl min-w-[150px] relative">
       <div className="flex flex-col items-center justify-center gap-1 mb-4 text-slate-300">
         <div className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-orange-400" /><span className="text-sm font-semibold">{data.name}</span></div>
         <span className="text-[10px] text-slate-500">[{data.type}]</span>
       </div>
       
       <div className="flex flex-col gap-3">
         {data.connections.map((conn: any) => (
            <div key={conn.portName} className="flex justify-between items-center text-[10px] text-slate-400 relative">
               <div className="flex items-center z-10 bg-[#16161a]">
                  <Handle type="target" position={Position.Left} id={`in_${conn.portName}`} className="!w-2 !h-2 !bg-orange-400 !-ml-4" />
                  <span className="mr-2 ml-1">{conn.portName}</span>
               </div>
               <span className="text-emerald-500/70 border-b border-dashed border-emerald-500/30 font-mono px-2 z-0">{conn.connectedNet}</span>
               <div className="flex items-center z-10 bg-[#16161a]">
                  <span className="ml-2 mr-1 opacity-0">{conn.portName}</span>
                  <Handle type="source" position={Position.Right} id={`out_${conn.portName}`} className="!w-2 !h-2 !bg-orange-400 !-mr-4" />
               </div>
            </div>
         ))}
       </div>
    </div>
  );
};

const nodeTypes = {
  inputPort: InputPortNode,
  outputPort: OutputPortNode,
  internalLogic: InternalLogicNode,
  instance: InstanceNode,
};

export function VerilogDiagramViewer({ content }: { content: string }) {
  const parsed = useMemo(() => parseVerilog(content), [content]);

  const { nodes, edges } = useMemo(() => {
     if (!parsed || parsed.length === 0) return { nodes: [], edges: [] };
     
     const topModule = parsed[0];
     
     const newNodes: Node[] = [];
     const newEdges: Edge[] = [];

     const inputs = topModule.signals.filter(s => s.type === 'input');
     const outputs = topModule.signals.filter(s => s.type === 'output');

     // Create input port nodes
     inputs.forEach((inp, i) => {
         newNodes.push({
             id: `port_in_${inp.name}`,
             type: 'inputPort',
             position: { x: 50, y: 100 + i * 40 },
             data: { name: inp.name }
         });
     });

     // Create output port nodes
     outputs.forEach((out, i) => {
         newNodes.push({
             id: `port_out_${out.name}`,
             type: 'outputPort',
             position: { x: 800, y: 100 + i * 40 },
             data: { name: out.name }
         });
     });

     // Create internal logic cloud
     newNodes.push({
        id: 'logic_core',
        type: 'internalLogic',
        position: { x: 350, y: 150 },
        data: { inputs, outputs, name: topModule.name }
     });

     // Edges from inputs to logic core
     inputs.forEach((inp) => {
         newEdges.push({
             id: `e_in_${inp.name}_core`,
             source: `port_in_${inp.name}`,
             sourceHandle: inp.name,
             target: 'logic_core',
             targetHandle: `in_${inp.name}`,
             type: 'smoothstep',
             style: { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.5 },
         });
     });

     // Edges from logic core to outputs
     outputs.forEach((out) => {
         newEdges.push({
             id: `e_core_out_${out.name}`,
             source: 'logic_core',
             sourceHandle: `out_${out.name}`,
             target: `port_out_${out.name}`,
             targetHandle: out.name,
             type: 'smoothstep',
             style: { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.5 },
         });
     });

     // Add instances
     let startY = 400;
     topModule.instances.forEach((inst) => {
         const instId = `inst_${inst.name}`;
         newNodes.push({
            id: instId,
            type: 'instance',
            position: { x: 350, y: startY },
            data: { ...inst }
         });
         
         inst.connections.forEach(conn => {
             const isInput = inputs.some(i => i.name === conn.connectedNet);
             const isOutput = outputs.some(o => o.name === conn.connectedNet);
             
             if (isInput) {
                newEdges.push({
                   id: `e_inst_in_${instId}_${conn.portName}`,
                   source: `port_in_${conn.connectedNet}`,
                   sourceHandle: conn.connectedNet,
                   target: instId,
                   targetHandle: `in_${conn.portName}`,
                   type: 'smoothstep',
                   animated: true,
                   style: { stroke: '#60a5fa', strokeWidth: 2 },
                   markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' }
                });
             } else if (isOutput) {
                newEdges.push({
                   id: `e_inst_out_${instId}_${conn.portName}`,
                   source: instId,
                   sourceHandle: `out_${conn.portName}`,
                   target: `port_out_${conn.connectedNet}`,
                   targetHandle: conn.connectedNet,
                   type: 'smoothstep',
                   animated: true,
                   style: { stroke: '#34d399', strokeWidth: 2 },
                   markerEnd: { type: MarkerType.ArrowClosed, color: '#34d399' }
                });
             } else {
                 // Internal net connecting to Logic Core. We create dynamic handles on the Logic Core if needed, or just link without handles at logic core using ID.
                 // Actually we can just dynamically add a Handle to Logic Core or simply link to its center. Let's add a dynamic input/output handle to Logic Core?
                 // Wait! A generic handle on logic_core is fine, say we just use `id="logic_core"`. If we don't specify targetHandle/sourceHandle, it attaches to the node generally.
                newEdges.push({
                   id: `e_inst_internal_${instId}_${conn.portName}`,
                   source: 'logic_core',
                   target: instId,
                   targetHandle: `in_${conn.portName}`,
                   type: 'smoothstep',
                   style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' },
                });
             }
         });
         
         startY += 120 + inst.connections.length * 25;
     });

     return { nodes: newNodes, edges: newEdges };
  }, [parsed]);

  return (
    <div className="w-full h-full bg-[#0a0a0c] relative">
      <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-[#1e1e24] border border-white/10 rounded shadow-xl text-xs text-slate-300">
         <span className="font-semibold text-white">Block Diagram</span>
         <span className="mx-2 text-slate-600">|</span>
         Module: <span className="text-emerald-400 font-mono">{parsed?.[0]?.name}</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#ffffff" gap={20} size={1} opacity={0.05} />
        <Controls className="!bg-[#1e1e24] !border-[#27272a] !fill-slate-400 !text-slate-400" />
      </ReactFlow>
    </div>
  );
}
