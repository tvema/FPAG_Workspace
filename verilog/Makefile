CC = iverilog
SIM = vvp
WAVE = gtkwave

SRC_DIR = src
TB_DIR = tb
OUT_DIR = build

# Change this to compile a different module
MODULE ?= counter

SRC = $(wildcard $(SRC_DIR)/*.v)
TB = $(TB_DIR)/$(MODULE)_tb.v

all: sim

$(OUT_DIR):
	mkdir -p $(OUT_DIR)

compile: $(OUT_DIR)
	$(CC) -o $(OUT_DIR)/$(MODULE).vvp $(SRC) $(TB)

sim: compile
	$(SIM) $(OUT_DIR)/$(MODULE).vvp

wave: sim
	$(WAVE) $(MODULE)_tb.vcd &

clean:
	rm -rf $(OUT_DIR) *.vcd

.PHONY: all compile sim wave clean
