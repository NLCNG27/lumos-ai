import { useState, useCallback, useEffect } from "react";
import {
    Message,
    UploadedFile,
    ProcessedFile,
    Conversation,
} from "@/app/types";

// Define a custom event for real-time conversation updates
export const CONVERSATION_UPDATED_EVENT = "conversation-updated";

// Helper function to dispatch conversation updated event
export function dispatchConversationUpdate(conversationId: string) {
    const event = new CustomEvent(CONVERSATION_UPDATED_EVENT, {
        detail: {
            conversationId,
            timestamp: new Date().toISOString(),
            isTyping: conversationId === "typing",
        },
    });
    window.dispatchEvent(event);
}

interface UseChatProps {
    initialConversationId?: string;
}

export function useChat({ initialConversationId }: UseChatProps = {}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentConversation, setCurrentConversation] =
        useState<Conversation | null>(null);

    // Create a new conversation
    const createNewConversation = useCallback(async () => {
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
    }, []);

    // Load an existing conversation and its messages
    const loadConversation = useCallback(async (conversationId: string, silentRecovery = false) => {
        // Don't try to load if no ID is provided
        if (!conversationId) {
            console.log("No conversation ID provided, skipping load");
            return;
        }
        
        setIsLoading(true);
        try {
            // Fetch conversation details
            const conversationResponse = await fetch(`/api/conversations/${conversationId}`);
            
            if (!conversationResponse.ok) {
                // Handle different error types based on status code
                if (conversationResponse.status === 404) {
                    if (silentRecovery) {
                        console.log("Silent recovery: Conversation not found, creating new conversation");
                        await createNewConversation();
                        return; // Exit without throwing error
                    }
                    throw new Error("Conversation not found");
                } else if (conversationResponse.status === 403) {
                    throw new Error("You don't have permission to access this conversation");
                } else {
                    throw new Error(`Error loading conversation: ${conversationResponse.status}`);
                }
            }
            
            // Try to parse the response
            let conversationData;
            try {
                conversationData = await conversationResponse.json();
            } catch (parseError) {
                console.error("Failed to parse conversation response:", parseError);
                if (silentRecovery) {
                    console.log("Silent recovery: Invalid response, creating new conversation");
                    await createNewConversation();
                    return; // Exit without throwing error
                }
                throw new Error("Invalid response from server");
            }
            
            // Validate conversation data
            if (!conversationData || !conversationData.conversation) {
                console.error("Invalid conversation data:", conversationData);
                if (silentRecovery) {
                    console.log("Silent recovery: Invalid conversation data, creating new conversation");
                    await createNewConversation();
                    return; // Exit without throwing error
                }
                throw new Error("Invalid conversation data received");
            }
            
            setCurrentConversation(conversationData.conversation);

            // Fetch conversation messages
            try {
                const messagesResponse = await fetch(`/api/conversations/${conversationId}/messages`);
                if (!messagesResponse.ok) {
                    console.error(`Error loading messages: ${messagesResponse.status}`);
                    // Continue even if messages can't be loaded
                    setMessages([]);
                } else {
                    const messagesData = await messagesResponse.json();
                    setMessages(messagesData.messages || []);
                }
            } catch (messagesError) {
                console.error("Error fetching messages:", messagesError);
                // Don't fail the entire operation if we can't load messages
                setMessages([]);
            }
        } catch (err) {
            console.error("Error loading conversation:", err);
            // In silent recovery mode, don't rethrow errors - create a new conversation instead
            if (silentRecovery) {
                console.log("Silent recovery: Error occurred, creating new conversation");
                setError(null); // Clear any existing errors
                await createNewConversation();
                return;
            }
            // Rethrow the error so the caller can handle it
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load an existing conversation or create a new one
    useEffect(() => {
        const initializeConversation = async () => {
            try {
                setIsLoading(true);
                
                if (initialConversationId) {
                    try {
                        // Load the specified conversation with silent recovery enabled
                        await loadConversation(initialConversationId, true);
                    } catch (err) {
                        console.error("Failed to load initial conversation:", err);
                        // If we still get here despite silent recovery, create a new conversation
                        await createNewConversation();
                    }
                } else {
                    // Check if user has existing conversations
                    const response = await fetch("/api/conversations");
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    const existingConversations = data.conversations || [];
                    
                    if (existingConversations.length > 0) {
                        try {
                            // Load the most recent conversation with silent recovery enabled
                            const mostRecentConversation = existingConversations[0]; // API returns conversations sorted by last_message_at desc
                            await loadConversation(mostRecentConversation.id, true);
                        } catch (err) {
                            console.error("Failed to load most recent conversation:", err);
                            // If we still get here despite silent recovery, create a new conversation
                            await createNewConversation();
                        }
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
                // Ensure we at least try to create a new conversation
                await createNewConversation().catch(e => {
                    console.error("Critical error: Failed to create new conversation:", e);
                });
            } finally {
                setIsLoading(false);
            }
        };

        initializeConversation();
    }, [initialConversationId, loadConversation, createNewConversation]);

    // Save message to the conversation in Supabase
    const saveMessageToConversation = async (message: Message) => {
        if (!currentConversation) return;

        try {
            // Ensure files are properly formatted before sending
            const sanitizedFiles =
                message.files?.map((file) => ({
                    id: file.id || "",
                    name: file.name || "Unknown file",
                    type: file.type || "application/octet-stream",
                    size: file.size || 0,
                    previewUrl: file.previewUrl || null,
                })) || undefined;

            await fetch(
                `/api/conversations/${currentConversation.id}/messages`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: message.content,
                        role: message.role,
                        files: sanitizedFiles,
                    }),
                }
            );
        } catch (err) {
            console.error("Error saving message to conversation:", err);
        }
    };

    // Generate a conversation title using AI
    const generateConversationTitle = async (conversationId: string) => {
        if (!conversationId) return;

        try {
            const response = await fetch(
                `/api/conversations/${conversationId}/generate-title`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                }
            );

            if (!response.ok) {
                console.error(`Error generating title: ${response.status}`);
                return;
            }

            const data = await response.json();

            // Update local state with the new title
            if (
                data.title &&
                currentConversation &&
                currentConversation.id === conversationId
            ) {
                setCurrentConversation((prev) =>
                    prev ? { ...prev, title: data.title } : null
                );
            }

            return data.title;
        } catch (err) {
            console.error("Error generating conversation title:", err);
        }
    };

    // Update conversation title based on first user message
    const updateConversationTitle = async (content: string) => {
        if (!currentConversation) return;

        try {
            // For the first message, generate a simple title from the content
            if (messages.length === 0) {
                // Generate a title from the first few words of the message
                const title =
                    content.split(" ").slice(0, 5).join(" ") +
                    (content.length > 30 ? "..." : "");

                await fetch(`/api/conversations/${currentConversation.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title }),
                });

                // Update local state
                setCurrentConversation((prev) =>
                    prev ? { ...prev, title } : null
                );

                // If it's the first message, we'll also attempt an AI-generated title after saving
                // this initial title as a fallback
                setTimeout(() => {
                    generateConversationTitle(currentConversation.id);
                }, 500);
            }
            // For later messages, only generate AI titles after certain intervals
            // to avoid excessive API calls
            else if (messages.length === 3 || messages.length % 10 === 0) {
                // Only generate new titles periodically to avoid too many API calls
                generateConversationTitle(currentConversation.id);
            }
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
                files
                    ?.filter((file) => file && file.file) // Filter out invalid files
                    .map((file) => ({
                        id: file.id || Date.now().toString(),
                        name: file.file.name || "Unknown file",
                        type: file.file.type || "application/octet-stream",
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
                // Update conversation title based on the message
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
                    files
                        ?.filter((file) => file && file.file) // Filter out invalid files
                        .map(async (file) => {
                            try {
                                return {
                                    id: file.id || Date.now().toString(),
                                    name: file.file.name || "Unknown file",
                                    type:
                                        file.file.type ||
                                        "application/octet-stream",
                                    size: file.file.size || 0,
                                    content: await fileToBase64(file.file),
                                };
                            } catch (error) {
                                console.error("Error processing file:", error);
                                return null;
                            }
                        }) || []
                ).then((results) => results.filter(Boolean)); // Filter out nulls from failed conversions

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

                // Dispatch an event to notify that a conversation has been updated
                dispatchConversationUpdate(currentConversation.id);
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
                    if (typeof reader.result === "string") {
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
        loadConversation,
        createNewConversation,
        generateConversationTitle,
    };
}
