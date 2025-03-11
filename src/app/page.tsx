"use client";

import ChatWindow from "@/app/components/chat/ChatWindow";
import Image from "next/image";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function Home() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black p-4 sm:p-8">
            <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                    <Image
                        src="/next.svg"
                        alt="Lumos AI"
                        width={120}
                        height={30}
                        className="dark:invert"
                        priority
                    />
                </div>

                {/* <a
                    href="https://github.com/yourusername/lumos-ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline"
                >
                    GitHub
                </a> */}
            </header>

            <main className="max-w-4xl mx-auto">
                <SignedIn>
                    <ChatWindow />
                </SignedIn>

                <SignedOut>
                    {/* Only shown to signed out users */}
                    <div className="text-center p-8 bg-white dark:bg-black rounded-lg shadow-lg">
                        <h2 className="text-xl font-semibold mb-4">
                            Sign in to access the chat
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Please sign in or create an account to start
                            chatting with Lumos AI Assistant.
                        </p>
                    </div>
                </SignedOut>

                <p className="text-center text-sm text-gray-500 mt-6">
                    &copy; {new Date().getFullYear()} Lumos AI. Developed by{" "}
                    <a
                        href="https://www.cngsoftware.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                    >
                        CNG Software
                    </a>
                    . All rights reserved.
                </p>
            </main>
        </div>
    );
}
