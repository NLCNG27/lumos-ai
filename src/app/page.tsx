"use client";

import ChatWindow from "@/app/components/chat/ChatWindow";
import ConversationSidebar from "@/app/components/chat/ConversationSidebar";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Component that uses useSearchParams
function ChatContent({ sidebarOpen }: { sidebarOpen: boolean }) {
    const searchParams = useSearchParams();
    const [conversationId, setConversationId] = useState<string | null>(null);

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
        <>
            <SignedIn>
                {/* Sidebar for conversations */}
                <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block h-full`}>
                    <ConversationSidebar 
                        currentConversationId={conversationId} 
                        onSelectConversation={handleSelectConversation} 
                    />
                </div>

                {/* Main chat area */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <ChatWindow initialConversationId={conversationId || undefined} />
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
            <header className="w-full bg-black border-b border-gray-800 px-4 py-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-6">
                        <Image
                            src="/logo.png"
                            alt="Lumos AI"
                            width={120}
                            height={24}
                            priority
                            className="ml-0"
                        />
                        {/* <Link 
                            href="/code-interpreter" 
                            className="text-sm font-medium text-white hover:text-blue-400 transition-colors duration-200"
                        >
                            Code Interpreter Test
                        </Link> */}
                    </div>

                    <div className="flex items-center gap-4">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="px-4 py-2 text-sm font-medium text-black dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-black border border-gray-300 dark:border-gray-600">
                                    Sign in
                                </button>
                            </SignInButton>
                            <SignUpButton mode="modal">
                                <button className="px-4 py-2 text-sm font-medium text-white dark:text-black bg-black dark:bg-white hover:bg-gray-900 dark:hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-black border border-gray-700 dark:border-gray-300">
                                    Sign up
                                </button>
                            </SignUpButton>
                        </SignedOut>
                        <SignedIn>
                            <UserButton afterSignOutUrl="/" />
                        </SignedIn>
                        <button 
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="md:hidden text-white p-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex flex-1 h-[calc(100vh-128px)]">
                <Suspense fallback={<ChatLoading />}>
                    <ChatContent sidebarOpen={sidebarOpen} />
                </Suspense>
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
