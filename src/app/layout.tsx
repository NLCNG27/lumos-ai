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

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Lumos",
    description: "Your daily AI assistant, or whomever you want it to be.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider>
            <UserSyncProvider>
                <html lang="en">
                    <body
                        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
                    >
                        {children}
                    </body>
                </html>
            </UserSyncProvider>
        </ClerkProvider>
    );
}
