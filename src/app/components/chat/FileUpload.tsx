import { useState, useRef } from "react";
import Image from "next/image";

type FileUploadProps = {
    onFileSelect: (files: File[]) => void;
    isLoading: boolean;
};

export default function FileUpload({
    onFileSelect,
    isLoading,
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            onFileSelect(filesArray);
            
            // Reset the file input to allow selecting the same file again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            onFileSelect(filesArray);
            
            // Reset the file input to allow selecting the same file again
            e.target.value = '';
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={handleButtonClick}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none disabled:opacity-50"
                title="Upload files"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                </svg>
            </button>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rb,.php,.html,.css,.xml,.json,.yaml,.yml,.md,.sh,.bash,.ps1,.sql,.r,.swift,.kt,.dart,.lua,.pl,.vue,.svelte,.config,.conf,.env,.gitignore"
                disabled={isLoading}
            />

            {/* Drop zone - only visible when dragging */}
            {isDragging && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="absolute bottom-full left-0 right-0 mb-2 p-4 bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg text-center"
                >
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                        Drop files here
                    </p>
                </div>
            )}
        </div>
    );
}
