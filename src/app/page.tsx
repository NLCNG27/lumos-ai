"use client";

import ChatWindow from "@/app/components/chat/ChatWindow";
import ConversationSidebar from "@/app/components/chat/ConversationSidebar";
import MainMenu from "@/app/components/MainMenu";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CONVERSATION_UPDATED_EVENT } from "@/app/hooks/useChat";
import Navbar from "@/app/components/Navbar";

// Component that uses useSearchParams
function ChatContent({ sidebarOpen }: { sidebarOpen: boolean }) {
    const searchParams = useSearchParams();
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [hasActiveConversation, setHasActiveConversation] = useState<boolean>(false);
    const [isRecovering, setIsRecovering] = useState<boolean>(false);

    // Get conversation ID from URL if present
    useEffect(() => {
        const urlConversationId = searchParams.get("conversation");
        if (urlConversationId) {
            setConversationId(urlConversationId);
            setHasActiveConversation(true);
        }
    }, [searchParams]);

    // Monitor for active conversations
    useEffect(() => {
        if (conversationId) {
            setHasActiveConversation(true);
        }
    }, [conversationId]);

    // Handle selecting a conversation
    const handleSelectConversation = (id: string) => {
        // Track if we're in recovery mode (switching from an error state)
        const wasRecovering = !conversationId && id;
        if (wasRecovering) {
            setIsRecovering(true);
            // Clear recovery state after a short delay
            setTimeout(() => setIsRecovering(false), 1000);
        }
        
        // If ID is empty, clear the current conversation
        if (!id || id.trim() === "") {
            setConversationId(null);
            setHasActiveConversation(false);
            // Update URL to remove conversation parameter
            const url = new URL(window.location.href);
            url.searchParams.delete("conversation");
            window.history.pushState({}, "", url);
            return;
        }
        
        // Update URL with the conversation ID
        const url = new URL(window.location.href);
        url.searchParams.set("conversation", id);
        window.history.pushState({}, "", url);
        
        // Update state
        setConversationId(id);
        setHasActiveConversation(true);
    };

    return (
        <>
            <SignedIn>
                {/* Main chat container */}
                <div className="flex w-full h-full">
                    {/* Sidebar for conversations */}
                    <div className={`${sidebarOpen ? 'w-64' : 'w-0'} md:w-72 flex-shrink-0 transition-all duration-300 h-full overflow-hidden`}>
                        <ConversationSidebar 
                            currentConversationId={conversationId} 
                            onSelectConversation={handleSelectConversation} 
                        />
                    </div>

                    {/* Main chat area */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        <ChatWindow initialConversationId={conversationId || undefined} />
                    </div>
                </div>
            </SignedIn>

            <SignedOut>
                {/* Only shown to signed out users */}
                <div className="w-full p-8">
                    <div className="max-w-md mx-auto text-center p-8 bg-gray-900 rounded-lg shadow-lg border border-gray-800">
                        <h2 className="text-xl font-semibold mb-4 text-white">
                            Sign in to access the chat
                        </h2>
                        <p className="text-gray-300 mb-6">
                            Please sign in or create an account to start
                            chatting with Lumos.
                        </p>
                    </div>
                </div>
            </SignedOut>
        </>
    );
}

// Loading fallback for Suspense
function ChatLoading() {
    return (
        <div className="flex items-center justify-center h-full w-full">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading chat...</p>
            </div>
        </div>
    );
}

export default function Home() {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Navbar />
            <MainMenu />

            <main className="flex flex-1 h-[calc(100vh-128px)] ml-16 pl-4">
                <Suspense fallback={<ChatLoading />}>
                    <ChatContent sidebarOpen={sidebarOpen} />
                </Suspense>
            </main>

            <footer className="bg-black text-gray-500 text-center text-sm p-4 border-t border-gray-800 ml-16 pl-4">
                &copy; {new Date().getFullYear()} Lumos AI. Developed by{" "}
                <a
                    href="https://www.cngsoftware.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                >
                    CNG Software
                </a>
                . All rights reserved.
            </footer>
        </div>
    );
}
