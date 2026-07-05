import ReactMarkdown from "react-markdown";

/** Renders lesson/scenario markdown with the app's dark styling. */
export default function MarkdownView({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: (props) => (
          <h2 className="mb-3 mt-8 text-lg font-semibold tracking-tight" {...props} />
        ),
        h3: (props) => (
          <h3 className="mb-2 mt-6 text-base font-semibold" {...props} />
        ),
        p: (props) => <p className="mb-4 leading-relaxed text-ink/90" {...props} />,
        ul: (props) => <ul className="mb-4 list-disc space-y-1.5 pl-5" {...props} />,
        ol: (props) => <ol className="mb-4 list-decimal space-y-1.5 pl-5" {...props} />,
        li: (props) => <li className="leading-relaxed text-ink/90" {...props} />,
        strong: (props) => <strong className="font-semibold text-ink" {...props} />,
        a: (props) => (
          <a className="text-accent underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
        ),
        table: (props) => (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm" {...props} />
          </div>
        ),
        th: (props) => (
          <th className="border-b border-edge px-3 py-2 text-left font-semibold" {...props} />
        ),
        td: (props) => <td className="border-b border-edge/60 px-3 py-2" {...props} />,
        pre: (props) => (
          <pre
            className="mb-4 overflow-x-auto rounded-lg border border-edge bg-term-bg p-4 font-mono text-[13px] leading-relaxed"
            {...props}
          />
        ),
        code: ({ className, children, ...rest }) => {
          // Inline code has no language className and no surrounding <pre>
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <code className={`${className} text-term-green`} {...rest}>
              {children}
            </code>
          ) : (
            <code
              className="rounded bg-raised px-1.5 py-0.5 font-mono text-[0.85em] text-term-green"
              {...rest}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
