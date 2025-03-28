import { useState, KeyboardEvent, useRef, useEffect } from "react";
import FileUpload from "./FileUpload";
import FilePreview from "./FilePreview";
import { UploadedFile } from "@/app/types";
import { nanoid } from "nanoid";
import { dispatchConversationUpdate } from "@/app/hooks/useChat";
import CodeExecutionToggle from "./CodeExecutionToggle";

type ChatInputProps = {
    onSendMessage: (message: string, files?: UploadedFile[], useGroundingSearch?: boolean) => void;
    isLoading: boolean;
};

export default function ChatInput({
    onSendMessage,
    isLoading,
}: ChatInputProps) {
    const [input, setInput] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [useGroundingSearch, setUseGroundingSearch] = useState(false);
    const [useCodeExecution, setUseCodeExecution] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Notify when user starts typing
    useEffect(() => {
        if (input.trim().length > 0) {
            // Only dispatch event if we have a non-empty input
            // This helps indicate that we have an active conversation in progress
            dispatchConversationUpdate('typing');
        }
    }, [input]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((input.trim() || uploadedFiles.length > 0) && !isLoading) {
            onSendMessage(input, uploadedFiles, useGroundingSearch);
            setInput("");
            setUploadedFiles([]);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (but not when Shift is pressed)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if ((input.trim() || uploadedFiles.length > 0) && !isLoading) {
                onSendMessage(input, uploadedFiles, useGroundingSearch);
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
                    // Convert image to base64 data URL instead of using createObjectURL
                    previewUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            resolve(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                    });
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
            // No need to revoke object URLs anymore since we're using base64
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

    // No need to clean up object URLs when component unmounts
    // since we're using base64 data URLs now
    useEffect(() => {
        return () => {
            // Cleanup function is now empty
        };
    }, []);

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col p-4"
        >
            <FilePreview files={uploadedFiles} onRemove={handleRemoveFile} />

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <FileUpload
                        onFileSelect={handleFileSelect}
                        isLoading={isLoading}
                    />
                    
                    <button
                        type="button"
                        onClick={() => setUseGroundingSearch(!useGroundingSearch)}
                        className="flex items-center justify-center h-8 w-8 text-sm rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative group"
                        aria-label={useGroundingSearch ? "Disable Google Search grounding" : "Enable Google Search grounding"}
                    >
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className={`h-5 w-5 ${useGroundingSearch ? "text-blue-600" : "text-gray-400"}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor" 
                            strokeWidth={1.5}
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" 
                            />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-md whitespace-nowrap">
                                Web Search
                            </div>
                        </div>
                    </button>
                    
                    {/* Code Execution Toggle */}
                    <CodeExecutionToggle 
                        enabled={useCodeExecution}
                        onChange={setUseCodeExecution}
                    />

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            uploadedFiles.length > 0
                                ? "Ask about your files or type a message... (Shift+Enter for new line)"
                                : "Tell me what you need..."
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
                            <div className="flex items-center">
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
                            </div>
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

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
                    <div>
                        {/* Code execution indicator removed */}
                    </div>
                    <div>
                        {uploadedFiles.length > 0 && (
                            <span>{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} attached</span>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
