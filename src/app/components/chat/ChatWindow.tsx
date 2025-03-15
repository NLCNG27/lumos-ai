import { useEffect, useRef, memo, useMemo } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useChat } from "@/app/hooks/useChat";
import Link from "next/link";

interface ChatWindowProps {
  initialConversationId?: string;
}

// Create a memoized message component to prevent unnecessary re-renders
const MemoizedChatMessage = memo(ChatMessage);
MemoizedChatMessage.displayName = 'MemoizedChatMessage';

export default function ChatWindow({ initialConversationId }: ChatWindowProps) {
    const { messages, isLoading, error, sendMessage, currentConversation } = useChat({
        initialConversationId
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Only render visible messages for better performance
    // This is a simple virtualization approach - for very large conversations,
    // consider using a library like react-window or react-virtualized
    const visibleMessages = useMemo(() => {
        // For small message lists, render all messages
        if (messages.length < 50) return messages;
        
        // For large message lists, only render the last 50 messages
        return messages.slice(Math.max(0, messages.length - 50));
    }, [messages]);

    return (
        <div className="flex flex-col h-full bg-black dark:bg-black rounded-lg shadow-lg">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white">
                    {currentConversation ? currentConversation.title : "Lumos AI Assistant"}
                </h2>
                
                {/* Show message count if we're not showing all messages */}
                {messages.length > 50 && (
                    <div className="text-xs text-gray-400">
                        Showing last 50 of {messages.length} messages
                    </div>
                )}
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-gradient-to-b from-gray-950 to-black">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                        <p>
                            👋 Hello! I&apos;m Lumos AI. How can I help you
                            today?
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {visibleMessages.map((message) => (
                            <div key={message.id} className="message-item animate-fadeIn">
                                <MemoizedChatMessage message={message} />
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-900/70 text-red-100 rounded-lg text-sm border border-red-800 animate-fadeIn">
                        <p className="font-medium mb-1">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center text-gray-400 p-3 animate-fadeIn">
                        <div className="dot-flashing mr-3"></div>
                        <p>Lumos is thinking...</p>
                    </div>
                )}

                <div ref={messagesEndRef} /> 
            </div>

            <div className="bg-gray-950 border-t border-gray-800 p-2 rounded-b-lg">
                <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
            </div>
        </div>
    );
}
