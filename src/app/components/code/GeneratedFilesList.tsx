import { useState } from "react";
import { Download, Copy, Check, Folder, FileIcon } from "lucide-react";

interface GeneratedFile {
    filename: string;
    content: string;
}

interface GeneratedFilesListProps {
    files: GeneratedFile[];
}

export default function GeneratedFilesList({ files }: GeneratedFilesListProps) {
    const [copiedFile, setCopiedFile] = useState<string | null>(null);

    // Function to download a single file
    const downloadFile = (filename: string, content: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Function to download all files as a zip
    const downloadAllFiles = async () => {
        // Dynamically import JSZip
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();

        // Add each file to the zip
        files.forEach((file) => {
            zip.file(file.filename, file.content);
        });

        // Generate the zip file
        const content = await zip.generateAsync({ type: "blob" });

        // Create download link
        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = "generated-files.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Function to copy file content to clipboard
    const copyToClipboard = (filename: string, content: string) => {
        navigator.clipboard.writeText(content).then(() => {
            setCopiedFile(filename);
            setTimeout(() => setCopiedFile(null), 2000);
        });
    };

    // Get file type icon
    const getFileIcon = (filename: string) => {
        const extension = filename.split(".").pop()?.toLowerCase() || "";

        // Return different icons based on file extension
        switch (extension) {
            case "js":
            case "jsx":
            case "ts":
            case "tsx":
                return <FileIcon className="text-yellow-500" />;
            case "css":
            case "scss":
                return <FileIcon className="text-blue-500" />;
            case "html":
                return <FileIcon className="text-orange-500" />;
            case "json":
                return <FileIcon className="text-green-500" />;
            case "md":
                return <FileIcon className="text-gray-500" />;
            default:
                return <FileIcon />;
        }
    };

    if (!files.length) return null;

    return (
        <div className="w-full mt-4 bg-gray-950 border border-gray-800 text-white rounded-lg">
            <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-lg flex items-center gap-2">
                    <Folder className="h-5 w-5" />
                    Generated Files
                </h3>
                <p className="text-gray-400 text-sm">
                    {files.length} file{files.length !== 1 ? "s" : ""} generated
                </p>
            </div>

            <div className="p-4">
                <div className="space-y-3">
                    {files.map((file) => (
                        <div
                            key={file.filename}
                            className="p-3 rounded-md border border-gray-800 bg-black flex justify-between items-center"
                        >
                            <div className="flex items-center gap-2">
                                {getFileIcon(file.filename)}
                                <span className="font-mono text-sm">
                                    {file.filename}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() =>
                                        copyToClipboard(
                                            file.filename,
                                            file.content
                                        )
                                    }
                                    className="text-gray-400 hover:text-white hover:bg-gray-800 p-1 rounded-md"
                                >
                                    {copiedFile === file.filename ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </button>
                                <button
                                    onClick={() =>
                                        downloadFile(
                                            file.filename,
                                            file.content
                                        )
                                    }
                                    className="text-gray-400 hover:text-white hover:bg-gray-800 p-1 rounded-md"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {files.length > 1 && (
                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={downloadAllFiles}
                        className="w-full py-2 px-4 bg-blue-900 hover:bg-blue-800 text-white border border-blue-700 rounded-md flex items-center justify-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Download All Files as ZIP
                    </button>
                </div>
            )}
        </div>
    );
}
