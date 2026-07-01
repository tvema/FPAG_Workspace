const content = `
\`\`\`markdown
\`\`\`verilog
module a;
\`\`\`
\`\`\`
`;
console.log(content.split(/(```[^\n]*\n[\s\S]*?\n```)/g));
