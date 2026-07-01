let content = `
\`\`\`markdown
\`\`\`verilog
module a;
endmodule
\`\`\`
\`\`\`
`;

content = content.trim();
if (content.startsWith('```markdown\n') && content.endsWith('\n```')) {
    // Check if there are other backticks inside
    const inner = content.slice(12, -4);
    if (inner.includes('```')) {
        content = inner.trim();
    }
}
console.log(content);
