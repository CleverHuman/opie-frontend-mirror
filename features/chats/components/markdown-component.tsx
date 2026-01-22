"use client";

import type { Components } from 'react-markdown';
import { ExternalLink, FileText } from 'lucide-react';
import { SyntaxHighlighter } from '@/components/ui/syntax-highlighter';

interface MarkdownProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// Enhanced Code Block Component with Syntax Highlighting
const CodeBlock = ({ children, className, ...props }: MarkdownProps) => {
  // Extract language from className
  const languageMatch = className?.match(/language-(\w+)/);
  const language = languageMatch ? languageMatch[1] : 'text';
  
  // Extract code content
  let codeText = "";
  if (Array.isArray(children) && children.length > 0) {
    const codeEl: any = children[0];
    if (codeEl && codeEl.props && codeEl.props.children) {
      if (Array.isArray(codeEl.props.children)) {
        codeText = codeEl.props.children.join("");
      } else {
        codeText = codeEl.props.children as string;
      }
    }
  } else if (typeof children === "string") {
    codeText = children;
  }

  return (
    <SyntaxHighlighter 
      language={language}
      className={className}
      showCopyButton={true}
    >
      {codeText}
    </SyntaxHighlighter>
  );
};

// Inline Code Component
const InlineCode = ({ children, ...props }: MarkdownProps) => (
  <code
    className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm border"
    {...props}
  >
    {children}
  </code>
);

// Enhanced Blockquote Component
const Blockquote = ({ children, ...props }: MarkdownProps) => (
  <blockquote
    className="mt-6 border-l-4 border-primary/20 pl-6 py-2 bg-muted/30 rounded-r-lg"
    {...props}
  >
    <div className="flex items-start gap-3">
      <div className="mt-1">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-muted-foreground [&>*]:text-muted-foreground">
        {children}
      </div>
    </div>
  </blockquote>
);

// Enhanced Table Component
const Table = ({ children, ...props }: MarkdownProps) => (
  <div className="my-6 w-full overflow-x-auto rounded-lg border">
    <table className="w-full min-w-full divide-y divide-border" {...props}>
      {children}
    </table>
  </div>
);

const TableHeader = ({ children, ...props }: MarkdownProps) => (
  <th 
    className="px-4 py-3 text-left text-sm font-semibold text-foreground bg-muted/50 border-b border-border" 
    {...props}
  >
    {children}
  </th>
);

const TableCell = ({ children, ...props }: MarkdownProps) => (
  <td 
    className="px-4 py-3 text-sm text-foreground border-b border-border" 
    {...props}
  >
    {children}
  </td>
);

// Enhanced Link Component
const Link = ({ children, href, ...props }: MarkdownProps & { href?: string }) => (
  <a
    href={href}
    className="inline-flex items-center gap-1 font-medium text-blue-500 hover:text-blue-700 underline underline-offset-4 transition-colors"
    target="_blank"
    rel="noopener noreferrer"
    {...props}
  >
    {children}
    <ExternalLink className="h-3 w-3" />
  </a>
);

// Enhanced Image Component
const Image = ({ src, alt, ...props }: MarkdownProps & { src?: string; alt?: string }) => (
  <div className="my-4">
    <img 
      src={src} 
      alt={alt} 
      className="rounded-lg border shadow-sm max-w-full h-auto" 
      {...props}
    />
    {alt && (
      <p className="mt-2 text-sm text-muted-foreground text-center italic">
        {alt}
      </p>
    )}
  </div>
);

// Enhanced List Components
const UnorderedList = ({ children, ...props }: MarkdownProps) => (
  <ul className="mt-4 mb-2 pl-8 list-disc space-y-1 [&>li]:marker:text-muted-foreground break-words [&_ul]:pl-8 [&_ol]:pl-8" {...props}>
    {children}
  </ul>
);

