"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import 'katex/dist/katex.min.css';

interface MathMarkdownProps {
  children: string;
  className?: string;
}

const MathMarkdown: React.FC<MathMarkdownProps> = ({ children, className = "" }) => {
  // Handle the case where a full LaTeX table is provided
  // We need to detect full LaTeX tables and handle them specially
  const [content, setContent] = useState<string>(children || "");
  
  useEffect(() => {
    // Simple preprocessor to add \text{} around function names
    if (children) {
      let processed = children;
      
      // Simplify: remove any manual escaping of backslashes that might cause problems
      processed = processed.replace(/\\\\([a-zA-Z])/g, '\\$1');
      
      // Replace instances like \line with \\line to fix common issues
      processed = processed.replace(/\\line/g, '\\\\line');
      
      // Add \text{} around trig function names that aren't already wrapped
      const trigFuncs = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'arcsin', 'arccos', 'arctan', 'arcsec', 'arccsc', 'arccot'];
      trigFuncs.forEach(func => {
        const regex = new RegExp(`\\\\${func}\\(`, 'g');
        processed = processed.replace(regex, `\\\\text{${func}}(`);
      });
      
      setContent(processed);
    }
  }, [children]);
  
  return (
    <div className={`prose max-w-full dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, { 
            throwOnError: false,
            strict: false,
            output: 'html',
            trust: true, // Important for complex expressions
            fleqn: false,
            // Macros for common functions
            macros: {
              "\\arcsec": "\\text{arcsec}",
              "\\arccsc": "\\text{arccsc}",
              "\\arccot": "\\text{arccot}",
              "\\arccos": "\\text{arccos}",
              "\\arcsin": "\\text{arcsin}",
              "\\arctan": "\\text{arctan}",
              "\\sin": "\\text{sin}",
              "\\cos": "\\text{cos}",
              "\\tan": "\\text{tan}",
              "\\csc": "\\text{csc}",
              "\\sec": "\\text{sec}",
              "\\cot": "\\text{cot}"
            }
          }]
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MathMarkdown; 