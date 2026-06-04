`timescale 1ns/1ps

module sync_pulse_hub_tb;

    // Clock signals
    reg sys_clk;
    reg adc_clk;
    reg log_clk;
    reg dac_clk;
    reg hi_clk;

    // External signals
    reg i_rst_n;
    reg i_sync;

    // Outputs
    wire o_sys_rst_n;
    wire o_adc_rst_n;
    wire o_log_rst_n;
    wire o_dac_rst_n;
    wire o_hi_rst_n;

    wire o_sys_sync;
    wire o_adc_sync;
    wire o_log_sync;
    wire o_dac_sync;
    wire o_hi_sync;

    // Instantiate the Unit Under Test (UUT)
    sync_pulse_hub uut (
        .sys_clk(sys_clk),
        .adc_clk(adc_clk),
        .log_clk(log_clk),
        .dac_clk(dac_clk),
        .hi_clk(hi_clk),
        .i_rst_n(i_rst_n),
        .i_sync(i_sync),
        .o_sys_rst_n(o_sys_rst_n),
        .o_adc_rst_n(o_adc_rst_n),
        .o_log_rst_n(o_log_rst_n),
        .o_dac_rst_n(o_dac_rst_n),
        .o_hi_rst_n(o_hi_rst_n),
        .o_sys_sync(o_sys_sync),
        .o_adc_sync(o_adc_sync),
        .o_log_sync(o_log_sync),
        .o_dac_sync(o_dac_sync),
        .o_hi_sync(o_hi_sync)
    );

    // Clock generators
    always #5   sys_clk = ~sys_clk;   // 100 MHz
    always #4   adc_clk = ~adc_clk;   // ~125 MHz
    always #6   log_clk = ~log_clk;   // ~83 MHz
    always #2   dac_clk = ~dac_clk;   // 250 MHz
    always #1.5 hi_clk  = ~hi_clk;    // ~333 MHz

    initial begin
        // Initialize VCD generation for GTKWave
        $dumpfile("sync_pulse_hub_tb.vcd");
        $dumpvars(0, sync_pulse_hub_tb);

        // Initialize Inputs
        sys_clk = 0;
        adc_clk = 0;
        log_clk = 0;
        dac_clk = 0;
        hi_clk  = 0;
        
        i_rst_n = 0;
        i_sync  = 0;

        // Wait for global reset to finish
        #50;
        i_rst_n = 1;

        // Wait to settle
        #50;

        // Trigger sync pulse
        @(posedge sys_clk);
        i_sync = 1;
        
        // Hold for a few clock cycles
        #30;
        i_sync = 0;

        // Wait for all syncs to propagate
        #100;

        // Trigger another sync pulse
        @(posedge sys_clk);
        i_sync = 1;
        #20;
        i_sync = 0;

        #200;
        
        $display("Simulation complete.");
        $finish;
    end

endmodule
