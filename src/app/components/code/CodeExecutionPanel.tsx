"use client";

import React, { useState } from "react";
import { useChat } from "@/app/hooks/useChat";

/**
 * CodeExecutionPanel - A component that allows users to execute code directly
 * using Gemini 2.0 Flash's code execution capabilities.
 */
export default function CodeExecutionPanel() {
    const [prompt, setPrompt] = useState("");
    const [codeSnippet, setCodeSnippet] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { executeCode } = useChat();

    const handleExecute = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await executeCode(
                prompt,
                codeSnippet || undefined
            );
            setResult(response.outputText);
        } catch (error) {
            console.error("Error executing code:", error);
            setResult("An error occurred while executing the code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <h2 className="text-xl font-semibold mb-4">Code Execution</h2>

            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                    What would you like to do?
                </label>
                <textarea
                    className="w-full px-3 py-2 border rounded-md h-20 dark:bg-gray-700 dark:border-gray-600"
                    placeholder="E.g., Calculate the first 10 prime numbers"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
            </div>

            <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                    Code snippet (optional)
                </label>
                <textarea
                    className="w-full px-3 py-2 border rounded-md h-32 font-mono text-sm dark:bg-gray-700 dark:border-gray-600"
                    placeholder="# Paste code here if you want the AI to analyze it"
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                />
            </div>

            <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                onClick={handleExecute}
                disabled={loading || !prompt.trim()}
            >
                {loading ? "Executing..." : "Execute Code"}
            </button>

            {result && (
                <div className="mt-4">
                    <h3 className="text-lg font-medium mb-2">Result:</h3>
                    <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md whitespace-pre-wrap font-mono text-sm">
                        {result}
                    </div>
                </div>
            )}
        </div>
    );
}
