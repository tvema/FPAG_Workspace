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