const OrderedList = ({ children, ...props }: MarkdownProps) => (
  <ol className="mt-4 mb-2 pl-8 list-decimal space-y-1 [&>li]:marker:text-muted-foreground break-words [&_ul]:pl-8 [&_ol]:pl-8" {...props}>
    {children}
  </ol>
);

const ListItem = ({ children, ...props }: MarkdownProps) => (
  <li className="break-words [&>ul]:mt-2 [&>ol]:mt-2" {...props}>
    {children}
  </li>
);

// Enhanced Heading Components
const Heading1 = ({ children, ...props }: MarkdownProps) => (
  <h1 className="scroll-m-20 text-4xl font-bold tracking-tight mb-6 mt-8 border-b pb-2" {...props}>
    {children}
  </h1>
);

const Heading2 = ({ children, ...props }: MarkdownProps) => (
  <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight mb-4 mt-8" {...props}>
    {children}
  </h2>
);

const Heading3 = ({ children, ...props }: MarkdownProps) => (
  <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-4 mt-6" {...props}>
    {children}
  </h3>
);

const Heading4 = ({ children, ...props }: MarkdownProps) => (
  <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-3 mt-6" {...props}>
    {children}
  </h4>
);

const Heading5 = ({ children, ...props }: MarkdownProps) => (
  <h5 className="scroll-m-20 text-lg font-semibold tracking-tight mb-3 mt-4" {...props}>
    {children}
  </h5>
);

const Heading6 = ({ children, ...props }: MarkdownProps) => (
  <h6 className="scroll-m-20 text-base font-semibold tracking-tight mb-2 mt-4" {...props}>
    {children}
  </h6>
);

// Enhanced Paragraph Component
const Paragraph = ({ children, ...props }: MarkdownProps) => (
  <p className="leading-7 [&:not(:first-child)]:mt-6 break-words" {...props}>
    {children}
  </p>
);

// Enhanced Horizontal Rule Component
const HorizontalRule = ({ ...props }: MarkdownProps) => (
  <hr className="my-8 border-border" {...props} />
);

// Enhanced Emphasis Components
const Strong = ({ children, ...props }: MarkdownProps) => (
  <strong className="font-semibold text-foreground" {...props}>
    {children}
  </strong>
);

const Emphasis = ({ children, ...props }: MarkdownProps) => (
  <em className="italic text-foreground" {...props}>
    {children}
  </em>
);

export const MarkdownComponents: Components = {
  // Headings
  h1: Heading1 as any,
  h2: Heading2 as any,
  h3: Heading3 as any,
  h4: Heading4 as any,
  h5: Heading5 as any,
  h6: Heading6 as any,
  
  // Text elements
  p: Paragraph as any,
  strong: Strong as any,
  em: Emphasis as any,
  
  // Links and media
  a: Link as any,
  img: Image as any,
  
  // Lists
  ul: UnorderedList as any,
  ol: OrderedList as any,
  li: ListItem as any,
  
  // Code blocks
  pre: ({ children, ...props }: MarkdownProps) => {
    // Check if the pre contains a code element
    if (children && typeof children === 'object' && 'type' in children && children.type === 'code') {
      // If it's a code block, render it with our CodeBlock component
      const codeElement = children as any;
      const codeProps = codeElement.props || {};
      return <CodeBlock className={codeProps.className}>{codeProps.children}</CodeBlock>;
    }
    // For other pre content, wrap in a pre element
    return <pre className="my-4 p-4 bg-muted rounded-lg overflow-x-auto" {...props}>{children}</pre>;
  },
  code: ({ node, inline, className, children, ...props }: MarkdownProps & { inline?: boolean }) => {
    if (inline) {
      return <InlineCode {...props}>{children}</InlineCode>;
    }
    // For block code that's not inside a pre tag, render as CodeBlock
    return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
  },
  
  // Blockquotes
  blockquote: Blockquote as any,
  
  // Tables
  table: Table as any,
  th: TableHeader as any,
  td: TableCell as any,
  
  // Other elements
  hr: HorizontalRule as any,
};
  
  