module counter #(parameter WIDTH = 8) (
    input wire clk,
    input wire rst,
    output reg [WIDTH-1:0] count
);

    always @(posedge clk or posedge rst) begin
        if (rst)
            count <= 0;
        else
            count <= count + 1;
    end

endmodule
