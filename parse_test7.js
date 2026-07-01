const content = `
some text
\`\`\`verilog 
module a;
endmodule
\`\`\`
some other text
`;
console.log(content.split(/(```[a-zA-Z0-9-]*\s*\n[\s\S]*?\n```)/g));
