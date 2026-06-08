export interface VerilogSignal {
  name: string;
  type: 'wire' | 'reg' | 'logic';
  declaration: string;
}

export interface VerilogModule {
  name: string;
  header: string;
  signals: VerilogSignal[];
}

export function parseVerilog(content: string): VerilogModule[] {
  const modules: VerilogModule[] = [];
  
  // Basic regex to find module declarations
  // module \s+ name \s* [#(params)] \s* [(ports)] \s* ;
  // This is hard to do perfectly with regex because of nested parens, 
  // but we can try a somewhat robust approach or extract chunks.
  
  const moduleBlocks = content.split(/\bmodule\b/);
  // first block is before the first module
  
  for (let i = 1; i < moduleBlocks.length; i++) {
    const block = moduleBlocks[i];
    const endMatch = block.match(/\bendmodule\b/);
    let moduleBody = block;
    if (endMatch) {
      moduleBody = block.substring(0, endMatch.index);
    }
    
    // Find the end of module header, usually ended by ';'
    // If there are parameters or ports, they happen before ';'
    let headerEndIdx = moduleBody.indexOf(';');
    if (headerEndIdx === -1) headerEndIdx = moduleBody.length;
    
    const headerStr = moduleBody.substring(0, headerEndIdx + 1);
    
    // Extract module name
    // It's the first word that's a valid identifier
    const nameMatch = headerStr.trim().match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    const name = nameMatch ? nameMatch[0] : `module_${i}`;
    
    const header = `module ` + headerStr.trim();
    
    const signals: VerilogSignal[] = [];
    
    // Now extract signals from the rest of the body + header ports
    // We look for 'wire', 'reg', 'logic' declarations.
    // e.g., wire [7:0] my_wire;
    // reg my_reg = 0;
    
    // Simple regex for signals
    const signalRegex = /\b(wire|reg|logic)\b\s+([^;]+);/g;
    let sigMatch;
    
    // Only search in the whole module body just to be safe
    while ((sigMatch = signalRegex.exec(moduleBody)) !== null) {
      const type = sigMatch[1] as 'wire' | 'reg' | 'logic';
      // declaration might have multiple names "wire a, b, c;"
      const declExtracted = sigMatch[0].trim();
      
      // we'll just add the whole declaration as one tree node, 
      // or we can extract comma separated names.
      // let's extract the last word before '=' or ';' or ',' as the primary name for simplicity,
      // or we can just use the whole declaration as the name for the tree to make it very clear.
      
      // Let's extract the main identifiers if possible, or just use the declaration string 
      // as the "name" to be displayed.
      // But to be cleaner, we can split by comma.
      
      const parts = sigMatch[2].split('=')[0]; // before assignment if any
      const identifiersChunk = parts.replace(/\[.*?\]/g, ''); // remove ranges
      
      const identifiers = identifiersChunk.split(',')
         .map(s => s.trim())
         .filter(s => s.length > 0 && /^[a-zA-Z_]/.test(s));
         
      identifiers.forEach(ident => {
          signals.push({
             name: ident,
             type,
             declaration: declExtracted
          });
      });
    }
    
    // For module ports like `input wire clk`, sometimes they don't end with ';' but with ',' in the header
    // so let's also parse the header for input/output/inout wire/reg
    const portRegex = /\b(input|output|inout)\b\s+(?:(wire|reg|logic)\s+)?([^,;)]+)/g;
    let portMatch;
    while ((portMatch = portRegex.exec(headerStr)) !== null) {
       const ioType = portMatch[1];
       const type = (portMatch[2] || 'wire') as 'wire' | 'reg' | 'logic';
       const rest = portMatch[3];
       
       const parts = rest.split('=')[0];
       const identifiersChunk = parts.replace(/\[.*?\]/g, '');
       const identifiers = identifiersChunk.split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0 && /^[a-zA-Z_]/.test(s));
          
       identifiers.forEach(ident => {
          // avoid duplicates if already picked up
          if (!signals.find(s => s.name === ident)) {
              signals.push({
                 name: ident,
                 type,
                 declaration: `${ioType} ${type} ${rest.trim()}`.replace(/\s+/g, ' ')
              });
          }
       });
    }
    
    modules.push({
       name,
       header,
       signals
    });
  }
  
  return modules;
}
