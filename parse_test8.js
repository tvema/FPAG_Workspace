const content = `
some text
\`\`\`c++
int main() {}
\`\`\`
some other text
`;
console.log(content.split(/(```[^\n]*\n[\s\S]*?\n```)/g));
