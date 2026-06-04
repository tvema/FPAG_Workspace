# Quartus II setup script for Target FPGA: EP4CE55F23I7N
# Run this via: quartus_sh -t setup_project.tcl

set project_name "fpga_project"
project_new $project_name -overwrite

# Set Family and Device
set_global_assignment -name FAMILY "Cyclone IV E"
set_global_assignment -name DEVICE EP4CE55F23I7N

# Common constraints and settings
set_global_assignment -name ERROR_CHECK_FREQUENCY_DIVISOR 1
set_global_assignment -name MIN_CORE_JUNCTION_TEMP "-40"
set_global_assignment -name MAX_CORE_JUNCTION_TEMP 100
set_global_assignment -name POWER_PRESET_COOLING_SOLUTION "23 MM HEAT SINK WITH 200 LFPM AIRFLOW"
set_global_assignment -name POWER_BOARD_THERMAL_MODEL "NONE (CONSERVATIVE)"

# Source files (add your modules here)
set_global_assignment -name VERILOG_FILE ../src/counter.v
set_global_assignment -name VERILOG_FILE ../src/sync_pulse_hub.v
set_global_assignment -name SDC_FILE fpga_project.sdc

# Top level entity
set_global_assignment -name TOP_LEVEL_ENTITY counter

# Example pin assignments for a standard dev board (adjust accordingly)
# set_location_assignment PIN_T2 -name clk
# set_location_assignment PIN_M1 -name rst

# Commit assignments
export_assignments
project_close

puts "Quartus prime project generated successfully for EP4CE55F23I7N."
