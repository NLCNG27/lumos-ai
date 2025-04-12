import { Message, ProcessedFile, GeneratedFile } from "@/app/types";
import ReactMarkdown from "react-markdown";
import React, { useState, memo, useRef, useEffect } from "react";
import Image from "next/image";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { Components } from "react-markdown";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import DownloadButton from "../ui/DownloadButton";
import CodeBlockMenu from "../ui/CodeBlockMenu";
import { isDownloadableCode, suggestFilename } from "@/app/lib/fileUtils";
import DatasetPreview from "../ui/DatasetPreview";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import GeneratedFilesList from "./GeneratedFilesList";

// Extend Components type to include our custom math handlers
interface ExtendedComponents extends Components {
    inlineMath?: (props: { value: string }) => React.ReactElement;
    math?: (props: { value: string }) => React.ReactElement;
}

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
    const [activeCodeBlock, setActiveCodeBlock] = useState<{
        content: string;
        language: string;
    } | null>(null);
    const codeBlockRef = useRef<HTMLDivElement>(null);
    const [datasets, setDatasets] = useState<
        Array<{
            content: string;
            format: string;
            filename: string;
            mimeType: string;
            fullMatch?: string;
        }>
    >([]);

    // Format timestamp in a user-friendly way
    const formatTimestamp = (timestamp: Date | string) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diff / 60000);
        const diffHours = Math.floor(diff / 3600000);
        const diffDays = Math.floor(diff / 86400000);

        // For messages less than a minute old
        if (diffMinutes < 1) {
            return 'Just now';
        }
        // For messages less than an hour old
        if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        }
        // For messages less than a day old
        if (diffHours < 24) {
            return `${diffHours}h ago`;
        }
        // For messages less than a week old
        if (diffDays < 7) {
            return `${diffDays}d ago`;
        }
        // For older messages, show the full date
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

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
                                        {file.size
                                            ? `${(file.size / 1024).toFixed(
                                                  1
                                              )} KB`
                                            : "Unknown size"}
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
        if (
            file &&
            file.type &&
            file.type.startsWith("image/") &&
            file.previewUrl
        ) {
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
        const fileExtension =
            file && file.name ? file.name.split(".").pop()?.toLowerCase() : "";

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
    const markdownComponents: ExtendedComponents = {
        h1: ({ ...props }: any) => (
            <h1 className="text-2xl font-bold my-3" {...props} />
        ),
        h2: ({ ...props }: any) => (
            <h2 className="text-xl font-bold my-3" {...props} />
        ),
        h3: ({ ...props }: any) => (
            <h3 className="text-lg font-bold my-2" {...props} />
        ),
        h4: ({ ...props }: any) => (
            <h4 className="text-base font-bold my-2" {...props} />
        ),
        h5: ({ ...props }: any) => (
            <h5 className="text-sm font-bold my-1" {...props} />
        ),
        h6: ({ ...props }: any) => (
            <h6 className="text-xs font-bold my-1" {...props} />
        ),
        p: ({ children, ...props }: any) => {
            // Check if children contains math elements from KaTeX (they use divs)
            // We need to check both for our math-block class and for KaTeX's rendered output
            const containsMath = React.Children.toArray(children).some(
                (child) => {
                    if (React.isValidElement(child)) {
                        const childProps = child.props as any;
                        // Check for our math-block class
                        if (childProps.className?.includes("math-block"))
                            return true;

                        // Check for KaTeX components which might contain divs
                        if (
                            childProps.dangerouslySetInnerHTML?.__html?.includes(
                                "katex"
                            )
                        )
                            return true;

                        // Check for BlockMath or InternalBlockMath components
                        if (
                            child.type === BlockMath ||
                            (typeof child.type === "function" &&
                                (child.type.name === "BlockMath" ||
                                    child.type.name === "InternalBlockMath"))
                        ) {
                            return true;
                        }
                    }
                    return false;
                }
            );

            // If it contains math elements that would render divs, use a div instead of p
            return containsMath ? (
                <div
                    className="my-2 leading-relaxed text-base paragraph-content"
                    {...props}
                >
                    {children}
                </div>
            ) : (
                <div className="my-2 leading-relaxed text-base" {...props}>
                    {children}
                </div>
            );
        },
        ul: ({ ...props }: any) => (
            <ul
                className="list-disc pl-5 my-3 space-y-1 text-base"
                {...props}
            />
        ),
        ol: ({ ...props }: any) => (
            <ol
                className="list-decimal pl-5 my-3 space-y-1 text-base"
                {...props}
            />
        ),
        li: ({ ...props }: any) => <li className="my-1 text-base" {...props} />,
        a: ({ ...props }: any) => (
            <a
                className="text-blue-500 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-base"
                {...props}
            />
        ),
        blockquote: ({ ...props }: any) => (
            <blockquote
                className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1 my-3 text-gray-700 dark:text-gray-300 italic text-base"
                {...props}
            />
        ),
        hr: ({ ...props }: any) => (
            <hr
                className="my-4 border-gray-300 dark:border-gray-600"
                {...props}
            />
        ),
        table: ({ ...props }: any) => (
            <div className="overflow-x-auto my-3">
                <table
                    className="min-w-full divide-y divide-gray-300 dark:divide-gray-600 border border-gray-300 dark:border-gray-600 rounded text-base"
                    {...props}
                />
            </div>
        ),
        thead: ({ ...props }: any) => (
            <thead className="bg-gray-100 dark:bg-gray-700" {...props} />
        ),
        tbody: ({ ...props }: any) => (
            <tbody
                className="divide-y divide-gray-200 dark:divide-gray-700"
                {...props}
            />
        ),
        tr: ({ ...props }: any) => (
            <tr
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                {...props}
            />
        ),
        th: ({ ...props }: any) => (
            <th
                className="px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                {...props}
            />
        ),
        td: ({ ...props }: any) => (
            <td className="px-3 py-2 whitespace-nowrap text-base" {...props} />
        ),
        code: ({ className, children, inline, ...props }: CodeProps) => {
            const match = /language-(\w+)/.exec(className || "");

            // Handle math code blocks better
            if (
                match &&
                (match[1] === "latex" ||
                    match[1] === "math" ||
                    match[1] === "tex")
            ) {
                try {
                    const mathContent = String(children)
                        .replace(/\n$/, "")
                        .trim();
                    return (
                        <span className="math-block block">
                            <BlockMath
                                math={mathContent}
                                errorColor="#ef4444"
                            />
                        </span>
                    );
                } catch (error) {
                    console.error(
                        "Error rendering LaTeX in code block:",
                        error
                    );
                    return (
                        <code
                            className="bg-red-100/10 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-base font-mono"
                            {...props}
                        >
                            <span
                                className="katex-error"
                                title="LaTeX rendering error"
                            >
                                {children}
                            </span>
                        </code>
                    );
                }
            }

            const codeContent = String(children).replace(/\n$/, "");
            const isDownloadable =
                match && isDownloadableCode(match[1], codeContent);

            return match ? (
                <div
                    ref={codeBlockRef}
                    className={`relative group ${
                        isDownloadable ? "code-block-downloadable" : ""
                    }`}
                    onContextMenu={() => {
                        if (isDownloadable) {
                            setActiveCodeBlock({
                                content: codeContent,
                                language: match[1],
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
                                onClick={() =>
                                    navigator.clipboard.writeText(codeContent)
                                }
                                title="Copy code"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-.9V8H8V5z"
                                    />
                                </svg>
                                Copy
                            </button>

                            {/* Add download button if the code is downloadable */}
                            {isDownloadable && (
                                <DownloadButton
                                    content={codeContent}
                                    language={match[1]}
                                    suggestedFilename={suggestFilename(
                                        codeContent,
                                        match[1]
                                    )}
                                    highlightAttention={
                                        codeContent.split("\n").length > 20
                                    }
                                />
                            )}
                        </div>
                    </div>

                    <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-b-md my-0 text-base"
                        showLineNumbers={true}
                        {...props}
                    >
                        {codeContent}
                    </SyntaxHighlighter>
                </div>
            ) : (
                <code
                    className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-base font-mono"
                    {...props}
                >
                    {children}
                </code>
            );
        },
        pre: ({ children }: any) => (
            <div className="overflow-hidden rounded-md my-3">{children}</div>
        ),
        inlineMath: ({ value }: { value: string }) => {
            try {
                return (
                    <span className="math-inline">
                        <InlineMath math={value} errorColor="#ef4444" />
                    </span>
                );
            } catch (error) {
                console.error("Error rendering inline LaTeX:", error);
                return (
                    <code className="bg-red-100/10 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-xs font-mono">
                        <span
                            className="katex-error"
                            title="LaTeX rendering error"
                        >
                            {value}
                        </span>
                    </code>
                );
            }
        },
        math: ({ value }: { value: string }) => {
            try {
                return (
                    <span className="math-block block">
                        <BlockMath math={value} errorColor="#ef4444" />
                    </span>
                );
            } catch (error) {
                console.error("Error rendering block LaTeX:", error);
                return (
                    <pre className="bg-red-100/10 dark:bg-red-900/30 p-3 rounded text-sm font-mono">
                        <span
                            className="katex-error"
                            title="LaTeX rendering error"
                        >
                            {value}
                        </span>
                    </pre>
                );
            }
        },
    };

    // Process the message content to extract datasets
    useEffect(() => {
        // Look for dataset markers in the message
        const datasetRegex =
            /```dataset-(?<format>[a-z]+)(?<options>\{.*?\})?\n(?<content>[\s\S]*?)```/g;

        // Reset datasets
        setDatasets([]);

        // Get the message content
        const messageContent = message.content;
        if (!messageContent) return;

        console.log(
            "Processing message for datasets, content length:",
            messageContent.length
        );

        // Find all dataset markers in the content
        let match;
        let matches = [];

        // Use a regex that captures the entire match
        const regex = new RegExp(datasetRegex);
        let content = messageContent;

        // First collect all matches
        while ((match = regex.exec(content)) !== null) {
            const {
                format,
                options,
                content: datasetContent,
            } = match.groups || {};

            if (format && datasetContent) {
                console.log(
                    `Found dataset: format=${format}, content length=${datasetContent.length}`
                );
                matches.push({
                    format,
                    options,
                    content: datasetContent,
                    fullMatch: match[0],
                });
            }
        }

        // Process the matches
        if (matches.length > 0) {
            const extractedDatasets = matches.map((match) => {
                const { format, options, content: datasetContent } = match;

                let parsedOptions = {};
                if (options) {
                    try {
                        parsedOptions = JSON.parse(options);
                    } catch (e) {
                        console.error("Failed to parse dataset options:", e);
                    }
                }

                const formatInfo: Record<
                    string,
                    { extension: string; mimeType: string }
                > = {
                    csv: { extension: "csv", mimeType: "text/csv" },
                    json: { extension: "json", mimeType: "application/json" },
                    xml: { extension: "xml", mimeType: "application/xml" },
                    yaml: { extension: "yaml", mimeType: "text/yaml" },
                    sql: { extension: "sql", mimeType: "text/plain" },
                    txt: { extension: "txt", mimeType: "text/plain" },
                    markdown: { extension: "md", mimeType: "text/markdown" },
                    html: { extension: "html", mimeType: "text/html" },
                    tsv: {
                        extension: "tsv",
                        mimeType: "text/tab-separated-values",
                    },
                };

                const { extension, mimeType } =
                    formatInfo[format] || formatInfo.txt;
                const filename = (parsedOptions as any).name
                    ? `${(parsedOptions as any).name}.${extension}`
                    : `dataset.${extension}`;

                return {
                    content: datasetContent,
                    format,
                    filename,
                    mimeType,
                    fullMatch: match.fullMatch,
                };
            });

            console.log("Extracted datasets:", extractedDatasets.length);
            setDatasets(extractedDatasets);
        }
    }, [message.content]);

    // Process the message content to extract LaTeX blocks
    const processLatexContent = (content: string | undefined): string => {
        // Return early if content is undefined or null
        if (!content) {
            return "";
        }

        // Check if content contains various LaTeX delimiters
        const hasStandardLatex =
            content.includes("\\[") ||
            content.includes("\\(") ||
            content.includes("$$") ||
            content.includes("$");

        if (!hasStandardLatex) {
            return content;
        }

        // Enhanced regex patterns for LaTeX detection
        const blockLatexRegex = /(\\\[|\$\$)([\s\S]*?)(\\\]|\$\$)/g;
        const inlineLatexRegex = /(\\\(|\$)([^\$]+?)(\\\)|\$)/g;

        let processedContent = content;

        // Replace block LaTeX with markdown code blocks for better rendering
        processedContent = processedContent.replace(
            blockLatexRegex,
            (match, open, formula, close) => {
                // Clean up the formula by trimming extra whitespace
                const cleanFormula = formula.trim();
                return "\n```math\n" + cleanFormula + "\n```\n";
            }
        );

        // Replace inline LaTeX with custom tags for inline math
        processedContent = processedContent.replace(
            inlineLatexRegex,
            (match, open, formula, close) => {
                // For single dollar signs, make sure it's actually math and not a currency symbol
                if (open === "$" && close === "$") {
                    // If the formula contains spaces and math operators, it's likely math
                    const isMath = /[a-zA-Z\\\(\)\[\]\{\}_^]/.test(formula);
                    if (!isMath) return match; // Return original if likely not math
                }

                // Clean up the formula
                const cleanFormula = formula.trim();
                return "$" + cleanFormula + "$";
            }
        );

        return processedContent;
    };

    // Define types for the parts array
    type ContentPart =
        | { type: "text"; content: string }
        | { type: "dataset"; index: number };

    // Component to render the processed content
    const ProcessedContent = () => {
        // Process the content for LaTeX expressions
        const processedContent = processLatexContent(message.content);

        // If the message contains datasets, handle them separately
        if (datasets.length > 0) {
            // The rest of dataset handling logic remains the same
            const parts: ContentPart[] = [];
            let lastIndex = 0;

            // Process each dataset placeholder
            datasets.forEach((dataset, index) => {
                const placeholderStart = processedContent.indexOf(
                    dataset.fullMatch || "",
                    lastIndex
                );
                if (placeholderStart !== -1) {
                    // Add text content before the dataset
                    if (placeholderStart > lastIndex) {
                        parts.push({
                            type: "text",
                            content: processedContent.substring(
                                lastIndex,
                                placeholderStart
                            ),
                        });
                    }
                    // Add the dataset
                    parts.push({ type: "dataset", index });
                    lastIndex =
                        placeholderStart + (dataset.fullMatch?.length || 0);
                }
            });

            // Add any remaining text
            if (lastIndex < processedContent.length) {
                parts.push({
                    type: "text",
                    content: processedContent.substring(lastIndex),
                });
            }

            // Render the parts
            return (
                <>
                    {parts.map((part, index) => {
                        if (part.type === "text") {
                            return part.content?.trim() ? (
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
                        } else if (part.type === "dataset") {
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

        // Render content normally
        return (
            <ReactMarkdown
                components={markdownComponents}
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
            >
                {processedContent}
            </ReactMarkdown>
        );
    };

    // Render generated files from code execution
    const renderGeneratedFiles = () => {
        if (!message.generatedFiles || message.generatedFiles.length === 0)
            return null;

        return <GeneratedFilesList files={message.generatedFiles} />;
    };

    return (
        <div className={`flex w-full ${isUser ? 'justify-start' : 'justify-start'} mb-4`}>
            <div className={`relative flex-1 px-4`}>
                <div className={`message-bubble ${isUser ? 'user-message bg-indigo-700/30 border border-indigo-500/30' : 'ai-message bg-gray-800/70 border border-gray-600/30'} rounded-lg p-4 text-sm w-full backdrop-blur-sm shadow-sm`}>
                    {renderUploadedFiles()}

                    <div ref={codeBlockRef} className="markdown-content">
                        <ReactMarkdown
                            components={markdownComponents}
                            remarkPlugins={[remarkGfm, remarkMath]} 
                            rehypePlugins={[rehypeKatex]}
                        >
                            {processLatexContent(message.content)}
                        </ReactMarkdown>
                    </div>

                    {/* Show grounding sources if available */}
                    {message.groundingSources &&
                        message.groundingSources.length > 0 && (
                            <div className="mt-3 border-t border-gray-700 pt-3">
                                <div className="text-sm font-medium mb-2 text-blue-300">
                                    Sources:
                                </div>
                                <div className="space-y-2">
                                    {message.groundingSources.map(
                                        (source, index) => (
                                            <div
                                                key={index}
                                                className="text-xs bg-gray-900 rounded p-2"
                                            >
                                                <a
                                                    href={source.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-medium text-blue-400 hover:underline block mb-1"
                                                >
                                                    {source.title}
                                                </a>
                                                <div className="text-gray-300">
                                                    {source.snippet}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                    {/* Show generated files if available */}
                    {renderGeneratedFiles()}

                    {/* Show dataset previews */}
                    {datasets.length > 0 && (
                        <div className="mt-3">
                            {datasets.map((dataset, index) => (
                                <DatasetPreview
                                    key={index}
                                    content={dataset.content}
                                    format={dataset.format}
                                    filename={dataset.filename}
                                    mimeType={dataset.mimeType}
                                />
                            ))}
                        </div>
                    )}

                    {/* Show code block menu if active */}
                    {activeCodeBlock && (
                        <CodeBlockMenu
                            content={activeCodeBlock.content}
                            language={activeCodeBlock.language}
                            codeBlockRef={codeBlockRef}
                        />
                    )}
                    
                    {/* Timestamp moved to the bottom */}
                    <div className="text-xs text-gray-400 mt-2">
                        {message.timestamp ? formatTimestamp(message.timestamp) : ''}
                    </div>
                </div>
            </div>
        </div>
    );
});

// Add display name for debugging
ChatMessage.displayName = "ChatMessage";

export default ChatMessage;
