import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, Download } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language: string;
}

// Map language identifiers to supported prism languages
const languageMap: Record<string, string> = {
  // Common aliases
  "js": "javascript",
  "ts": "typescript",
  "py": "python",
  "rb": "ruby",
  "sh": "bash",
  "bash": "bash",
  "shell": "bash",
  "json": "json",
  "html": "html",
  "css": "css",
  "jsx": "jsx",
  "tsx": "tsx",
  "xml": "xml",
  "yaml": "yaml",
  "yml": "yaml",
  "md": "markdown",
  "sql": "sql",
  "c": "c",
  "cpp": "cpp",
  "cs": "csharp",
  "java": "java",
  "go": "go",
  "rust": "rust",
  "php": "php",
  "swift": "swift",
  "kotlin": "kotlin",
  "r": "r",
  "dart": "dart",
  "python": "python",
};

// Map language to file extension
const languageToExtension: Record<string, string> = {
  "javascript": "js",
  "typescript": "ts",
  "python": "py",
  "ruby": "rb",
  "bash": "sh",
  "json": "json",
  "html": "html",
  "css": "css",
  "jsx": "jsx",
  "tsx": "tsx",
  "xml": "xml",
  "yaml": "yml",
  "markdown": "md",
  "sql": "sql",
  "c": "c",
  "cpp": "cpp",
  "csharp": "cs",
  "java": "java",
  "go": "go",
  "rust": "rs",
  "php": "php",
  "swift": "swift",
  "kotlin": "kt",
  "r": "r",
  "dart": "dart",
};

export default function SyntaxHighlightedCode({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const mappedLanguage = languageMap[language.toLowerCase()] || language || "plaintext";
  const extension = languageToExtension[mappedLanguage] || "txt";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const downloadCode = () => {
    const filename = `code.${extension}`;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative my-4 rounded-md overflow-hidden group">
      {/* Header bar with language and buttons */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-t-md text-xs text-gray-400">
        <span>{mappedLanguage}</span>
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={copyToClipboard}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700"
            title="Copy code"
          >
            <Copy size={14} className="mr-1" />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={downloadCode}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700"
            title="Download code"
          >
            <Download size={14} className="mr-1" />
            Download
          </button>
        </div>
      </div>
      
      {/* Code content with syntax highlighting */}
      <SyntaxHighlighter
        language={mappedLanguage}
        style={vscDarkPlus as any}
        customStyle={{ margin: 0 }}
        className="rounded-b-md my-0 text-base"
        showLineNumbers={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
} 