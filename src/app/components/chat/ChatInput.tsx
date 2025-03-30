import { useState, KeyboardEvent, useRef, useEffect } from "react";
import FileUpload from "./FileUpload";
import FilePreview from "./FilePreview";
import { UploadedFile } from "@/app/types";
import { nanoid } from "nanoid";
import { dispatchConversationUpdate } from "@/app/hooks/useChat";
import CodeExecutionToggle from "./CodeExecutionToggle";
import React from "react";

type ChatInputProps = {
    onSendMessage: (message: string, files?: UploadedFile[], useGroundingSearch?: boolean, useCodeExecution?: boolean) => void;
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
    const formRef = useRef<HTMLDivElement>(null);
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
            onSendMessage(input, uploadedFiles, useGroundingSearch, useCodeExecution);
            setInput("");
            setUploadedFiles([]);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (but not when Shift is pressed)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if ((input.trim() || uploadedFiles.length > 0) && !isLoading) {
                onSendMessage(input, uploadedFiles, useGroundingSearch, useCodeExecution);
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
        <div
            ref={formRef}
            role="form"
            onClick={(e) => {
                if (e.target === formRef.current) {
                    handleSubmit(e as unknown as React.FormEvent);
                }
            }}
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
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                            />
                        </svg>
                    </button>
                    
                    <CodeExecutionToggle 
                        enabled={useCodeExecution}
                        onChange={setUseCodeExecution}
                    />
                </div>
                
                <div className="flex items-center">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        rows={1}
                        className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
                        className="ml-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}