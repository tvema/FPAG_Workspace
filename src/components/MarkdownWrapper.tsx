import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function MarkdownWrapper({ content, printRef }: { content: string, printRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="w-full h-full overflow-auto bg-[#1e1e1e] relative">
      <div ref={printRef} id="markdown-export-content" className="max-w-4xl mx-auto bg-[#1e1e1e] prose prose-invert prose-emerald prose-headings:text-slate-200 prose-p:text-slate-300 prose-a:text-emerald-400 prose-code:text-emerald-300 prose-pre:bg-[#0d0d12] prose-pre:border prose-pre:border-white/10 prose-strong:text-slate-200 p-8 pt-0">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]} 
          rehypePlugins={[rehypeRaw]}
          components={{
            code(props) {
              const { children, className, node, ...rest } = props;
              const match = /language-(\w+)/.exec(className || '');
              
              // Handle 'v' mapping to 'verilog'
              let language = match ? match[1] : '';
              if (language === 'v') {
                  language = 'verilog';
              }

              return match ? (
                <SyntaxHighlighter
                  {...(rest as any)}
                  PreTag="div"
                  children={String(children).replace(/\n$/, '')}
                  language={language}
                  style={vscDarkPlus as any}
                  customStyle={{ background: 'transparent', padding: 0, margin: 0, fontSize: '14px', lineHeight: '1.5' }}
                  codeTagProps={{ style: { fontSize: '14px', lineHeight: '1.5', fontFamily: 'monospace' } }}
                />
              ) : (
                <code {...rest} className={`${className} text-[14px] font-mono`}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
