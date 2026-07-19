const fs = require('fs');
let code = fs.readFileSync('src/utils/verilogParser.ts', 'utf8');

const replacement = `
    // Parse parameters
    const paramRegex = /(?:^|[^\\w.])\\b(parameter|localparam)\\b\\s+([^;]+);/g;
    let paramMatch;
    
    while ((paramMatch = paramRegex.exec(moduleBody)) !== null) {
      const globalIdx = moduleStartIdx + paramMatch.index;
      const lineStart = content.substring(0, globalIdx).split('\\n').length;
      const type = paramMatch[1];
      const declExtracted = paramMatch[0].trim();
      const rest = paramMatch[2];
      
      const chunks = rest.split(',');
      chunks.forEach(chunk => {
         const partBeforeEq = chunk.split('=')[0];
         const stripped = partBeforeEq.replace(/\\[.*?\\]/g, '').replace(/\\b(?:signed|unsigned)\\b/g, '');
         const identMatch = stripped.match(/[a-zA-Z_][a-zA-Z0-9_]*/);
         if (identMatch) {
             const ident = identMatch[0];
             if (!signalMap.has(ident)) {
                 signalMap.set(ident, {
                    name: ident,
                    type: type as any,
                    declaration: declExtracted.replace(/\\s+/g, ' '),
                    lineStart,
                    width: 1
                 });
             }
         }
      });
    }

    const allSignals = Array.from(signalMap.values());
`;

code = code.replace('const allSignals = Array.from(signalMap.values());', replacement.trim());
fs.writeFileSync('src/utils/verilogParser.ts', code);
