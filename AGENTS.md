# Project Context
This project is a web-based workspace/IDE aimed at FPGA development. 
It is specifically built for working with Verilog and Intel Quartus Prime files.

# Global Rules for AI Assistants
1. ALWAYS assume the target domain is FPGA engineering, Verilog hardware description language, and Quartus tooling.
2. Relevant file types include `.v` (Verilog), `.sv` (SystemVerilog), `.sdc` (Synopsys Design Constraints), `.tcl` (Tool Command Language), and `Makefile`.
3. When generating example files, templates, or new file dialogs, prioritize Verilog modules over standard web development files (no React wrappers unless asked).
4. Ensure the Monaco Editor configurations always maintain support for Verilog, SystemVerilog, TCL, SDC, and Makefiles, as these are the primary languages of this environment.
