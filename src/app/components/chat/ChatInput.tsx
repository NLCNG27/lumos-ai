import { useState, KeyboardEvent, useRef, useEffect } from "react";
import FileUpload from "./FileUpload";
import FilePreview from "./FilePreview";

type UploadedFile = {
    id: string;
    file: File;
    previewUrl?: string;
};

type ChatInputProps = {
    onSendMessage: (message: string, files?: UploadedFile[]) => void;
    isLoading: boolean;
};

export default function ChatInput({
    onSendMessage,
    isLoading,
}: ChatInputProps) {
    const [input, setInput] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((input.trim() || uploadedFiles.length > 0) && !isLoading) {
            onSendMessage(input, uploadedFiles);
            setInput("");
            setUploadedFiles([]);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (but not when Shift is pressed)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if ((input.trim() || uploadedFiles.length > 0) && !isLoading) {
                onSendMessage(input, uploadedFiles);
                setInput("");
                setUploadedFiles([]);
            }
        }
        // Allow newline when Shift+Enter is pressed
        // No need to do anything special here as the default behavior will add a newline
    };

    const handleFileSelect = async (files: File[]) => {
        const newFiles: UploadedFile[] = await Promise.all(
            files.map(async (file) => {
                // Create preview URLs for images
                let previewUrl;
                if (file.type.startsWith("image/")) {
                    previewUrl = URL.createObjectURL(file);
                }

                return {
                    id: `file-${Date.now()}-${Math.random()
                        .toString(36)
                        .substr(2, 9)}`,
                    file,
                    previewUrl,
                };
            })
        );

        setUploadedFiles((prev) => [...prev, ...newFiles]);
    };

    const handleRemoveFile = (id: string) => {
        setUploadedFiles((prev) => {
            const updatedFiles = prev.filter((file) => file.id !== id);
            // Clean up any object URLs to prevent memory leaks
            const fileToRemove = prev.find((file) => file.id === id);
            if (fileToRemove?.previewUrl) {
                URL.revokeObjectURL(fileToRemove.previewUrl);
            }
            return updatedFiles;
        });
    };

    // Handle paste events to capture images from clipboard
    const handlePaste = async (e: ClipboardEvent) => {
        if (isLoading) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        const imageItems = Array.from(items).filter((item) =>
            item.type.startsWith("image/")
        );

        if (imageItems.length === 0) return;

        // Prevent default paste behavior only if we have images
        // This allows text to still be pasted normally
        if (imageItems.length > 0) {
            e.preventDefault();
        }

        const files: File[] = [];

        for (const item of imageItems) {
            const file = item.getAsFile();
            if (file) {
                files.push(file);
            }
        }

        if (files.length > 0) {
            await handleFileSelect(files);
        }
    };

    // Add paste event listener
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.addEventListener("paste", handlePaste);

            return () => {
                textarea.removeEventListener("paste", handlePaste);
            };
        }
    }, [isLoading]); // Re-add listener if isLoading changes

    // Clean up object URLs when component unmounts
    useEffect(() => {
        return () => {
            uploadedFiles.forEach((file) => {
                if (file.previewUrl) {
                    URL.revokeObjectURL(file.previewUrl);
                }
            });
        };
    }, []);

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col border-t p-4"
        >
            <FilePreview files={uploadedFiles} onRemove={handleRemoveFile} />

            <div className="flex items-center gap-2">
                <FileUpload
                    onFileSelect={handleFileSelect}
                    isLoading={isLoading}
                />

                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        uploadedFiles.length > 0
                            ? "Ask about your files or type a message... (Shift+Enter for new line)"
                            : "Type your message... (Shift+Enter for new line, Paste to add images)"
                    }
                    className="flex-grow p-2 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] max-h-[120px] resize-y"
                    disabled={isLoading}
                    rows={1}
                />

                <button
                    type="submit"
                    disabled={
                        isLoading ||
                        (!input.trim() && uploadedFiles.length === 0)
                    }
                    className="bg-blue-500 text-white p-2 rounded-full disabled:opacity-50"
                >
                    {isLoading ? (
                        <svg
                            className="animate-spin h-5 w-5"
                            viewBox="0 0 24 24"
                        >
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
            </div>
        </form>
    );
}
