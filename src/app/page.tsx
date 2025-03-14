"use client";

import ChatWindow from "@/app/components/chat/ChatWindow";
import ConversationSidebar from "@/app/components/chat/ConversationSidebar";
import Image from "next/image";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function Home() {
    const searchParams = useSearchParams();
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Get conversation ID from URL if present
    useEffect(() => {
        const urlConversationId = searchParams.get("conversation");
        if (urlConversationId) {
            setConversationId(urlConversationId);
        }
    }, [searchParams]);

    // Handle selecting a conversation
    const handleSelectConversation = (id: string) => {
        // Update URL with the conversation ID
        const url = new URL(window.location.href);
        url.searchParams.set("conversation", id);
        window.history.pushState({}, "", url);
        
        // Update state
        setConversationId(id);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <header className="w-full bg-black border-b border-gray-800 p-4">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Image
                            src="/logo.png"
                            alt="Lumos AI"
                            width={300}
                            height={30}
                            priority
                        />
                    </div>

                    <button 
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="md:hidden text-white p-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="flex h-[calc(100vh-64px)]">
                <SignedIn>
                    {/* Sidebar for conversations */}
                    <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block h-full`}>
                        <ConversationSidebar 
                            currentConversationId={conversationId} 
                            onSelectConversation={handleSelectConversation} 
                        />
                    </div>

                    {/* Main chat area */}
                    <div className="flex-1 p-4 overflow-hidden">
                        <ChatWindow initialConversationId={conversationId} />
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
                                chatting with Lumos AI Assistant.
                            </p>
                        </div>
                    </div>
                </SignedOut>
            </main>

            <footer className="bg-black text-gray-500 text-center text-sm p-4 border-t border-gray-800">
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
