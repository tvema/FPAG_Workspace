import { parseVerilog } from "./verilogParser";

let isRegistered = false;

const vKeywords = [
  "always", "and", "assign", "automatic", "begin", "buf", "bufif0", "bufif1", "case", "casex", "casez", "cell", "cmos", "config", "deassign", "default", "defparam", "design", "disable", "edge", "else", "end", "endcase", "endconfig", "endfunction", "endgenerate", "endmodule", "endprimitive", "endspecify", "endtable", "endtask", "event", "for", "force", "forever", "fork", "function", "generate", "genvar", "highz0", "highz1", "if", "ifnone", "incdir", "include", "initial", "inout", "input", "instance", "integer", "join", "large", "liblist", "library", "localparam", "macromodule", "medium", "module", "nand", "negedge", "nmos", "nor", "noshowcancelled", "not", "notif0", "notif1", "or", "output", "parameter", "pmos", "posedge", "primitive", "pull0", "pull1", "pulldown", "pullup", "pulsestyle_ondetect", "pulsestyle_onevent", "rcmos", "real", "realtime", "reg", "release", "repeat", "rnmos", "rpmos", "rtran", "rtranif0", "rtranif1", "scalared", "showcancelled", "signed", "small", "specify", "specparam", "strong0", "strong1", "supply0", "supply1", "table", "task", "time", "tran", "tranif0", "tranif1", "tri", "tri0", "tri1", "triand", "trior", "trireg", "unsigned", "use", "vectored", "wait", "wand", "weak0", "weak1", "while", "wire", "wor", "xnor", "xor"
];

const svKeywords = [
  ...vKeywords, "alias", "always_comb", "always_ff", "always_latch", "assert", "assume", "before", "bind", "bins", "binsof", "bit", "break", "build_coverage", "byte", "chandle", "checker", "class", "clocking", "const", "constraint", "context", "continue", "cover", "covergroup", "coverpoint", "cross", "dist", "do", "endchecker", "endclass", "endclocking", "endgroup", "endinterface", "endpackage", "endprogram", "endproperty", "endsequence", "enum", "expect", "export", "extends", "extern", "final", "first_match", "foreach", "forkjoin", "global", "half", "ignore_bins", "illegal_bins", "implements", "implies", "import", "inside", "int", "interface", "intersect", "join_any", "join_none", "let", "local", "logic", "longint", "matches", "modport", "new", "null", "package", "packed", "priority", "program", "property", "protected", "pure", "rand", "randc", "randcase", "randsequence", "ref", "restrict", "return", "sequence", "shortint", "shortreal", "solve", "static", "string", "struct", "super", "sync_accept_on", "sync_reject_on", "tagged", "this", "throughout", "timeprecision", "timeunit", "type", "typedef", "union", "unique", "unique0", "until", "until_with", "untyped", "var", "virtual", "void", "wait_order", "weak", "wildcard", "with", "within"
];

const cKeywords = [
  "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "goto", "if", "int", "long", "register", "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while", "class", "namespace", "public", "private", "protected", "template", "typename", "this", "new", "delete", "inline", "virtual", "friend", "try", "catch", "throw", "bool", "true", "false", "constexpr", "nullptr", "decltype", "noexcept", "static_assert"
];

function getWordSuggestions(text: string, currentWord: string, keywordsToExclude: string[], range: any, monaco: any) {
  const matches = text.match(/\b[a-zA-Z_]\w*\b/g);
  const suggestions: any[] = [];
  if (matches) {
    const uniqueWords = Array.from(new Set(matches));
    uniqueWords.forEach((w) => {
      if (!keywordsToExclude.includes(w) && w !== currentWord) {
        suggestions.push({
          label: w,
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: w,
          range: range
        });
      }
    });
  }
  return suggestions;
}

export function registerIntellisense(monaco: any) {
  if (isRegistered || !monaco) return;
  isRegistered = true;

  const cProvider = {
    provideCompletionItems: (model: any, position: any) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      const suggestions: any[] = [];

      cKeywords.forEach((k) => {
        suggestions.push({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: k,
          range: range
        });
      });

      const wordSuggestions = getWordSuggestions(model.getValue(), wordInfo.word, cKeywords, range, monaco);
      return { suggestions: [...suggestions, ...wordSuggestions] };
    }
  };

  monaco.languages.registerCompletionItemProvider("c", cProvider);
  monaco.languages.registerCompletionItemProvider("cpp", cProvider);

  const svProvider = {
    provideCompletionItems: (model: any, position: any) => {
      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      const ext = model.uri && model.uri.path ? model.uri.path.split('.').pop()?.toLowerCase() : '';
      const isSv = ext === 'sv' || (ext !== 'v' && model.getLanguageId() === 'systemverilog');
      const keywords = isSv ? svKeywords : vKeywords;

      const suggestions: any[] = [];

      keywords.forEach((k) => {
        let insertText = k;
        let command = undefined;
        if (/^(end|endclass|endmodule|endgenerate|endfunction|endtask|endcase|endspecify|endtable|endsequence|endproperty|endclocking|endgroup|endpackage|endinterface)$/.test(k)) {
          insertText = k.slice(0, -1);
          command = {
            id: 'type',
            title: 'type',
            arguments: [{ text: k.slice(-1) }]
          };
        }
        suggestions.push({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: insertText,
          command: command,
          range: range
        });
      });

      try {
        const text = model.getValue();
        const modules = parseVerilog(text);
        
        modules.forEach(mod => {
          suggestions.push({
            label: mod.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: mod.name,
            detail: `module ${mod.name}`,
            range: range
          });
          
          mod.signals.forEach(sig => {
            suggestions.push({
              label: sig.name,
              kind: sig.ioType ? monaco.languages.CompletionItemKind.Interface : monaco.languages.CompletionItemKind.Variable,
              insertText: sig.name,
              detail: sig.ioType ? `${sig.ioType} ${sig.type}` : sig.type,
              range: range
            });
          });
          
          mod.instances.forEach(inst => {
            suggestions.push({
              label: inst.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: inst.name,
              detail: `instance of ${inst.type}`,
              range: range
            });
          });
        });
      } catch (e) {
        console.error("Intellisense parser error:", e);
      }

      const wordSuggestions = getWordSuggestions(model.getValue(), wordInfo.word, keywords, range, monaco);
      
      const seenLabels = new Set();
      const finalSuggestions: any[] = [];
      
      for (const item of [...suggestions, ...wordSuggestions]) {
        if (!seenLabels.has(item.label)) {
          seenLabels.add(item.label);
          finalSuggestions.push(item);
        }
      }

      return { suggestions: finalSuggestions };
    }
  };

  monaco.languages.registerCompletionItemProvider("verilog", svProvider);
  monaco.languages.registerCompletionItemProvider("systemverilog", svProvider);
}
