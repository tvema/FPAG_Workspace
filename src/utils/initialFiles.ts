export const initialFiles: Record<string, any> = {
  readme: {
    name: 'README.md',
    path: 'README.md',
    type: 'markdown',
    content: `# Welcome to FPGA Web IDE\n\nThis is a clean workspace for standard FPGA development.\n\n## Dependencies Installation\nTo compile the Verilog project with the default Makefile, you will need to install the following packages on your system:\n\n\`\`\`bash\nsudo apt-get update\nsudo apt-get install iverilog verilator\n\`\`\`\n\nFor Intel Quartus projects, install Quartus Prime Lite.`
  }
};
