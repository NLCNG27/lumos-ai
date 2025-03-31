"use client";

import { useState } from "react";
import { Loader2, Info, Code, Send } from "lucide-react";
import ChatInput from "@/app/components/chat/ChatInput";
import FormattedCodeResponse from "@/app/components/code/FormattedCodeResponse";

export default function GeminiCodeExecution() {
    const [prompt, setPrompt] = useState<string>("");
    const [response, setResponse] = useState<string>("");
    const [inlineData, setInlineData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleSendMessage = async (message: string) => {
        if (!message.trim()) {
            setError("Please enter a prompt");
            return;
        }

        setLoading(true);
        setError(null);
        setResponse("");
        setInlineData([]);
        setPrompt(message);

        try {
            const res = await fetch("/api/chalkboard", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ prompt: message }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to get response from Gemini"
                );
            }

            setResponse(data.text);

            if (data.inlineData && data.inlineData.length > 0) {
                setInlineData(data.inlineData);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const samplePrompts = [
        "Generate a simple web page with HTML and CSS that displays a colorful animated loader",
        "What is the sum of the first 50 prime numbers? Generate and run code for the calculation",
        "Create a fractal tree visualization using Python and matplotlib",
        "Analyze this data and create a visualization: 1,3,5,7,9,11,13,15,20,25,30,35",
        "Write a JavaScript function to find the longest palindrome in a string, then test it with 'racecar'",
    ];

    return (
        <div className="container mx-auto px-4 py-8 text-white">
            <div className="flex items-center mb-6">
                <Code className="h-8 w-8 text-blue-400 mr-3" />
                <h1 className="text-3xl font-bold">Chalkboard (beta)</h1>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-md p-4 mb-6 flex items-start">
                <Info className="text-blue-400 h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                    <h3 className="font-medium text-blue-300">
                        About Chalkboard
                    </h3>
                    <p className="text-gray-300 text-sm mt-1">
                        Chalkboard is a tool that allows you to generate and run
                        code in a secure sandbox environment. It can generate
                        code in multiple languages, run the code, and analyze
                        the results.
                    </p>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3 flex items-center">
                    <span className="bg-blue-600 h-5 w-1 mr-2 rounded"></span>
                    Sample Prompts
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {samplePrompts.map((samplePrompt, index) => (
                        <button
                            key={index}
                            onClick={() => handleSendMessage(samplePrompt)}
                            className="text-left p-3 border border-gray-700 rounded bg-gray-900 hover:bg-gray-700 transition"
                        >
                            {samplePrompt}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
                <div className="mb-2 text-sm text-gray-300">
                    Enter your prompt for code execution:
                </div>

                <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={loading}
                    showWebSearch={false}
                />

                {error && (
                    <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded-md">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center items-center p-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {response && !loading && (
                    <div className="mt-3">
                        <h2 className="text-xl font-semibold mb-3 flex items-center">
                            <span className="bg-blue-600 h-5 w-1 mr-2 rounded"></span>
                            Response
                        </h2>
                        <div className="p-5 bg-gray-850 border border-gray-700 rounded-md shadow-md">
                            <FormattedCodeResponse response={response} />
                        </div>

                        {inlineData.length > 0 && (
                            <div className="mt-6">
                                <h2 className="text-xl font-semibold mb-3 flex items-center">
                                    <span className="bg-blue-600 h-5 w-1 mr-2 rounded"></span>
                                    Generated Files
                                </h2>
                                <div className="grid grid-cols-1 gap-4">
                                    {inlineData.map((item, index) => (
                                        <div
                                            key={index}
                                            className="p-4 border border-gray-700 bg-gray-900 rounded-md"
                                        >
                                            <p className="mb-2 text-gray-300">
                                                <strong>Type:</strong>{" "}
                                                {item.mimeType}
                                            </p>
                                            {item.mimeType.startsWith(
                                                "image/"
                                            ) ? (
                                                <img
                                                    src={`data:${item.mimeType};base64,${item.data}`}
                                                    alt={`Generated image ${index}`}
                                                    className="max-w-full h-auto"
                                                />
                                            ) : (
                                                <p className="text-gray-300">
                                                    File: {item.index}.
                                                    {item.extension}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
