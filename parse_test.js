const content = `
some text
\`\`\`markdown
\`\`\`verilog
module a;
endmodule
\`\`\`
\`\`\`
some other text
`;

function parseBlocks(text) {
    const parts = [];
    let currentIndex = 0;
    while (currentIndex < text.length) {
        const startIdx = text.indexOf('```', currentIndex);
        if (startIdx === -1) {
            parts.push(text.slice(currentIndex));
            break;
        }
        
        // Push the text before the code block
        if (startIdx > currentIndex) {
            parts.push(text.slice(currentIndex, startIdx));
        }
        
        // Find the length of the backtick sequence (e.g., 3, 4, 5)
        let tickCount = 0;
        let i = startIdx;
        while (i < text.length && text[i] === '`') {
            tickCount++;
            i++;
        }
        
        const tickStr = '`'.repeat(tickCount);
        
        // Find the matching closing backticks
        const endIdx = text.indexOf(tickStr, startIdx + tickCount);
        if (endIdx === -1) {
            // No closing backticks found, treat the rest as normal text
            parts.push(text.slice(startIdx));
            break;
        }
        
        // The block is from startIdx to endIdx + tickCount
        parts.push(text.slice(startIdx, endIdx + tickCount));
        currentIndex = endIdx + tickCount;
    }
    return parts;
}

console.log(parseBlocks(content));
