import { useEffect, useRef, memo, useMemo, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useChat, dispatchConversationUpdate } from "@/app/hooks/useChat";
import Link from "next/link";
import LoadingDots from "../ui/LoadingDots";

interface ChatWindowProps {
  initialConversationId?: string;
}

// Create a memoized message component to prevent unnecessary re-renders
const MemoizedChatMessage = memo(ChatMessage);
MemoizedChatMessage.displayName = 'MemoizedChatMessage';

export default function ChatWindow({ initialConversationId }: ChatWindowProps) {
    const { messages, isLoading, error, sendMessage, currentConversation, createNewConversation } = useChat({
        initialConversationId
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [showRecoveryButton, setShowRecoveryButton] = useState(false);
    const [recoveryInProgress, setRecoveryInProgress] = useState(false);
    const prevConversationIdRef = useRef<string | undefined>(initialConversationId);
    
    // Handle recovery from errors silently when possible
    useEffect(() => {
        if (error?.includes("Conversation not found") || error?.includes("404")) {
            // Don't show the recovery button immediately - try silent recovery first
            setRecoveryInProgress(true);
            
            // Create a new conversation silently
            createNewConversation()
                .then(() => {
                    setRecoveryInProgress(false);
                    // Clear the error state since we've recovered
                })
                .catch(err => {
                    console.error("Failed to auto-recover with new conversation:", err);
                    setRecoveryInProgress(false);
                    // Only show recovery button if auto-recovery failed
                    setShowRecoveryButton(true);
                });
        } else if (!error) {
            setShowRecoveryButton(false);
            setRecoveryInProgress(false);
        }
    }, [error, createNewConversation]);
    
    // Detect when conversation ID is cleared (like when deleting all conversations)
    useEffect(() => {
        // If we had a conversation ID before but now it's gone, we need to reset
        if (prevConversationIdRef.current && !initialConversationId) {
            console.log("Conversation ID cleared, checking for existing conversations");
            setRecoveryInProgress(true);
            
            // First check if there are already existing conversations
            fetch('/api/conversations?include_archived=false')
                .then(response => {
                    if (!response.ok) throw new Error(`Error: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    // If there are already conversations, don't create a new one
                    if (data.conversations && data.conversations.length > 0) {
                        console.log("Found existing conversations, not creating a new one:", 
                            data.conversations.length);
                        setRecoveryInProgress(false);
                    } else {
                        // Only create a new conversation if none exist
                        console.log("No existing conversations found, creating a new one");
                        return createNewConversation();
                    }
                })
                .then(() => {
                    setRecoveryInProgress(false);
                })
                .catch(err => {
                    console.error("Failed to recover after ID cleared:", err);
                    setRecoveryInProgress(false);
                    // Only show recovery button if auto-recovery failed
                    setShowRecoveryButton(true);
                });
        }
        
        // Update the ref to track changes
        prevConversationIdRef.current = initialConversationId;
    }, [initialConversationId, createNewConversation]);

    // Handle recovery action for manual button
    const handleRecovery = async () => {
        try {
            setRecoveryInProgress(true);
            
            // First check if there are already existing conversations
            const response = await fetch('/api/conversations?include_archived=false');
            if (!response.ok) throw new Error(`Error: ${response.status}`);
            const data = await response.json();
            
            // If there are already conversations, don't create a new one
            if (data.conversations && data.conversations.length > 0) {
                console.log("Found existing conversations, not creating a new one:", 
                    data.conversations.length);
                // Select the first conversation
                if (data.conversations[0].id) {
                    window.location.href = `/?conversation=${data.conversations[0].id}`;
                    return;
                }
            } else {
                // Only create a new conversation if none exist
                console.log("No existing conversations found, creating a new one");
                await createNewConversation();
            }
            
            setShowRecoveryButton(false);
        } catch (err) {
            console.error("Failed to recover with new conversation:", err);
        } finally {
            setRecoveryInProgress(false);
        }
    };

    // Scroll to bottom when messages change or when loading state changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        
        // If we have messages and a current conversation, dispatch an update event
        if (messages.length > 0 && currentConversation) {
            dispatchConversationUpdate(currentConversation.id);
        }
    }, [messages, currentConversation, isLoading]);
    
    // Automatically scroll to bottom when typing indicator appears
    useEffect(() => {
        if (isLoading && currentConversation && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [isLoading, currentConversation, messages.length]);

    // Only render visible messages for better performance
    // This is a simple virtualization approach - for very large conversations,
    // consider using a library like react-window or react-virtualized
    const visibleMessages = useMemo(() => {
        // For small message lists, render all messages
        if (messages.length < 50) return messages;
        
        // For large message lists, only render the last 50 messages
        return messages.slice(Math.max(0, messages.length - 50));
    }, [messages]);

    // Instead of showing error messages to the user, show a loading or welcome state
    const showWelcomeState = !currentConversation && !isLoading && !recoveryInProgress;
    const showLoadingOverlay = !currentConversation && (isLoading || recoveryInProgress);
    
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
                {/* Show loading overlay only when no conversation exists yet */}
                {showLoadingOverlay ? (
                    <div className="text-center text-gray-500 mt-20">
                        <div>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                            <p>Preparing your chat...</p>
                        </div>
                    </div>
                ) : messages.length === 0 || showWelcomeState ? (
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

                {/* Only show error with recovery button when silent recovery has failed */}
                {error && showRecoveryButton && (
                    <div className="p-3 bg-red-900/70 text-red-100 rounded-lg text-sm border border-red-800 animate-fadeIn">
                        <p className="font-medium mb-1">Something went wrong</p>
                        <p>We encountered an issue loading your conversation.</p>
                        <button 
                            onClick={handleRecovery}
                            className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                            disabled={recoveryInProgress}
                        >
                            {recoveryInProgress ? (
                                <span className="flex items-center">
                                    <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full mr-2"></span>
                                    Creating new chat...
                                </span>
                            ) : (
                                'Start a new conversation'
                            )}
                        </button>
                    </div>
                )}

                {/* Show thinking indicator at the bottom during active chat */}
                {isLoading && currentConversation && messages.length > 0 && (
                    <div className="flex items-center justify-start p-3 animate-fadeIn">
                        <div className="text-blue-400 flex items-center">
                            <span className="mr-2">Thinking</span>
                            <span className="flex space-x-1">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} /> 
            </div>

            <div className="bg-gray-950 border-t border-gray-800 p-2 rounded-b-lg">
                <ChatInput onSendMessage={sendMessage} isLoading={isLoading || recoveryInProgress} />
            </div>
        </div>
    );
}
