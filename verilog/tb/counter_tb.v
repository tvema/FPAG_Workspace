`timescale 1ns/1ps

module counter_tb;

    reg clk;
    reg rst;
    wire [7:0] count;

    // Instantiate the Unit Under Test (UUT)
    counter #(.WIDTH(8)) uut (
        .clk(clk),
        .rst(rst),
        .count(count)
    );

    // Clock generation
    always #5 clk = ~clk;

    initial begin
        // Initialize VCD generation for GTKWave
        $dumpfile("counter_tb.vcd");
        $dumpvars(0, counter_tb);

        // Initialize inputs
        clk = 0;
        rst = 1;

        // Wait 20 ns for global reset to finish
        #20;
        rst = 0;

        // Run simulation
        #200;

        // Stop simulation
        $display("Simulation complete.");
        $finish;
    end

endmodule
