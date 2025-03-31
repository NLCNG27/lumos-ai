"use client";

import Navbar from "@/app/components/Navbar";

export default function GeminiCodeExecutionLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />

            <main className="flex flex-col flex-1 min-h-[calc(100vh-128px)]">
                {children}
            </main>

            <footer className="bg-black text-gray-500 text-center text-sm p-4 border-t border-gray-800">
                &copy; {new Date().getFullYear()} Lumos AI. All rights reserved.
            </footer>
        </div>
    );
}
