import { renderToString } from 'react-dom/server';
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from 'react-syntax-highlighter/dist/cjs/styles/prism/vsc-dark-plus.js';

const code = `function test(foo) { return 123; }`;
console.log(renderToString(React.createElement(SyntaxHighlighter, { language: 'javascript', style: vscDarkPlus.default }, code)));
