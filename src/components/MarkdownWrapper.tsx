import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export function MarkdownWrapper({ content }: { content: string }) {
  return (
    <div className="w-full h-full overflow-auto bg-[#1e1e1e] p-8">
      <div className="max-w-4xl mx-auto prose prose-invert prose-emerald prose-headings:text-slate-200 prose-p:text-slate-300 prose-a:text-emerald-400 prose-code:text-emerald-300 prose-pre:bg-[#0d0d12] prose-pre:border prose-pre:border-white/10 prose-strong:text-slate-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
