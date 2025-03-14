import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useChat } from "@/app/hooks/useChat";
import Link from "next/link";

export default function ChatWindow() {
    const { messages, isLoading, error, sendMessage, currentConversation } = useChat();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="flex flex-col h-[80vh] bg-black dark:bg-black rounded-lg shadow-lg">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">
                    {currentConversation ? currentConversation.title : "Lumos AI Assistant"}
                </h2>
                <Link 
                    href="/test-conversations" 
                    className="text-blue-400 hover:text-blue-300 text-sm"
                >
                    View All Conversations
                </Link>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                        <p>
                            👋 Hello! I&apos;m Lumos AI. How can I help you
                            today?
                        </p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <ChatMessage key={message.id} message={message} />
                    ))
                )}

                {error && (
                    <div className="p-2 bg-red-900 text-red-100 rounded-lg text-sm">
                        Error: {error}
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center text-gray-500">
                        <div className="dot-flashing mr-2"></div>
                        <p>Lumos is thinking...</p>
                    </div>
                )}

                <div ref={messagesEndRef} /> 
            </div>

            <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
        </div>
    );
}
