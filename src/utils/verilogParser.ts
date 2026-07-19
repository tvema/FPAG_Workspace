export interface VerilogSignal {
  name: string;
  type: 'wire' | 'reg' | 'logic' | 'parameter' | 'localparam';
  ioType?: 'input' | 'output' | 'inout';
  declaration: string;
  lineStart?: number;
  width?: number | string;
}

export interface VerilogInstancePortConnection {
  portName: string;
  connectedNet: string;
}

export interface VerilogInstance {
  type: string;
  name: string;
  lineStart?: number;
  connections: VerilogInstancePortConnection[];
}

export interface VerilogModule {
  name: string;
  header: string;
  signals: VerilogSignal[];
  instances: VerilogInstance[];
  lineStart?: number;
}


const parseCache = new Map<string, VerilogModule[]>();

export function parseVerilog(content: string): VerilogModule[] {
  if (!content) return [];
  if (parseCache.has(content)) return parseCache.get(content)!;

  // Replace comments with spaces to preserve line numbers and offsets
  const cleanedContent = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));

  const modules: VerilogModule[] = [];
  
  const moduleRegex = /\bmodule\b([\s\S]*?)(?:\bendmodule\b|$)/g;
  let modMatch;
  
  let modIdx = 0;
  while ((modMatch = moduleRegex.exec(cleanedContent)) !== null) {
    modIdx++;
    let moduleBody = modMatch[1];
    const moduleStartIdx = modMatch.index + 6;
    
    // Find the end of module header, usually ended by ';'
    let headerEndIdx = moduleBody.indexOf(';');
    if (headerEndIdx === -1) headerEndIdx = moduleBody.length;
    
    const headerStr = moduleBody.substring(0, headerEndIdx + 1);
    
    // Extract module name
    const nameMatch = headerStr.trim().match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    const name = nameMatch ? nameMatch[0] : `module_${modIdx}`;
    
    const header = `module ` + headerStr.trim();
    
    const signalMap = new Map<string, VerilogSignal>();

    // Parse ports (ANSI or non-ANSI)
    const portRegex = /(?:^|[^\w.])\b(input|output|inout)\b\s+(?:(wire|reg|logic)\s+)?([^;,)]+)/g;
    let portMatch;
    while ((portMatch = portRegex.exec(moduleBody)) !== null) {
       const globalIdx = moduleStartIdx + portMatch.index;
       const lineStart = content.substring(0, globalIdx).split('\n').length;

       const ioType = portMatch[1] as 'input' | 'output' | 'inout';
       const type = (portMatch[2] || 'wire') as 'wire' | 'reg' | 'logic';
       const rest = portMatch[3];
       
       let widthVal: string | number = 1;
       const widthMatch = rest.match(/\[(.*?)\]/);
       if (widthMatch) {
          const inner = widthMatch[1];
          const partsNum = inner.split(':');
          if (partsNum.length === 2 && !isNaN(Number(partsNum[0])) && !isNaN(Number(partsNum[1]))) {
             widthVal = Math.abs(Number(partsNum[0]) - Number(partsNum[1])) + 1;
          } else {
             widthVal = `[${inner}]`;
          }
       }

       const parts = rest.split('=')[0];
       const identifiersChunk = parts.replace(/\[.*?\]/g, '').replace(/\b(?:signed|unsigned)\b/g, '');
       const identifiers = identifiersChunk.split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0 && /^[a-zA-Z_]/.test(s));
          
       identifiers.forEach(ident => {
          if (!signalMap.has(ident)) {
             signalMap.set(ident, {
                name: ident,
                type,
                ioType,
                declaration: `${ioType} ${type} ${rest.trim()}`.replace(/\s+/g, ' '),
                lineStart,
                width: widthVal
             });
          } else {
             const existing = signalMap.get(ident)!;
             existing.ioType = ioType;
             if (portMatch[2]) existing.type = type;
             existing.lineStart = Math.min(existing.lineStart || Infinity, lineStart);
             if (widthVal !== 1) existing.width = widthVal;
          }
       });
    }

    // Parse internal wires/regs
    const signalRegex = /(?:^|[^\w.])\b(wire|reg|logic)\b\s+([^;,)]+);/g;
    let sigMatch;
    
    while ((sigMatch = signalRegex.exec(moduleBody)) !== null) {
      const globalIdx = moduleStartIdx + sigMatch.index;
      const lineStart = content.substring(0, globalIdx).split('\n').length;

      const type = sigMatch[1] as 'wire' | 'reg' | 'logic';
      const declExtracted = sigMatch[0].trim();
      const rest = sigMatch[2];
      
      let widthVal: string | number = 1;
      const widthMatch = rest.match(/\[(.*?)\]/);
      if (widthMatch) {
         const inner = widthMatch[1];
         const partsNum = inner.split(':');
         if (partsNum.length === 2 && !isNaN(Number(partsNum[0])) && !isNaN(Number(partsNum[1]))) {
            widthVal = Math.abs(Number(partsNum[0]) - Number(partsNum[1])) + 1;
         } else {
            widthVal = `[${inner}]`;
         }
      }

      const parts = rest.split('=')[0]; 
      const identifiersChunk = parts.replace(/\[.*?\]/g, '').replace(/\b(?:signed|unsigned)\b/g, ''); 
      
      const identifiers = identifiersChunk.split(',')
         .map(s => s.trim())
         .filter(s => s.length > 0 && /^[a-zA-Z_]/.test(s));
         
      identifiers.forEach(ident => {
          if (!signalMap.has(ident)) {
             signalMap.set(ident, {
                name: ident,
                type,
                declaration: declExtracted.replace(/\s+/g, ' '),
                lineStart,
                width: widthVal
             });
          } else {
             const existing = signalMap.get(ident)!;
             existing.type = type;
             if (widthVal !== 1) existing.width = widthVal;
          }
      });
    }
    
    // Parse parameters
    const paramRegex = /(?:^|[^\w.])\b(parameter|localparam)\b\s+([^;]+);/g;
    let paramMatch;
    
    while ((paramMatch = paramRegex.exec(moduleBody)) !== null) {
      const globalIdx = moduleStartIdx + paramMatch.index;
      const lineStart = content.substring(0, globalIdx).split('\n').length;
      const type = paramMatch[1];
      const declExtracted = paramMatch[0].trim();
      const rest = paramMatch[2];
      
      const chunks = rest.split(',');
      chunks.forEach(chunk => {
         const partBeforeEq = chunk.split('=')[0];
         const stripped = partBeforeEq.replace(/\[.*?\]/g, '').replace(/\b(?:signed|unsigned)\b/g, '');
         const identMatch = stripped.match(/[a-zA-Z_][a-zA-Z0-9_]*/);
         if (identMatch) {
             const ident = identMatch[0];
             if (!signalMap.has(ident)) {
                 signalMap.set(ident, {
                    name: ident,
                    type: type as any,
                    declaration: declExtracted.replace(/\s+/g, ' '),
                    lineStart,
                    width: 1
                 });
             }
         }
      });
    }

    const allSignals = Array.from(signalMap.values());
    
    // Filter clean names
    const cleanSignals = allSignals.filter(s => {
       if (s.ioType) return true; // always show I/O
       if (s.name.startsWith('_') || s.name.includes('$') || s.name.includes('.')) return false;
       return true;
    });

    // Sort by lineStart (declaration order)
    cleanSignals.sort((a, b) => (a.lineStart || 0) - (b.lineStart || 0));

    // Parse instances
    const instances: VerilogInstance[] = [];
    const keywords = new Set([
      'always', 'initial', 'assign', 'wire', 'reg', 'logic', 'input', 'output', 'inout', 
      'module', 'endmodule', 'if', 'else', 'case', 'endcase', 'begin', 'end', 'for', 
      'while', 'parameter', 'localparam', 'function', 'endfunction', 'task', 'endtask', 
      'generate', 'endgenerate', 'genvar', 'integer', 'real', 'time', 'always_comb', 
      'always_ff', 'always_latch', 'default', 'return', 'assert', 'property', 'sequence',
      'and', 'nand', 'or', 'nor', 'xor', 'xnor', 'not', 'buf'
    ]);
    
    // Regex for module instantiation:
    // <type> [ #(...) ] <name> [ [...] ] ( <connections> ) ;
    // We avoid matching `module` keyword since we're inside the body, but keywords are checked later.
    let instRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:#\s*\([^;]*?\))?\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\[[^\]]*\])?\s*\(([^;]*?)\)\s*;/g;
    let match;
    while ((match = instRegex.exec(moduleBody)) !== null) {
        if (!keywords.has(match[1]) && !keywords.has(match[2])) {
            const globalIdx = moduleStartIdx + match.index;
            const lineStart = content.substring(0, globalIdx).split('\n').length;
            
            const connectionsStr = match[3];
            const connections: VerilogInstancePortConnection[] = [];
            
            const namedConnRegex = /\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*?)\s*\)/g;
            let connMatch;
            let hasNamed = false;
            while ((connMatch = namedConnRegex.exec(connectionsStr)) !== null) {
                hasNamed = true;
                connections.push({ portName: connMatch[1], connectedNet: connMatch[2].trim() });
            }
            
            if (!hasNamed) {
                // Ordered connections. We split by comma roughly
                let netMatch = connectionsStr.split(',').map(s => s.trim());
                netMatch.forEach((net, idx) => {
                   if (net) {
                       connections.push({ portName: `port_${idx}`, connectedNet: net });
                   }
                });
            }

            instances.push({ type: match[1], name: match[2], lineStart, connections });
        }
    }

    modules.push({
       name,
       header,
       signals: cleanSignals,
       instances,
       lineStart: content.substring(0, modMatch.index).split('\n').length
    });
  }
  
  parseCache.set(content, modules);
  if (parseCache.size > 5) {
      const firstKey = parseCache.keys().next().value;
      if (firstKey) parseCache.delete(firstKey);
  }

  return modules;
}
