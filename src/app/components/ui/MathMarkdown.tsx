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

// Function to fix common mathematical notation problems
const fixMathNotation = (text: string): string => {
  if (!text) return '';
  let processed = text;
  
  // First, fix specific trigonometric definitions that might be problematic
  const definitionPatterns = [
    {
      regex: /Cosecant \(csc\) is the reciprocal of sine:.*?(\)|$)/g,
      replacement: 'Cosecant (csc) is the reciprocal of sine: $\\text{csc}(\\theta) = \\frac{1}{\\sin(\\theta)}$'
    },
    {
      regex: /Secant \(sec\) is the reciprocal of cosine:.*?(\)|$)/g,
      replacement: 'Secant (sec) is the reciprocal of cosine: $\\text{sec}(\\theta) = \\frac{1}{\\cos(\\theta)}$'
    },
    {
      regex: /Cotangent \(cot\) is the reciprocal of tangent:.*?(\)|$)/g,
      replacement: 'Cotangent (cot) is the reciprocal of tangent: $\\text{cot}(\\theta) = \\frac{1}{\\tan(\\theta)}$'
    }
  ];
  
  // Apply each definition pattern
  for (const pattern of definitionPatterns) {
    processed = processed.replace(pattern.regex, pattern.replacement);
  }
  
  // Fix math expressions that are between parentheses but should be in $ delimiters
  processed = processed.replace(
    /\(\\(text|mathrm)\{([a-z]+)\}\(([^)]+)\) = ([^)]+)\)/g, 
    '$\\$1{$2}($3) = $4$'
  );
  
  // Process math within existing $ delimiters to ensure functions are properly marked
  const mathDelimiters = [
    { start: '$$', end: '$$' },
    { start: '$', end: '$' }
  ];
  
  for (const delimiter of mathDelimiters) {
    const regex = new RegExp(`${delimiter.start}(.*?)${delimiter.end}`, 'g');
    processed = processed.replace(regex, (match, content) => {
      // Process trig functions within the math content
      let newContent = content;
      
      // List of all trigonometric functions to check
      const trigFunctions = [
        'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
        'arcsin', 'arccos', 'arctan', 'arcsec', 'arccsc', 'arccot'
      ];
      
      // Add \text{} around each function if not already present
      for (const func of trigFunctions) {
        // Only match the function if it's followed by an opening parenthesis
        // and not already wrapped in \text{} or \mathrm{}
        const funcPattern = new RegExp(`(?<![a-zA-Z\\\\])${func}(?=\\()`, 'g');
        newContent = newContent.replace(funcPattern, `\\text{${func}}`);
      }
      
      // Fix fractions
      newContent = newContent.replace(/\\frac(\w)(\w)/g, '\\frac{$1}{$2}');
      
      return `${delimiter.start}${newContent}${delimiter.end}`;
    });
  }
  
  return processed;
};

const MathMarkdown: React.FC<MathMarkdownProps> = ({ children, className = "" }) => {
  const [content, setContent] = useState<string>("");
  
  useEffect(() => {
    if (children) {
      // Apply all fixes to the content
      const processed = fixMathNotation(children);
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
            trust: true,
            displayMode: false,
            fleqn: false,
            macros: {
              // Add custom macros for trig functions
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