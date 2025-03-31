"use client";

import Link from "next/link";
import { Home, Code } from "lucide-react";
import { SignedIn } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/app/components/ui/Tooltip";

export default function MainMenu() {
    const pathname = usePathname();
    
    const isActive = (path: string) => {
        if (path === "/" && pathname === "/") return true;
        if (path === "/chalkboard" && pathname.startsWith("/chalkboard")) return true;
        return false;
    };

    return (
        <SignedIn>
            <div className="fixed left-0 top-0 h-full w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center pt-20 z-0">
                <Tooltip content="Chat" side="right">
                    <Link 
                        href="/" 
                        className={`p-3 mb-4 rounded-lg transition-colors hover:bg-gray-800 ${
                            isActive("/") ? "bg-blue-900/50 text-blue-400" : "text-gray-400"
                        }`}
                    >
                        <Home className="h-6 w-6" />
                    </Link>
                </Tooltip>
                
                <Tooltip content="Chalkboard" side="right">
                    <Link
                        href="/chalkboard"
                        className={`p-3 rounded-lg transition-colors hover:bg-gray-800 ${
                            isActive("/chalkboard") ? "bg-blue-900/50 text-blue-400" : "text-gray-400"
                        }`}
                    >
                        <Code className="h-6 w-6" />
                    </Link>
                </Tooltip>
            </div>
        </SignedIn>
    );
} 