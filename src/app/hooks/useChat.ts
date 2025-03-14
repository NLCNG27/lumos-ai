import { useState, useCallback, useEffect } from "react";
import { Message, UploadedFile, ProcessedFile, Conversation } from "@/app/types";

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

    // Create a new conversation when the component mounts
    useEffect(() => {
        const createNewConversation = async () => {
            try {
                const response = await fetch("/api/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: "New Conversation" }),
                });

                if (!response.ok) {
                    throw new Error("Failed to create conversation");
                }

                const data = await response.json();
                setCurrentConversation(data.conversation);
            } catch (err) {
                console.error("Error creating conversation:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to create conversation"
                );
            }
        };

        createNewConversation();
    }, []);

    // Save message to the conversation in Supabase
    const saveMessageToConversation = async (message: Message) => {
        if (!currentConversation) return;

        try {
            await fetch(`/api/conversations/${currentConversation.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: message.content,
                    role: message.role,
                    files: message.files
                }),
            });
        } catch (err) {
            console.error("Error saving message to conversation:", err);
        }
    };

    // Update conversation title based on first user message
    const updateConversationTitle = async (content: string) => {
        if (!currentConversation || messages.length > 0) return;

        // Only update title for the first message
        try {
            // Generate a title from the first few words of the message
            const title = content.split(' ').slice(0, 5).join(' ') + (content.length > 30 ? '...' : '');
            
            await fetch(`/api/conversations/${currentConversation.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
        } catch (err) {
            console.error("Error updating conversation title:", err);
        }
    };

    const sendMessage = useCallback(
        async (content: string, files?: UploadedFile[]) => {
            if (!content.trim() && (!files || files.length === 0)) return;
            if (!currentConversation) {
                setError("No active conversation. Please refresh the page.");
                return;
            }

            // Transform uploadedFiles to match our type
            const processedFiles: ProcessedFile[] =
                files?.map((file) => ({
                    id: file.id,
                    name: file.file.name,
                    type: file.file.type,
                    size: file.file.size,
                    previewUrl: file.previewUrl,
                })) || [];

            // Create new user message
            const userMessage: Message = {
                id: Date.now().toString(),
                content,
                role: "user",
                timestamp: new Date(),
                files: processedFiles.length > 0 ? processedFiles : undefined,
            };

            setMessages((prev) => [...prev, userMessage]);
            setIsLoading(true);
            setError(null);

            try {
                // Update conversation title based on first message
                await updateConversationTitle(content);

                // Save user message to conversation
                await saveMessageToConversation(userMessage);

                // Prepare messages for API
                const apiMessages = messages
                    .concat(userMessage)
                    .map(({ content, role }) => ({
                        content,
                        role,
                    }));

                // Convert files to base64 for sending to API
                const fileData = await Promise.all(
                    files?.map(async (file) => {
                        return {
                            id: file.id,
                            name: file.file.name,
                            type: file.file.type,
                            size: file.file.size,
                            content: await fileToBase64(file.file),
                        };
                    }) || []
                );

                const response = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: apiMessages,
                        files: fileData.length > 0 ? fileData : undefined,
                    }),
                });

                if (!response.ok) {
                    throw new Error("Failed to get response");
                }

                const aiMessage = await response.json();

                // Create AI message object
                const assistantMessage: Message = {
                    id: Date.now().toString(),
                    content: aiMessage.content,
                    role: "assistant",
                    timestamp: new Date(),
                };

                // Add AI response to messages
                setMessages((prev) => [...prev, assistantMessage]);

                // Save AI message to conversation
                await saveMessageToConversation(assistantMessage);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "An unknown error occurred"
                );
            } finally {
                setIsLoading(false);
            }
        },
        [messages, currentConversation]
    );

    // Helper function to convert a file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        currentConversation
    };
}
