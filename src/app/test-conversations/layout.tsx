import Link from "next/link";

export default function TestLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-black text-white">
            <nav className="bg-gray-900 shadow-sm border-b border-gray-800">
                <div className="container mx-auto p-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-white">
                            Lumos AI - Testing
                        </h1>
                        <div className="flex gap-4">
                            <Link
                                href="/"
                                className="text-blue-400 hover:text-blue-300"
                            >
                                Back to Home
                            </Link>
                            <Link
                                href="/test-conversations"
                                className="text-blue-400 hover:text-blue-300"
                            >
                                Conversations
                            </Link>
                            <Link
                                href="/test-conversations/messages"
                                className="text-blue-400 hover:text-blue-300"
                            >
                                Messages
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="container mx-auto py-6">{children}</main>
        </div>
    );
}
