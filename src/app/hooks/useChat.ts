import { useState, useCallback } from "react";
import { Message, UploadedFile, ProcessedFile } from "@/app/types";

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = useCallback(
        async (content: string, files?: UploadedFile[]) => {
            if (!content.trim() && (!files || files.length === 0)) return;

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

                // Add AI response to messages
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        content: aiMessage.content,
                        role: "assistant",
                        timestamp: new Date(),
                    },
                ]);
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
        [messages]
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
    };
}
