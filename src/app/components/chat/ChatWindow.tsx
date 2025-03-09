import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { useChat } from '@/app/hooks/useChat';

export default function ChatWindow() {
    const { messages, isLoading, error, sendMessage } = useChat();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col h-[80vh] bg-white dark:bg-gray-900 rounded-lg shadow-lg">
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Lumos AI Assistant</h2>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                        <p>👋 Hello! I'm Lumos AI. How can I help you today?</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <ChatMessage key={message.id} message={message} />
                    ))
                )}

                {error && (
                    <div className="p-2 bg-red-100 text-red-700 rounded-lg text-sm">
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