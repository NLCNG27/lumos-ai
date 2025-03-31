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
import { useState } from "react";

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex space-x-6">
                        <Link
                            href="/"
                            className="text-gray-300 hover:text-white transition"
                        >
                            Chat
                        </Link>
                        <Link
                            href="/chalkboard"
                            className="text-gray-300 hover:text-white transition"
                        >
                            Chalkboard
                        </Link>
                    </nav>
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

                    {/* Mobile menu button */}
                    <div className="ml-2 md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="text-white p-2"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isMenuOpen && (
                <div className="md:hidden mt-2 py-2 border-t border-gray-800">
                    <nav className="flex flex-col space-y-2">
                        <Link
                            href="/"
                            className="text-gray-300 hover:text-white transition px-2 py-1"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Chat
                        </Link>
                        <Link
                            href="/chalkboard"
                            className="text-gray-300 hover:text-white transition px-2 py-1"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Chalkboard
                        </Link>
                    </nav>
                </div>
            )}
        </header>
    );
}
