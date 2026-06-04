#!/bin/bash
# Automated test script for all Verilog modules
# Usage: ./run_tests.sh

mkdir -p build
echo "====================================="
echo " Starting Automated Tests... "
echo "====================================="

FAILURES=0

# Find all testbenches
for tb in tb/*_tb.v; do
    # Extract module name from testbench filename
    filename=$(basename "$tb")
    module="${filename%_tb.v}"

    echo "[TEST] Running for module: $module"

    # Compile
    iverilog -o build/${module}.vvp src/${module}.v tb/${filename}
    if [ $? -ne 0 ]; then
        echo "  [FAIL] Compilation failed for $module"
        FAILURES=$((FAILURES+1))
        continue
    fi

    # Simulate
    vvp build/${module}.vvp > build/${module}_sim.log
    if [ $? -ne 0 ]; then
        echo "  [FAIL] Simulation failed for $module"
        FAILURES=$((FAILURES+1))
    else
        echo "  [PASS] Simulation completed for $module"
        echo "         -> Waves generated: ${module}_tb.vcd"
        echo "         -> Log saved: build/${module}_sim.log"
    fi
    echo "-------------------------------------"
done

echo "Done."
if [ $FAILURES -gt 0 ]; then
    echo "Encountered $FAILURES test failures."
    exit 1
else
    echo "All tests passed successfully!"
    exit 0
fi
