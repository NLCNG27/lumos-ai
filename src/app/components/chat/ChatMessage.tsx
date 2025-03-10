import { Message } from "@/app/types";
import ReactMarkdown from 'react-markdown';

type ChatMessageProps = {
    message: Message;
};

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";

    return (
        <div
            className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
        >
            {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs">AI</span>
                </div>
            )}
            <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    isUser
                        ? "bg-blue-500 text-white rounded-tr-none"
                        : "bg-gray-100 dark:bg-gray-800 rounded-tl-none"
                }`}
            >
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
