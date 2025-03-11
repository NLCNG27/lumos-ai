import Image from "next/image";
import { useState, useEffect } from "react";

type UploadedFile = {
    id: string;
    file: File;
    previewUrl?: string;
};

type FilePreviewProps = {
    files: UploadedFile[];
    onRemove: (id: string) => void;
};

export default function FilePreview({ files, onRemove }: FilePreviewProps) {
    const [showLimitationWarning, setShowLimitationWarning] = useState(false);

    useEffect(() => {
        // Check if any files are PDFs or other complex formats
        const hasComplexFiles = files.some((fileItem) => {
            const fileType = fileItem.file.type;
            const fileName = fileItem.file.name.toLowerCase();
            return (
                fileType === "application/pdf" ||
                fileName.endsWith(".pdf") ||
                fileType.includes("spreadsheetml") ||
                fileType.includes("wordprocessingml") ||
                fileName.endsWith(".docx") ||
                fileName.endsWith(".xlsx")
            );
        });

        setShowLimitationWarning(hasComplexFiles);
    }, [files]);

    if (files.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 mt-2 mb-2">
            {showLimitationWarning && (
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                    <p>
                        <span className="font-medium">Note:</span> For PDFs and
                        other complex documents, the AI may have limited ability
                        to process their contents. Consider describing specific
                        sections or information you're looking for.
                    </p>
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                {files.map((fileItem) => (
                    <FileItem
                        key={fileItem.id}
                        fileItem={fileItem}
                        onRemove={onRemove}
                    />
                ))}
            </div>
        </div>
    );
}

function FileItem({
    fileItem,
    onRemove,
}: {
    fileItem: UploadedFile;
    onRemove: (id: string) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const { id, file, previewUrl } = fileItem;

    const fileType = file.type.split("/")[0];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    const getFileIcon = () => {
        if (fileType === "image" && previewUrl) {
            return (
                <div className="relative w-16 h-16 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                    <Image
                        src={previewUrl}
                        alt={file.name}
                        fill
                        style={{ objectFit: "cover" }}
                    />
                </div>
            );
        }

        // File type specific icons
        let iconPath;
        let bgColor = "bg-gray-100 dark:bg-gray-800";
        let textColor = "text-gray-600 dark:text-gray-300";

        if (["pdf"].includes(fileExtension || "")) {
            iconPath =
                "M14 11h1v2h-3V8h2v3zM10 11H9V9h1v2zm-3 0H6V9h1v2zM17 6H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z";
            bgColor = "bg-red-100 dark:bg-red-900/30";
            textColor = "text-red-600 dark:text-red-300";
        } else if (["doc", "docx"].includes(fileExtension || "")) {
            iconPath =
                "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9h-2v2h2v2h-2v2h-2v-2H9v-2h2v-2H9V9h2V7h2v2h2v2z";
            bgColor = "bg-blue-100 dark:bg-blue-900/30";
            textColor = "text-blue-600 dark:text-blue-300";
        } else if (["xls", "xlsx", "csv"].includes(fileExtension || "")) {
            iconPath =
                "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 5h3.5L13 3.5V7zm-2 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm6 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V9h4v2z";
            bgColor = "bg-green-100 dark:bg-green-900/30";
            textColor = "text-green-600 dark:text-green-300";
        } else {
            iconPath =
                "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z";
        }

        return (
            <div
                className={`relative w-16 h-16 flex items-center justify-center rounded ${bgColor}`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-8 w-8 ${textColor}`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path d={iconPath} />
                </svg>
            </div>
        );
    };

    return (
        <div
            className="relative rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center gap-2">
                {getFileIcon()}
                <div className="flex-1 min-w-0">
                    <p
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate"
                        title={file.name}
                    >
                        {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                    </p>
                </div>
            </div>

            {isHovered && (
                <button
                    onClick={() => onRemove(id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
                    title="Remove file"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}
