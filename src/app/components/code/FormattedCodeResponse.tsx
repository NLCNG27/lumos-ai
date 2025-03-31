import React, { useMemo } from "react";
import SyntaxHighlightedCode from "./SyntaxHighlightedCode";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FormattedCodeResponseProps {
  response: string;
}

export default function FormattedCodeResponse({ response }: FormattedCodeResponseProps) {
  const formattedContent = useMemo(() => {
    if (!response) return [];

    // Process the response to enhance markdown formatting for numbered items like "1. **Title**"
    let processedResponse = response;
    
    // Replace patterns like "1. **Title**" with proper markdown
    processedResponse = processedResponse.replace(
      /(\d+)\.\s+\*\*([^*]+)\*\*/g, 
      (_, number, title) => `### ${number}. ${title}`
    );
    
    // Enhance "*" bullet points to make them clearly formatted lists
    processedResponse = processedResponse.replace(
      /^\s*\*\s+(.+)$/gm,
      (_, content) => `- ${content}`
    );

    // Split the response by code blocks
    const parts = processedResponse.split(/(```\w*[\s\S]*?```)/);
    
    return parts.map((part, index) => {
      // Check if this part is a code block
      const codeBlockMatch = part.match(/```(\w*)([\s\S]*?)```/);
      
      if (codeBlockMatch) {
        const language = codeBlockMatch[1]?.trim() || "plaintext";
        const code = codeBlockMatch[2]?.trim() || "";
        
        return (
          <SyntaxHighlightedCode 
            key={index} 
            code={code} 
            language={language} 
          />
        );
      }
      
      // Format regular text with proper markdown styling
      if (part.trim() === "") {
        return null;
      }
      
      return (
        <div 
          key={index} 
          className="prose prose-invert max-w-none mb-4 text-gray-300 leading-relaxed"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ node, ...props }) => <p className="mb-3" {...props} />,
              h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3 mt-4" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-2 mt-4" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-md font-bold mb-2 mt-3 text-gray-100" {...props} />,
              h4: ({ node, ...props }) => <h4 className="font-bold mb-2 mt-3" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-3" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-3" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
              em: ({ node, ...props }) => <em className="italic" {...props} />,
              code: ({ node, ...props }) => (
                <code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
              ),
              a: ({ node, ...props }) => (
                <a className="text-blue-400 hover:underline" {...props} />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-400 my-3" {...props} />
              ),
            }}
          >
            {part}
          </ReactMarkdown>
        </div>
      );
    }).filter(Boolean);
  }, [response]);

  return <div className="code-response">{formattedContent}</div>;
} 