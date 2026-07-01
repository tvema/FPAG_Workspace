const content = `
some text
\`\`\`markdown
module a;
endmodule
\`\`\`
some other text
`;

const fileRegex = /<file\s+path="([^"]+)">\s*([\s\S]*?)\s*<\/file>/g;
let strippedContent = content.replace(fileRegex, '\n[File block extracted]\n');
console.log(strippedContent.split(/(```[\s\S]*?```)/g));
