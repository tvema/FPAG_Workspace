const content = `
\`\`\`markdown
\`\`\`verilog
module a;
endmodule
\`\`\`
\`\`\`
`;
console.log(content.split(/(```[a-zA-Z0-9-]*\n[\s\S]*?\n```)/g));
