`timescale 1ns/1ps

module sync_pulse_hub (
    // Тактовые сигналы
    input  wire sys_clk,
    input  wire adc_clk,
    input  wire log_clk,
    input  wire dac_clk,
    input  wire hi_clk,

    // Внешние сигналы
    input  wire i_rst_n,      // Асинхронный вход (например, от PLL locked)
    input  wire i_sync,       // Входной импульс синхронизации (любой длины)

    // Синхронные сбросы
    output wire o_sys_rst_n,
    output wire o_adc_rst_n,
    output wire o_log_rst_n,
    output wire o_dac_rst_n,
    output wire o_hi_rst_n,

    // Синхронные импульсы (ровно 1 такт каждый в своем домене)
    output reg  o_sys_sync,   // Синк для системной логики
    output wire o_adc_sync,
    output wire o_log_sync,
    output wire o_dac_sync,
    output wire o_hi_sync
);

    // --- 1. Генерация синхронных сбросов (Reset Bridges) ---
    reg [1:0] sys_rst_reg;
    reg [1:0] adc_rst_reg;
    reg [1:0] log_rst_reg;
    reg [1:0] dac_rst_reg;
    reg [1:0] hi_rst_reg;

    always @(posedge sys_clk or negedge i_rst_n) 
        if (!i_rst_n) sys_rst_reg <= 2'b0; else sys_rst_reg <= {sys_rst_reg[0], 1'b1};
    
    always @(posedge adc_clk or negedge i_rst_n) 
        if (!i_rst_n) adc_rst_reg <= 2'b0; else adc_rst_reg <= {adc_rst_reg[0], 1'b1};

    always @(posedge log_clk or negedge i_rst_n) 
        if (!i_rst_n) log_rst_reg <= 2'b0; else log_rst_reg <= {log_rst_reg[0], 1'b1};

    always @(posedge dac_clk or negedge i_rst_n) 
        if (!i_rst_n) dac_rst_reg <= 2'b0; else dac_rst_reg <= {dac_rst_reg[0], 1'b1};

    always @(posedge hi_clk or negedge i_rst_n) 
        if (!i_rst_n) hi_rst_reg <= 2'b0; else hi_rst_reg <= {hi_rst_reg[0], 1'b1};

    assign o_sys_rst_n = sys_rst_reg[1];
    assign o_adc_rst_n = adc_rst_reg[1];
    assign o_log_rst_n = log_rst_reg[1];
    assign o_dac_rst_n = dac_rst_reg[1];
    assign o_hi_rst_n = hi_rst_reg[1];

    // --- 2. Обработка входного i_sync и генерация импульсов ---
    reg sync_reg_d1;
    reg toggle_src;

    always @(posedge sys_clk or negedge o_sys_rst_n) begin
        if (!o_sys_rst_n) begin
            sync_reg_d1 <= 1'b0;
            o_sys_sync  <= 1'b0;
            toggle_src  <= 1'b0;
        end 
        else begin
            sync_reg_d1 <= i_sync;
            
            // Выделяем передний фронт для системного домена
            if (i_sync && !sync_reg_d1) begin
                o_sys_sync <= 1'b1;
                toggle_src <= !toggle_src; // Инвертируем флаг для кросс-клок передачи
            end 
            else begin
                o_sys_sync <= 1'b0;
            end
        end
    end

    // --- 3. Рассылка импульса в асинхронные домены ---
    sync_block inst_adc (.clk_dest(adc_clk), .i_tgl_src(toggle_src), .o_pulse_dest(o_adc_sync));
    sync_block inst_log (.clk_dest(log_clk), .i_tgl_src(toggle_src), .o_pulse_dest(o_log_sync));
    sync_block inst_dac (.clk_dest(dac_clk), .i_tgl_src(toggle_src), .o_pulse_dest(o_dac_sync));
    sync_block inst_hi  (.clk_dest(hi_clk),  .i_tgl_src(toggle_src), .o_pulse_dest(o_hi_sync));

endmodule

// Примитив CDC импульса (XOR-type pulse synchronizer)
module sync_block (
    input  wire clk_dest,
    input  wire i_tgl_src,
    output wire o_pulse_dest
);
    reg [2:0] sync_pipe;
    always @(posedge clk_dest) sync_pipe <= {sync_pipe[1:0], i_tgl_src};
    assign o_pulse_dest = sync_pipe[2] ^ sync_pipe[1];
endmodule

