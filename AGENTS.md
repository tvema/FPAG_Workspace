# Project Context
This project is a web-based workspace/IDE aimed at FPGA development. 
It is specifically built for working with Verilog and Intel Quartus Prime files.

# Global Rules for AI Assistants
1. ALWAYS assume the target domain is FPGA engineering, Verilog hardware description language, and Quartus tooling.
2. Relevant file types include `.v` (Verilog), `.sv` (SystemVerilog), `.sdc` (Synopsys Design Constraints), `.tcl` (Tool Command Language), and `Makefile`.
3. When generating example files, templates, or new file dialogs, prioritize Verilog modules over standard web development files (no React wrappers unless asked).
4. Ensure the Monaco Editor configurations always maintain support for Verilog, SystemVerilog, TCL, SDC, and Makefiles, as these are the primary languages of this environment.

# Server-Side Implementation Rules
5. When making external API requests server-side (e.g., to Gemini API) using a proxy configuration, **DO NOT** use native Node `fetch` or `undici`. They have known bugs and unhandled aborts with `ProxyAgent` (e.g., `invalid onRequestStart method`).
6. **ALWAYS** use `node-fetch` + `https-proxy-agent` for proxying backend HTTP/HTTPS requests. Example usage:
   ```typescript
   const fetchNode = (await import('node-fetch')).default;
   const { HttpsProxyAgent } = await import('https-proxy-agent');
   fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
   const response = await fetchNode(apiUrl, fetchOptions);
   ```

# UI/UX & React Flow Diagram Rules
7. **VerilogDiagramViewer Component**: 
   - **`input` ports** of the top module MUST be rendered as horizontal rectangles on the LEFTmost side of the screen (`x: minX - 350`) in a column. Visually, they must have a chevron right edge (pointing towards the center) where the signal connects to the rest of the circuit.
   - **`output` ports** of the top module MUST be rendered as horizontal rectangles on the RIGHTmost side of the screen (`x: maxX + 150`) in a column. Visually, they must have a chevron left edge (accepting the incoming wire) and the wire connects on their left.
   - **`inout` ports** MUST be rendered with a chevron shape on both left and right edges.
   - Do NOT just group them all inside or directly attached to `Logic Core`. They are conceptually the external boundaries (pins) of the module being viewed.

8. **ReactFlow State Persistence Rule**: 
   - NEVER handle ReactFlow view/node position state caching via component unmount cleanup functions, as this wipes the user's manual dragging layout when toggling between tabs or code view.
   - ALWAYS use explicit `onNodeDragStop` and `onMoveEnd` event handlers on the `<ReactFlow>` component to immediately patch/save explicit positions and viewport coordinates into a persistent global/module-scoped map (e.g. `diagramStateCache`).

# Verilog and VCD Parsing Rules
9. **Matching VCD and Verilog Signals**:
   - VCD output signals often contain bit slice dimensions appended to their names (e.g., `count[7:0]`), whereas the statically parsed Verilog AST stores the normalized signal name (e.g., `count`).
   - ALWAYS strip bit slice indexing strings (using `.split('[')[0].trim()`) from the VCD signal name before matching or grouping it against `VerilogModule` signals to correctly identify its `ioType` (input/output) or internal type. Failure to do so will map inputs/outputs to "Others" due to string mismatch.

# Multi-File AI Logic
10. **Project-Level AI Assistant**:
   - The AI Assistant chat has two modes: "File Mode" and "Project Mode". 
   - When in "Project Mode", the context includes all relevant FPGA source files (`.v`, `.c`, `.cpp`, `.md`, `Makefile`, etc.).
   - The chat input (`chatInputs`) in "Project Mode" is global and shared across all files (keyed by `_project_global`), ensuring context and prompts aren't lost when switching files.
   - The AI will output changes in `<file path="..."></file>` blocks.
   - The client parses these blocks and renders a `MultiFileMergeModal` to let the user review and batch-merge changes across multiple files simultaneously.