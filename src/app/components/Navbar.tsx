"use client";

import Link from "next/link";
import Image from "next/image";
import {
    SignedIn,
    SignedOut,
    UserButton,
    SignInButton,
    SignUpButton,
} from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function Navbar() {
    // Use client-side only rendering for auth components
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    return (
        <header className="w-full bg-black border-b border-gray-800 px-4 py-2">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-6">
                    <Link href="/">
                        <Image
                            src="/logo.png"
                            alt="Lumos AI"
                            width={120}
                            height={24}
                            priority
                            className="ml-0"
                        />
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    {isMounted ? (
                        <>
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
                        </>
                    ) : (
                        <div className="flex gap-4">
                            <div className="w-24 h-10 bg-white dark:bg-gray-800 rounded-lg"></div>
                            <div className="w-24 h-10 bg-black dark:bg-white rounded-lg"></div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
