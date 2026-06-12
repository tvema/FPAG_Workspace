import { parseVerilog } from './src/utils/verilogParser';

const content = `
module top_module(
  input logic [7:0] i_data,
  input logic i_vld,
  output [15:0] o_data
);
endmodule
`;

const mods = parseVerilog(content);
console.log(JSON.stringify(mods[0].signals.map(s => ({name: s.name, width: s.width})), null, 2));
