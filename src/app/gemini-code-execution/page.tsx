"use client";

import { useState, useEffect } from "react";
import { Loader2, Info, Code, Send } from "lucide-react";

export default function GeminiCodeExecution() {
    const [prompt, setPrompt] = useState<string>("");
    const [response, setResponse] = useState<string>("");
    const [formattedResponse, setFormattedResponse] = useState<string>("");
    const [inlineData, setInlineData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Format code blocks in the response
    useEffect(() => {
        if (response) {
            // Simple code block formatting - replace markdown code blocks with styled divs
            const formatted = response.replace(
                /```(\w*)([\s\S]*?)```/g,
                '<div class="bg-gray-900 p-3 rounded-md my-3 overflow-x-auto text-gray-300 font-mono text-sm">$2</div>'
            );
            setFormattedResponse(formatted);
        } else {
            setFormattedResponse("");
        }
    }, [response]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!prompt.trim()) {
            setError("Please enter a prompt");
            return;
        }

        setLoading(true);
        setError(null);
        setResponse("");
        setFormattedResponse("");
        setInlineData([]);

        try {
            const res = await fetch("/api/gemini-code-execution", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ prompt }),
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
        <div className="container mx-auto px-4 py-8 max-w-5xl text-white">
            <div className="flex items-center mb-6">
                <Code className="h-8 w-8 text-blue-400 mr-3" />
                <h1 className="text-3xl font-bold">
                    Gemini Code Execution Test
                </h1>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-md p-4 mb-6 flex items-start">
                <Info className="text-blue-400 h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                    <h3 className="font-medium text-blue-300">
                        About Gemini Code Execution
                    </h3>
                    <p className="text-gray-300 text-sm mt-1">
                        Gemini's code execution capability allows the model to
                        generate and run code in a secure sandbox environment.
                        It can generate code in multiple languages, run the
                        code, and analyze the results. This test page
                        demonstrates how to interact with Gemini's code
                        execution feature through a simple interface.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-2">
                    <div className="bg-gray-800 border border-gray-700 rounded-md p-4 mb-6">
                        <h2 className="text-xl font-semibold mb-3 flex items-center">
                            <span className="bg-blue-600 h-5 w-1 mr-2 rounded"></span>
                            Sample Prompts
                        </h2>
                        <div className="grid grid-cols-1 gap-2">
                            {samplePrompts.map((samplePrompt, index) => (
                                <button
                                    key={index}
                                    onClick={() => setPrompt(samplePrompt)}
                                    className="text-left p-2 border border-gray-700 rounded bg-gray-900 hover:bg-gray-700 transition"
                                >
                                    {samplePrompt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3 flex flex-col">
                    <div className="bg-gray-800 border border-gray-700 rounded-md p-4 mb-6 flex-grow">
                        <form onSubmit={handleSubmit} className="mb-8">
                            <div className="mb-4">
                                <label
                                    htmlFor="prompt"
                                    className="block text-sm font-medium mb-2 flex items-center"
                                >
                                    <span className="bg-blue-600 h-5 w-1 mr-2 rounded"></span>
                                    Enter your prompt for code execution:
                                </label>
                                <div className="relative">
                                    <textarea
                                        id="prompt"
                                        value={prompt}
                                        onChange={(e) =>
                                            setPrompt(e.target.value)
                                        }
                                        className="w-full h-32 p-3 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900 text-white pr-12"
                                        placeholder="Example: Generate and run code to calculate the first 10 Fibonacci numbers"
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading || !prompt.trim()}
                                        className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <Loader2 className="animate-spin h-5 w-5" />
                                        ) : (
                                            <Send className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded-md">
                                    {error}
                                </div>
                            )}
                        </form>

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
                                <div
                                    className="p-4 bg-gray-900 border border-gray-700 rounded-md"
                                    dangerouslySetInnerHTML={{
                                        __html: formattedResponse,
                                    }}
                                />

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
            </div>
        </div>
    );
}
