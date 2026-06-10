export const defaultVerilogMake = `VERILATOR=verilator
IVERILOG=iverilog
VVP=vvp

# Target executable
TARGET = {{tbName}}.vvp

# Source files
SOURCES = {{files}} {{tbName}}.v

all: run

build:
	$(IVERILOG) -o $(TARGET) $(SOURCES)

run: build
	$(VVP) $(TARGET)

clean:
	rm -f $(TARGET) *.vcd
`;

export const defaultCppMake = `VERILATOR=verilator

# Target executable
TARGET = V{{tbName}}

# Source files
SOURCES = {{files}}

all: run

build:
	$(VERILATOR) -Wall --cc $(SOURCES) --exe {{tbName}}.cpp
	make -j -C obj_dir -f V{{tbName}}.mk V{{tbName}}

run: build
	./obj_dir/V{{tbName}}

clean:
	rm -rf obj_dir
`;
