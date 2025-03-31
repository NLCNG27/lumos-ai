import type { Metadata } from "next";
import {
    ClerkProvider,
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton,
} from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserSyncProvider } from './components/UserSyncProvider';
import 'katex/dist/katex.min.css';

// Optimize font loading
const geistSans = Geist({
    subsets: ["latin"],
    display: "swap", // Use 'swap' for better performance
    preload: true,
    weight: ["400", "500", "600", "700"], // Only preload needed weights
    variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
    subsets: ["latin"],
    display: "swap",
    preload: true,
    weight: ["400", "500"], // Only preload needed weights
    variable: "--font-geist-mono",
});

export const metadata: Metadata = {
    title: "Lumos AI",
    description: "AI assistant for analyzing documents and data",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
            <head>
                {/* Add preconnect for external resources */}
                <link rel="preconnect" href="https://clerk.lumos-ai.com" />
                <link rel="preconnect" href="https://generativelanguage.googleapis.com" />
                
                {/* Add DNS prefetch */}
                <link rel="dns-prefetch" href="https://clerk.lumos-ai.com" />
                <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />
            </head>
            <body className={`${geistSans.className} antialiased`}>
                <ClerkProvider>
                    <UserSyncProvider>
                        {children}
                    </UserSyncProvider>
                </ClerkProvider>
            </body>
        </html>
    );
}
