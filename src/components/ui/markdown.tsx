import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders owner-written Markdown safely. Raw HTML in the text is NOT
 * rendered (react-markdown ignores it by default), which prevents script
 * injection from the content manager.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-unar", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (/^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : "")}
        components={{
          a({ href = "", children }) {
            if (href.startsWith("/") || href.startsWith("#")) return <Link href={href}>{children}</Link>;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          img() {
            return null;
          },
          h1({ children }) {
            return <h2>{children}</h2>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
