import { useState, useCallback, useEffect } from "react";
import { Message, UploadedFile, ProcessedFile, Conversation } from "@/app/types";

interface UseChatProps {
  initialConversationId?: string;
}

export function useChat({ initialConversationId }: UseChatProps = {}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

    // Load an existing conversation or create a new one
    useEffect(() => {
        const initializeConversation = async () => {
            try {
                setIsLoading(true);
                
                if (initialConversationId) {
                    // Load the specified conversation
                    await loadConversation(initialConversationId);
                } else {
                    // Check if user has existing conversations
                    const response = await fetch("/api/conversations");
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    const existingConversations = data.conversations || [];
                    
                    if (existingConversations.length > 0) {
                        // Load the most recent conversation
                        const mostRecentConversation = existingConversations[0]; // API returns conversations sorted by last_message_at desc
                        await loadConversation(mostRecentConversation.id);
                    } else {
                        // Create a new conversation only if user has no conversations
                        await createNewConversation();
                    }
                }
            } catch (err) {
                console.error("Error initializing conversation:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to initialize conversation"
                );
            } finally {
                setIsLoading(false);
            }
        };

        initializeConversation();
    }, [initialConversationId]);

    // Load an existing conversation and its messages
    const loadConversation = async (conversationId: string) => {
        setIsLoading(true);
        try {
            // Fetch conversation details
            const conversationResponse = await fetch(`/api/conversations/${conversationId}`);
            
            if (!conversationResponse.ok) {
                console.error(`Error loading conversation: ${conversationResponse.status}`);
                
                // If conversation not found, create a new one instead
                if (conversationResponse.status === 404) {
                    console.log("Conversation not found, creating a new one");
                    await createNewConversation();
                    return;
                }
                
                throw new Error(`Error: ${conversationResponse.status}`);
            }
            
            const conversationData = await conversationResponse.json();
            setCurrentConversation(conversationData.conversation);

            // Fetch conversation messages
            const messagesResponse = await fetch(`/api/conversations/${conversationId}/messages`);
            if (!messagesResponse.ok) {
                console.error(`Error loading messages: ${messagesResponse.status}`);
                // Continue even if messages can't be loaded
                setMessages([]);
            } else {
                const messagesData = await messagesResponse.json();
                setMessages(messagesData.messages || []);
            }
        } catch (err) {
            console.error("Error loading conversation:", err);
            // If there's an error loading the conversation, create a new one
            await createNewConversation();
        } finally {
            setIsLoading(false);
        }
    };

    // Create a new conversation
    const createNewConversation = async () => {
        setIsLoading(true);
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
            setMessages([]);
        } catch (err) {
            console.error("Error creating conversation:", err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    // Save message to the conversation in Supabase
    const saveMessageToConversation = async (message: Message) => {
        if (!currentConversation) return;

        try {
            // Ensure files are properly formatted before sending
            const sanitizedFiles = message.files?.map(file => ({
                id: file.id || '',
                name: file.name || 'Unknown file',
                type: file.type || 'application/octet-stream',
                size: file.size || 0,
                previewUrl: file.previewUrl || null
            })) || undefined;

            await fetch(`/api/conversations/${currentConversation.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: message.content,
                    role: message.role,
                    files: sanitizedFiles
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

            // Update local state
            setCurrentConversation(prev => 
                prev ? { ...prev, title } : null
            );
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

            // Transform uploadedFiles to match our type, with validation
            const processedFiles: ProcessedFile[] =
                files?.filter(file => file && file.file)  // Filter out invalid files
                    .map((file) => ({
                        id: file.id || Date.now().toString(),
                        name: file.file.name || 'Unknown file',
                        type: file.file.type || 'application/octet-stream',
                        size: file.file.size || 0,
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

                // Convert files to base64 for sending to API, with validation
                const fileData = await Promise.all(
                    files?.filter(file => file && file.file)  // Filter out invalid files
                        .map(async (file) => {
                            try {
                                return {
                                    id: file.id || Date.now().toString(),
                                    name: file.file.name || 'Unknown file',
                                    type: file.file.type || 'application/octet-stream',
                                    size: file.file.size || 0,
                                    content: await fileToBase64(file.file),
                                };
                            } catch (error) {
                                console.error("Error processing file:", error);
                                return null;
                            }
                        }) || []
                ).then(results => results.filter(Boolean)); // Filter out nulls from failed conversions

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
            if (!file) {
                reject(new Error("Invalid file"));
                return;
            }
            
            try {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    if (typeof reader.result === 'string') {
                        resolve(reader.result);
                    } else {
                        reject(new Error("Failed to convert file to base64"));
                    }
                };
                reader.onerror = (error) => reject(error);
            } catch (error) {
                reject(error);
            }
        });
    };

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        currentConversation,
        loadConversation
    };
}
