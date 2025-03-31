"use client";

import Navbar from "@/app/components/Navbar";
import MainMenu from "@/app/components/MainMenu";

export default function GeminiCodeExecutionLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />
            <MainMenu />

            <main className="flex flex-col flex-1 min-h-[calc(100vh-128px)] ml-16 pl-4">
                {children}
            </main>

            <footer className="bg-black text-gray-500 text-center text-sm p-4 border-t border-gray-800 ml-16 pl-4">
                &copy; {new Date().getFullYear()} Lumos AI. All rights reserved.
            </footer>
        </div>
    );
}
