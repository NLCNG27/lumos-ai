import { Message, ProcessedFile } from "@/app/types";
import ReactMarkdown from "react-markdown";
import { useState, memo, useRef, useEffect } from "react";
import Image from "next/image";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { Components } from 'react-markdown';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import DownloadButton from '../ui/DownloadButton';
import CodeBlockMenu from '../ui/CodeBlockMenu';
import { isDownloadableCode, suggestFilename } from '@/app/lib/fileUtils';
import DatasetPreview from '../ui/DatasetPreview';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

type ChatMessageProps = {
    message: Message;
};

// Update CodeProps interface to make children optional and extend from React.HTMLAttributes
interface CodeProps extends React.HTMLAttributes<HTMLElement> {
    node?: any;
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
}

// Use React.memo to prevent unnecessary re-renders
const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const [isCopied, setIsCopied] = useState(false);
    // Add state for code block context menu
    const [activeCodeBlock, setActiveCodeBlock] = useState<{ content: string; language: string } | null>(null);
    const codeBlockRef = useRef<HTMLDivElement>(null);
    // Add state for dataset detection
    const [datasets, setDatasets] = useState<Array<{
        content: string;
        format: string;
        filename: string;
        mimeType: string;
    }>>([]);

    const copyToClipboard = () => {
        navigator.clipboard
            .writeText(message.content)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
            })
            .catch((err) => {
                console.error("Failed to copy text: ", err);
            });
    };

    // Display uploaded files (if any)
    const renderUploadedFiles = () => {
        if (!message.files || message.files.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-2 mb-2">
                {message.files.map((file) => {
                    // Skip rendering if file is invalid
                    if (!file || !file.id) return null;
                    
                    return (
                        <div
                            key={file.id}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col"
                        >
                            <div className="flex items-center gap-2">
                                {renderFilePreview(file)}
                                <div className="flex-1 min-w-0">
                                    <p
                                        className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate"
                                        title={file.name || "Unknown file"}
                                    >
                                        {file.name || "Unknown file"}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Unknown size"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Render file preview based on file type
    const renderFilePreview = (file: ProcessedFile) => {
        // Add null checks to prevent errors when file properties are undefined
        if (file && file.type && file.type.startsWith("image/") && file.previewUrl) {
            return (
                <div className="relative w-16 h-16 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                    <Image
                        src={file.previewUrl}
                        alt={file.name || "Image"}
                        fill
                        style={{ objectFit: "cover" }}
                    />
                </div>
            );
        }

        // File type specific icons
        let iconPath;
        let bgColor = "bg-gray-100 dark:bg-gray-800";
        let textColor = "text-gray-600 dark:text-gray-300";
        const fileExtension = file && file.name ? file.name.split(".").pop()?.toLowerCase() : "";

        if (["pdf"].includes(fileExtension || "")) {
            iconPath =
                "M14 11h1v2h-3V8h2v3zM10 11H9V9h1v2zm-3 0H6V9h1v2zM17 6H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z";
            bgColor = "bg-red-100 dark:bg-red-900/30";
            textColor = "text-red-600 dark:text-red-300";
        } else if (["doc", "docx"].includes(fileExtension || "")) {
            iconPath =
                "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9h-2v2h2v2h-2v2h-2v-2H9v-2h2v-2H9V9h2V7h2v2h2v2z";
            bgColor = "bg-blue-100 dark:bg-blue-900/30";
            textColor = "text-blue-600 dark:text-blue-300";
        } else if (["xls", "xlsx", "csv"].includes(fileExtension || "")) {
            iconPath =
                "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 5h3.5L13 3.5V7zm-2 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V9h4v2z";
            bgColor = "bg-green-100 dark:bg-green-900/30";
            textColor = "text-green-600 dark:text-green-300";
        } else {
            iconPath =
                "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z";
        }

        return (
            <div
                className={`relative w-16 h-16 flex items-center justify-center rounded ${bgColor}`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-8 w-8 ${textColor}`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path d={iconPath} />
                </svg>  
            </div>
        );
    };

    // Define markdown components for consistent rendering
    const markdownComponents: Components = {
        h1: ({...props}: any) => <h1 className="text-xl font-bold my-3" {...props} />,
        h2: ({...props}: any) => <h2 className="text-lg font-bold my-3" {...props} />,
        h3: ({...props}: any) => <h3 className="text-md font-bold my-2" {...props} />,
        h4: ({...props}: any) => <h4 className="text-base font-bold my-2" {...props} />,
        h5: ({...props}: any) => <h5 className="text-sm font-bold my-1" {...props} />,
        h6: ({...props}: any) => <h6 className="text-xs font-bold my-1" {...props} />,
        p: ({...props}: any) => <p className="my-2 leading-relaxed" {...props} />,
        ul: ({...props}: any) => <ul className="list-disc pl-5 my-3 space-y-1" {...props} />,
        ol: ({...props}: any) => <ol className="list-decimal pl-5 my-3 space-y-1" {...props} />,
        li: ({...props}: any) => <li className="my-1" {...props} />,
        a: ({...props}: any) => <a className="text-blue-500 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors" {...props} />,
        blockquote: ({...props}: any) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1 my-3 text-gray-700 dark:text-gray-300 italic" {...props} />,
        hr: ({...props}: any) => <hr className="my-4 border-gray-300 dark:border-gray-600" {...props} />,
        table: ({...props}: any) => <div className="overflow-x-auto my-3"><table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600 border border-gray-300 dark:border-gray-600 rounded" {...props} /></div>,
        thead: ({...props}: any) => <thead className="bg-gray-100 dark:bg-gray-700" {...props} />,
        tbody: ({...props}: any) => <tbody className="divide-y divide-gray-200 dark:divide-gray-700" {...props} />,
        tr: ({...props}: any) => <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50" {...props} />,
        th: ({...props}: any) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" {...props} />,
        td: ({...props}: any) => <td className="px-3 py-2 whitespace-nowrap text-sm" {...props} />,
        code: ({ className, children, inline, ...props }: CodeProps) => {
            const match = /language-(\w+)/.exec(className || '');
            
            if (match && (match[1] === 'latex' || match[1] === 'math' || match[1] === 'tex')) {
                try {
                    return <BlockMath math={String(children).replace(/\n$/, '')} />;
                } catch (error) {
                    console.error('Error rendering LaTeX in code block:', error);
                    return <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
                }
            }
            
            const codeContent = String(children).replace(/\n$/, '');
            const isDownloadable = match && isDownloadableCode(match[1], codeContent);
            
            return match ? (
                <div 
                    ref={codeBlockRef}
                    className={`relative group ${isDownloadable ? 'code-block-downloadable' : ''}`}
                    onContextMenu={() => {
                        if (isDownloadable) {
                            setActiveCodeBlock({
                                content: codeContent,
                                language: match[1]
                            });
                        }
                    }}
                >
                    {/* Header bar with language and buttons */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-t-md text-xs text-gray-400">
                        <span>{match[1]}</span>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700"
                                onClick={() => navigator.clipboard.writeText(codeContent)}
                                title="Copy code"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Copy
                            </button>
                            
                            {/* Add download button if the code is downloadable */}
                            {isDownloadable && (
                                <DownloadButton 
                                    content={codeContent}
                                    language={match[1]}
                                    suggestedFilename={suggestFilename(codeContent, match[1])}
                                    highlightAttention={codeContent.split('\n').length > 20}
                                />
                            )}
                        </div>
                    </div>

                    <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-b-md my-0 text-sm"
                        showLineNumbers={true}
                        {...props}
                    >
                        {codeContent}
                    </SyntaxHighlighter>
                </div>
            ) : (
                <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
            );
        },
        pre: ({children}: any) => <div className="overflow-hidden rounded-md my-3">{children}</div>,
    };

    // Process the message content to extract datasets
    useEffect(() => {
        // Look for dataset markers in the message
        const datasetRegex = /```dataset-(?<format>[a-z]+)(?<options>\{.*?\})?\n(?<content>[\s\S]*?)```/g;
        
        // Reset datasets
        setDatasets([]);
        
        // Get the message content
        const messageContent = message.content;
        if (!messageContent) return;
        
        console.log('Processing message for datasets, content length:', messageContent.length);
        
        // Find all dataset markers in the content
        let match;
        let matches = [];
        
        // Use a regex that captures the entire match
        const regex = new RegExp(datasetRegex);
        let content = messageContent;
        
        // First collect all matches
        while ((match = regex.exec(content)) !== null) {
            const { format, options, content: datasetContent } = match.groups || {};
            
            if (format && datasetContent) {
                console.log(`Found dataset: format=${format}, content length=${datasetContent.length}`);
                matches.push({
                    format,
                    options,
                    content: datasetContent,
                    fullMatch: match[0]
                });
            }
        }
        
        // Process the matches
        if (matches.length > 0) {
            const extractedDatasets = matches.map(match => {
                const { format, options, content: datasetContent } = match;
                
                let parsedOptions = {};
                if (options) {
                    try {
                        parsedOptions = JSON.parse(options);
                    } catch (e) {
                        console.error('Failed to parse dataset options:', e);
                    }
                }

                const formatInfo: Record<string, { extension: string; mimeType: string }> = {
                    csv: { extension: 'csv', mimeType: 'text/csv' },
                    json: { extension: 'json', mimeType: 'application/json' },
                    xml: { extension: 'xml', mimeType: 'application/xml' },
                    yaml: { extension: 'yaml', mimeType: 'text/yaml' },
                    sql: { extension: 'sql', mimeType: 'text/plain' },
                    txt: { extension: 'txt', mimeType: 'text/plain' },
                    markdown: { extension: 'md', mimeType: 'text/markdown' },
                    html: { extension: 'html', mimeType: 'text/html' },
                    tsv: { extension: 'tsv', mimeType: 'text/tab-separated-values' },
                };

                const { extension, mimeType } = formatInfo[format] || formatInfo.txt;
                const filename = (parsedOptions as any).name 
                    ? `${(parsedOptions as any).name}.${extension}` 
                    : `dataset.${extension}`;

                return {
                    content: datasetContent,
                    format,
                    filename,
                    mimeType,
                    fullMatch: match.fullMatch
                };
            });
            
            console.log('Extracted datasets:', extractedDatasets.length);
            setDatasets(extractedDatasets);
        }
    }, [message.content]);

    // Process the message content to extract LaTeX blocks
    const processLatexContent = (content: string) => {
        // Check if content contains LaTeX delimiters
        if (!content.includes('\\[') && !content.includes('\\(')) {
            return { hasLatex: false, processedContent: content };
        }

        // Process the content to handle multiline LaTeX blocks
        const lines = content.split('\n');
        const processedLines = [];
        let inLatexBlock = false;
        let latexContent = '';
        let currentBlockType = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for LaTeX block start
            if (line.includes('\\[')) {
                inLatexBlock = true;
                currentBlockType = 'block';
                latexContent = line.replace('\\[', '').trim();
                continue;
            } 
            // Check for LaTeX inline start
            else if (line.includes('\\(')) {
                inLatexBlock = true;
                currentBlockType = 'inline';
                latexContent = line.replace('\\(', '').trim();
                continue;
            }
            // Check for LaTeX block end
            else if (inLatexBlock && line.includes('\\]')) {
                latexContent += ' ' + line.replace('\\]', '').trim();
                processedLines.push({
                    type: 'latex',
                    mode: currentBlockType,
                    content: latexContent.trim()
                });
                inLatexBlock = false;
                latexContent = '';
                continue;
            }
            // Check for LaTeX inline end
            else if (inLatexBlock && line.includes('\\)')) {
                latexContent += ' ' + line.replace('\\)', '').trim();
                processedLines.push({
                    type: 'latex',
                    mode: currentBlockType,
                    content: latexContent.trim()
                });
                inLatexBlock = false;
                latexContent = '';
                continue;
            }
            // Continue gathering content for a LaTeX block
            else if (inLatexBlock) {
                latexContent += ' ' + line.trim();
                continue;
            }
            // Handle markdown headings (###, ####, etc.)
            else if (line.trim().startsWith('#')) {
                const headerMatch = line.trim().match(/^(#+)\s*(.*)$/);
                if (headerMatch) {
                    processedLines.push({
                        type: 'heading',
                        level: headerMatch[1].length,
                        content: headerMatch[2]
                    });
                } else {
                    processedLines.push({
                        type: 'text',
                        content: line
                    });
                }
            }
            // Handle list items with headings (like "1. **Calculus**:")
            else if (/^\d+\.\s+\*\*.*?\*\*:/.test(line)) {
                processedLines.push({
                    type: 'listHeading',
                    content: line
                });
            }
            // Regular text line
            else {
                processedLines.push({
                    type: 'text',
                    content: line
                });
            }
        }

        return { hasLatex: true, processedLines };
    };

    // Component to render the processed content
    const ProcessedContent = () => {
        // If we have datasets, split the content by dataset markers and insert dataset components
        if (datasets.length > 0) {
            console.log('Rendering with datasets:', datasets.length);
            
            // Create a modified content by replacing dataset markers with placeholders
            let processedContent = message.content;
            
            // Replace each dataset with a unique placeholder
            datasets.forEach((dataset, index) => {
                if (dataset.fullMatch) {
                    processedContent = processedContent.replace(dataset.fullMatch, `[DATASET_${index}]`);
                }
            });
            
            // Split by placeholders and create an array of parts
            const parts = [];
            let lastIndex = 0;
            
            for (let i = 0; i < datasets.length; i++) {
                const placeholder = `[DATASET_${i}]`;
                const placeholderIndex = processedContent.indexOf(placeholder, lastIndex);
                
                if (placeholderIndex !== -1) {
                    // Add text before the placeholder
                    if (placeholderIndex > lastIndex) {
                        parts.push({
                            type: 'text',
                            content: processedContent.substring(lastIndex, placeholderIndex)
                        });
                    }
                    
                    // Add the dataset
                    parts.push({
                        type: 'dataset',
                        index: i
                    });
                    
                    lastIndex = placeholderIndex + placeholder.length;
                }
            }
            
            // Add any remaining text
            if (lastIndex < processedContent.length) {
                parts.push({
                    type: 'text',
                    content: processedContent.substring(lastIndex)
                });
            }
            
            // Render the parts
            return (
                <>
                    {parts.map((part, index) => {
                        if (part.type === 'text') {
                            return part.content.trim() ? (
                                <div key={`text-${index}`}>
                                    <ReactMarkdown
                                        components={markdownComponents}
                                        remarkPlugins={[remarkMath, remarkGfm]}
                                        rehypePlugins={[rehypeKatex]}
                                    >
                                        {part.content}
                                    </ReactMarkdown>
                                </div>
                            ) : null;
                        } else if (part.type === 'dataset') {
                            const dataset = datasets[part.index];
                            return (
                                <DatasetPreview
                                    key={`dataset-${part.index}`}
                                    content={dataset.content}
                                    format={dataset.format}
                                    filename={dataset.filename}
                                    mimeType={dataset.mimeType}
                                />
                            );
                        }
                        return null;
                    })}
                </>
            );
        }
        
        // If no datasets, render the content normally
        return (
            <ReactMarkdown
                components={markdownComponents}
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
            >
                {message.content}
            </ReactMarkdown>
        );
    };

    return (
        <div
            className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} mb-6`}
        >
            {/* {!isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-xs font-medium">AI</span>
                </div>
            )} */}
            <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl relative group ${
                    isUser
                        ? "bg-blue-500 text-white rounded-tr-none shadow-sm"
                        : "bg-gray-50 dark:bg-gray-800/80 text-gray-800 dark:text-gray-100 rounded-tl-none shadow-sm border border-gray-200 dark:border-gray-700"
                }`}
            >
                {!isUser && (
                    <button
                        onClick={copyToClipboard}
                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:scale-110 transform"
                        title="Copy to clipboard"
                    >
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full p-1.5 shadow-lg">
                        {isCopied ? (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                   className="h-4 w-4 text-green-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                   className="h-4 w-4 text-gray-500 dark:text-gray-300"
                                   viewBox="0 0 20 20"
                                   fill="currentColor"
                            >
                                   <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                   <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                        )}
                        </div>
                    </button>
                )}
                {isUser && renderUploadedFiles()}
                <div className={`text-sm markdown-content ${!isUser ? "prose prose-sm dark:prose-invert max-w-none" : ""}`}>
                    <ProcessedContent />
                </div>
                
                {/* Add the context menu for code blocks */}
                {activeCodeBlock && (
                    <CodeBlockMenu
                        codeBlockRef={codeBlockRef}
                        content={activeCodeBlock.content}
                        language={activeCodeBlock.language}
                    />
                )}
            </div>
            {/* {isUser && (
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-gray-700 dark:text-gray-200 text-xs font-medium">You</span>
                </div>
            )} */}
        </div>
    );
});

// Add display name for debugging
ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
