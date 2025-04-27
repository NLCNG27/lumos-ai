"use client";

import Navbar from "@/app/components/Navbar";
import MainMenu from "@/app/components/MainMenu";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black text-white">
            <Navbar />
            <MainMenu />

            <main className="flex flex-col flex-1 min-h-[calc(100vh-128px)] ml-16">
                {children}
            </main>

            <footer className="bg-black text-gray-500 text-center text-sm p-4 border-t border-gray-800 ml-16">
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