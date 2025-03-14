import { Message, ProcessedFile } from "@/app/types";
import ReactMarkdown from "react-markdown";
import { useState } from "react";
import Image from "next/image";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { Components } from 'react-markdown';

type ChatMessageProps = {
    message: Message;
};

// Define our own CodeProps type
interface CodeProps {
    node?: any;
    inline?: boolean;
    className?: string;
    children: React.ReactNode;
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const [isCopied, setIsCopied] = useState(false);

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

    return (
        <div
            className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
        >
            {/* {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs">AI</span>
                </div>
            )} */}
            <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl relative group ${
                    isUser
                        ? "bg-blue-500 text-white rounded-tr-none"
                        : "bg-gray-100 dark:bg-gray-800 rounded-tl-none"
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
                <div className="text-sm markdown-content">
                    <ReactMarkdown
                        components={{
                            h1: ({...props}: any) => <h1 className="text-xl font-bold my-2" {...props} />,
                            h2: ({...props}: any) => <h2 className="text-lg font-bold my-2" {...props} />,
                            h3: ({...props}: any) => <h3 className="text-md font-bold my-1" {...props} />,
                            h4: ({...props}: any) => <h4 className="text-base font-bold my-1" {...props} />,
                            h5: ({...props}: any) => <h5 className="text-sm font-bold my-1" {...props} />,
                            h6: ({...props}: any) => <h6 className="text-xs font-bold my-1" {...props} />,
                            p: ({...props}: any) => <p className="my-1" {...props} />,
                            ul: ({ordered, ...props}: any) => <ul className="list-disc pl-5 my-2" {...props} />,
                            ol: ({ordered, ...props}: any) => <ol className="list-decimal pl-5 my-2" {...props} />,
                            li: ({ordered, ...props}: any) => <li className="my-1" {...props} />,
                            a: ({...props}: any) => <a className="text-blue-400 underline" {...props} />,
                            code: ({ className, children, inline, ...props }: CodeProps) => {
                                const match = /language-(\w+)/.exec(className || '');
                                return match ? (
                                    <SyntaxHighlighter
                                        style={vscDarkPlus as any}
                                        language={match[1]}
                                        PreTag="div"
                                        className="rounded-md my-2"
                                        showLineNumbers={true}
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code
                                        className="bg-gray-200 dark:bg-gray-700 px-1 rounded"
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                );
                            },
                            pre: ({children}: any) => <div className="overflow-hidden rounded-md my-2">{children}</div>,
                        } as Components}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>
            </div>
            {/* {isUser && (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-700 text-xs">You</span>
                </div>
            )} */}
        </div>
    );
}
