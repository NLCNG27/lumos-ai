"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import CodeBlock from "../components/ui/CodeBlock";
import LoadingDots from "../components/ui/LoadingDots";
import Image from "next/image";

// Helper function to extract code blocks from markdown
const extractCodeBlocks = (markdown: string) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const matches = [];
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    matches.push({
      language: match[1] || "text",
      code: match[2],
      fullMatch: match[0]
    });
  }

  return matches;
};

export default function CodeInterpreterTest() {
  const [question, setQuestion] = useState<string>("");
  const [response, setResponse] = useState<{
    content: string;
    images: string[];
    loading: boolean;
  }>({
    content: "",
    images: [],
    loading: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) return;
    
    setResponse({
      content: "",
      images: [],
      loading: true,
    });
    
    try {
      const result = await fetch("/api/code-interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });
      
      const data = await result.json();
      
      setResponse({
        content: data.content,
        images: data.images || [],
        loading: false,
      });
    } catch (error) {
      console.error("Error:", error);
      setResponse({
        content: "An error occurred while processing your request.",
        images: [],
        loading: false,
      });
    }
  };

  // Process the response content to replace code blocks with CodeBlock component
  const renderResponse = () => {
    if (!response.content) return null;

    const codeBlocks = extractCodeBlocks(response.content);
    let processedContent = response.content;

    // Replace code blocks with placeholders
    codeBlocks.forEach((block, index) => {
      processedContent = processedContent.replace(
        block.fullMatch,
        `<code-block-${index}></code-block-${index}>`
      );
    });

    // Replace image placeholders
    response.images.forEach((imageUrl, index) => {
      processedContent = processedContent.replace(
        `[IMAGE_PLACEHOLDER_${index}]`,
        `<image-${index}></image-${index}>`
      );
    });

    // Split content by code block and image placeholders
    const parts = processedContent.split(/(<code-block-\d+><\/code-block-\d+>|<image-\d+><\/image-\d+>)/);

    return (
      <div className="prose max-w-full dark:prose-invert">
        {parts.map((part, index) => {
          // Check if this part is a code block placeholder
          const codeBlockMatch = part.match(/<code-block-(\d+)><\/code-block-\d+>/);
          if (codeBlockMatch) {
            const blockIndex = parseInt(codeBlockMatch[1], 10);
            const block = codeBlocks[blockIndex];
            
            return (
              <CodeBlock 
                key={`code-block-${index}`} 
                code={block.code} 
                language={block.language} 
              />
            );
          }
          
          // Check if this part is an image placeholder
          const imageMatch = part.match(/<image-(\d+)><\/image-\d+>/);
          if (imageMatch) {
            const imageIndex = parseInt(imageMatch[1], 10);
            const imageUrl = response.images[imageIndex];
            
            return (
              <div key={`image-${index}`} className="my-4">
                <img 
                  src={imageUrl} 
                  alt={`Generated visualization ${imageIndex + 1}`}
                  className="max-w-full h-auto rounded-md border border-gray-300"
                />
              </div>
            );
          }
          
          // Otherwise render as markdown
          return (
            <ReactMarkdown
              key={`markdown-${index}`}
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {part}
            </ReactMarkdown>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Code Interpreter Test</h1>
          <Link href="/" className="text-blue-500 hover:text-blue-700">
            Back to Home
          </Link>
        </div>
        <p className="mt-2 text-gray-600">
          Test OpenAI's Code Interpreter functionality. Ask questions about math, data science, 
          computer science, or anything that can be solved using code.
        </p>
      </header>

      <main className="flex-grow flex flex-col">
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex flex-col space-y-2">
            <label htmlFor="question" className="font-medium">
              Your Question:
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="E.g., 'Plot a sine wave from 0 to 2π' or 'Analyze this data: [1, 2, 3, 4, 5]'"
              className="p-3 border rounded-md min-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={response.loading}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {response.loading ? "Processing..." : "Submit"}
          </button>
        </form>

        {response.loading && (
          <div className="flex justify-center my-8">
            <LoadingDots size="large" />
          </div>
        )}

        {(response.content || response.images.length > 0) && !response.loading && (
          <div className="flex-grow mt-6 p-4 border rounded-md overflow-auto">
            <h2 className="text-xl font-bold mb-4">Result:</h2>
            {renderResponse()}
          </div>
        )}
      </main>
    </div>
  );
} 