# Timing Constraints for EP4CE55F23I7N
# Top-level: sync_pulse_hub

# 1. Define Clocks
# -----------------------------------------------------------------------------
# sys_clk: 100 MHz
create_clock -name sys_clk -period 10.000 -waveform { 0.000 5.000 } [get_ports {sys_clk}]

# adc_clk: 125 MHz
create_clock -name adc_clk -period 8.000 -waveform { 0.000 4.000 } [get_ports {adc_clk}]

# log_clk: ~83.33 MHz
create_clock -name log_clk -period 12.000 -waveform { 0.000 6.000 } [get_ports {log_clk}]

# dac_clk: 250 MHz
create_clock -name dac_clk -period 4.000 -waveform { 0.000 2.000 } [get_ports {dac_clk}]

# hi_clk: ~333.33 MHz
create_clock -name hi_clk -period 3.000 -waveform { 0.000 1.500 } [get_ports {hi_clk}]

# derive PLL clocks if PLLs were instantiated (good practice)
derive_pll_clocks

# Derive clock uncertainty (jitter, margin etc.)
derive_clock_uncertainty


# 2. Clock Groups (Asynchronous setup)
# -----------------------------------------------------------------------------
# Since sync_pulse_hub specifically transfers a pulse across different 
# clock domains using CDC techniques, we must inform TimeQuest that 
# these clocks are asynchronous to each other to ignore setup/hold checks 
# across their boundaries.
set_clock_groups -asynchronous \
    -group [get_clocks {sys_clk}] \
    -group [get_clocks {adc_clk}] \
    -group [get_clocks {log_clk}] \
    -group [get_clocks {dac_clk}] \
    -group [get_clocks {hi_clk}]


# 3. False Paths & Exceptions
# -----------------------------------------------------------------------------
# Asynchronous Reset: i_rst_n
# Since we have reset synchronizers (Reset Bridges) for each domain in the RTL,
# we can safely false-path the asynchronous reset pin to all internal destinations.
set_false_path -from [get_ports {i_rst_n}] -to *

# i_sync is captured unconditionally in sys_clk domain first. 
# While it's treated as an async external signal, you can put a false path 
# to the first stage synchronization register to ignore max delay requirements.
set_false_path -from [get_ports {i_sync}] -to [get_registers {sync_reg_d1}]

# 4. Optional I/O Delays
# -----------------------------------------------------------------------------
# If needed, set maximum output delays for output signals
# set_output_delay -clock [get_clocks sys_clk] 2.0 [get_ports {o_sys_sync}]
# ... etc.
