export interface VerilogSignal {
  name: string;
  type: 'wire' | 'reg' | 'logic';
  ioType?: 'input' | 'output' | 'inout';
  declaration: string;
  lineStart?: number;
}

export interface VerilogInstance {
  type: string;
  name: string;
  lineStart?: number;
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
       
       const parts = rest.split('=')[0];
       const identifiersChunk = parts.replace(/\[.*?\]/g, '');
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
                lineStart
             });
          } else {
             const existing = signalMap.get(ident)!;
             existing.ioType = ioType;
             if (portMatch[2]) existing.type = type;
             existing.lineStart = Math.min(existing.lineStart || Infinity, lineStart);
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
      const parts = sigMatch[2].split('=')[0]; 
      const identifiersChunk = parts.replace(/\[.*?\]/g, ''); 
      
      const identifiers = identifiersChunk.split(',')
         .map(s => s.trim())
         .filter(s => s.length > 0 && /^[a-zA-Z_]/.test(s));
         
      identifiers.forEach(ident => {
          if (!signalMap.has(ident)) {
             signalMap.set(ident, {
                name: ident,
                type,
                declaration: declExtracted.replace(/\s+/g, ' '),
                lineStart
             });
          } else {
             const existing = signalMap.get(ident)!;
             existing.type = type;
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
    
    // First, find module_type name(...) 
    // This regex looks for `<type> <whitespace> <name> <whitespace_or_newline> (`
    let instRegex1 = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match1;
    while ((match1 = instRegex1.exec(moduleBody)) !== null) {
        if (!keywords.has(match1[1]) && !keywords.has(match1[2])) {
            const globalIdx = moduleStartIdx + match1.index;
            const lineStart = content.substring(0, globalIdx).split('\n').length;
            instances.push({ type: match1[1], name: match1[2], lineStart });
        }
    }

    // Now find module_type #(...) name (...)
    let instRegex2 = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+#\s*\([^;]+?\)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match2;
    while ((match2 = instRegex2.exec(moduleBody)) !== null) {
        if (!keywords.has(match2[1]) && !keywords.has(match2[2])) {
            const globalIdx = moduleStartIdx + match2.index;
            const lineStart = content.substring(0, globalIdx).split('\n').length;
            instances.push({ type: match2[1], name: match2[2], lineStart });
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
  if (parseCache.size > 100) {
      const firstKey = parseCache.keys().next().value;
      if (firstKey) parseCache.delete(firstKey);
  }

  return modules;
}
