import { renderToString } from 'react-dom/server';
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js';

const code = `function test(foo) { return 123; }`;

const html = renderToString(
  React.createElement(SyntaxHighlighter, { language: 'javascript', style: vscDarkPlus }, code)
);
console.log(html);
