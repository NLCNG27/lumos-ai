import { useState, KeyboardEvent } from "react";

type ChatInputProps = {
    onSendMessage: (message: string) => void;
    isLoading: boolean;
};

export default function ChatInput({
    onSendMessage,
    isLoading,
}: ChatInputProps) {
    const [input, setInput] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input);
            setInput("");
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (but not when Shift is pressed)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
                onSendMessage(input);
                setInput("");
            }
        }
        // Allow newline when Shift+Enter is pressed
        // No need to do anything special here as the default behavior will add a newline
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t p-4"
        >
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="flex-grow p-2 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] max-h-[120px] resize-y"
                disabled={isLoading}
                rows={1}
            />
            <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-500 text-white p-2 rounded-full disabled:opacity-50"
            >
                {isLoading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                )}
            </button>
        </form>
    );
}

