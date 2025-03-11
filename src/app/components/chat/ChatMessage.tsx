import { Message } from "@/app/types";
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

type ChatMessageProps = {
    message: Message;
};

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(message.content)
            .then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    };

    return (
        <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
            {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs">AI</span>
                </div>
            )}
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
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                            )}
                        </div>
                    </button>
                )}
                <div className="text-sm markdown-content">
                    <ReactMarkdown
                        components={{
                            h1: ({ node, ...props }) => <h1 className="text-xl font-bold my-2" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-lg font-bold my-2" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-md font-bold my-1" {...props} />,
                            h4: ({ node, ...props }) => <h4 className="text-base font-bold my-1" {...props} />,
                            h5: ({ node, ...props }) => <h5 className="text-sm font-bold my-1" {...props} />,
                            h6: ({ node, ...props }) => <h6 className="text-xs font-bold my-1" {...props} />,
                            p: ({ node, ...props }) => <p className="my-1" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2" {...props} />,
                            li: ({ node, ...props }) => <li className="my-1" {...props} />,
                            a: ({ node, ...props }) => <a className="text-blue-400 underline" {...props} />,
                            code: ({ node, ...props }) => <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded" {...props} />,
                            pre: ({ node, ...props }) => <pre className="bg-gray-200 dark:bg-gray-700 p-2 rounded my-2 overflow-x-auto" {...props} />
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>
            </div>
            {isUser && (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-700 text-xs">You</span>
                </div>
            )}
        </div>
    );
}
