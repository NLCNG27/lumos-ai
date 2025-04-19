import { Metadata } from "next";
import Navbar from "@/app/components/Navbar";
import MainMenu from "@/app/components/MainMenu";

export const metadata: Metadata = {
    title: "News | Lumos AI",
    description: "Some latest news",
};

export default function NewsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Navbar />
            <MainMenu />
            <div className="ml-16 pt-16 p-6">{children}</div>
        </div>
    );
}
