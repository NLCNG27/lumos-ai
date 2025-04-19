"use client";

import Link from "next/link";
import { Home, Code, Newspaper, BarChart } from "lucide-react";
import { SignedIn } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Tooltip } from "@/app/components/ui/Tooltip";

export default function MainMenu() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === "/" && pathname === "/") return true;
        if (path === "/chalkboard" && pathname.startsWith("/chalkboard"))
            return true;
        if (path === "/news" && pathname.startsWith("/news")) return true;
        if (path === "/visualizations" && pathname.startsWith("/visualizations")) 
            return true;
        return false;
    };

    return (
        <SignedIn>
            <div className="fixed left-0 top-0 h-full w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center justify-evenly pt-0 z-0">
                <div className="flex flex-col items-center space-y-8 mt-20">
                    <Tooltip content="Chat" side="right">
                        <Link
                            href="/"
                            className={`p-3 rounded-lg transition-colors hover:bg-gray-800 ${
                                isActive("/")
                                    ? "bg-blue-900/50 text-blue-400"
                                    : "text-gray-400"
                            }`}
                        >
                            <Home className="h-6 w-6" />
                        </Link>
                    </Tooltip>

                    <Tooltip content="Chalkboard" side="right">
                        <Link
                            href="/chalkboard"
                            className={`p-3 rounded-lg transition-colors hover:bg-gray-800 ${
                                isActive("/chalkboard")
                                    ? "bg-blue-900/50 text-blue-400"
                                    : "text-gray-400"
                            }`}
                        >
                            <Code className="h-6 w-6" />
                        </Link>
                    </Tooltip>

                    <Tooltip content="Hacker News" side="right">
                        <Link
                            href="/news"
                            className={`p-3 rounded-lg transition-colors hover:bg-gray-800 ${
                                isActive("/news")
                                    ? "bg-blue-900/50 text-blue-400"
                                    : "text-gray-400"
                            }`}
                        >
                            <Newspaper className="h-6 w-6" />
                        </Link>
                    </Tooltip>
                    
                    <Tooltip content="Visualizations" side="right">
                        <Link
                            href="/visualizations"
                            className={`p-3 rounded-lg transition-colors hover:bg-gray-800 ${
                                isActive("/visualizations")
                                    ? "bg-blue-900/50 text-blue-400"
                                    : "text-gray-400"
                            }`}
                        >
                            <BarChart className="h-6 w-6" />
                        </Link>
                    </Tooltip>
                </div>
            </div>
        </SignedIn>
    );
}
