import { useState, useCallback } from 'react';
import { Message } from '@/app/types';

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim()) return;

        // Create new user message
        const userMessage: Message = {
            id: Date.now().toString(),
            content,
            role: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);
        setError(null);

        try {
            // Prepare messages for API
            const apiMessages = messages.concat(userMessage).map(({ content, role }) => ({
                content,
                role,
            }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const aiMessage = await response.json();

            // Add AI response to messages
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    content: aiMessage.content,
                    role: 'assistant',
                    timestamp: new Date(),
                },
            ]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [messages]);

    return {
        messages,
        isLoading,
        error,
        sendMessage,
    };
}