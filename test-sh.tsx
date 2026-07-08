import React from 'react';
import { renderToString } from 'react-dom/server';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
const { vscDarkPlus } = require('react-syntax-highlighter/dist/cjs/styles/prism');

const code = `
function test(foo) {
  const bar = "string";
  let num = 123;
  return foo + bar;
}
`;

const html = renderToString(
  <SyntaxHighlighter language="javascript" style={vscDarkPlus}>
    {code}
  </SyntaxHighlighter>
);
console.log(html);
