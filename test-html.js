const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<span style="color: #569CD6">test</span>`);
console.log(dom.window.document.body.innerHTML);
