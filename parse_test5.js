let content = `
Here is the code:
\`\`\`markdown
\`\`\`verilog
module a;
endmodule
\`\`\`
\`\`\`
`;

function cleanResponse(text) {
    // If the text contains ```markdown and it wraps another ``` block, remove the markdown wrapper.
    // A simple heuristic: replace ```markdown\n and the VERY LAST \n``` if there's another ``` inside.
    // Actually, just replacing ALL instances of ```markdown\n and their corresponding closing ``` is hard.
    
    // Better: If we find ```markdown, let's just see if it contains another code block.
    // Let's just remove ```markdown\n and the last ``` if they exist.
    let cleaned = text;
    const mdStart = cleaned.indexOf('```markdown\n');
    if (mdStart !== -1) {
        const afterMd = cleaned.slice(mdStart + 12);
        if (afterMd.includes('```')) {
            // It has at least one code block inside, or a closing backtick.
            // Let's find the LAST ``` in the text and remove it, and remove the ```markdown
            const lastTick = cleaned.lastIndexOf('```');
            if (lastTick > mdStart + 11) {
                cleaned = cleaned.slice(0, mdStart) + cleaned.slice(mdStart + 12, lastTick) + cleaned.slice(lastTick + 3);
            }
        }
    }
    return cleaned;
}

console.log(cleanResponse(content));
