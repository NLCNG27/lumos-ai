"use client";

import { useState, useEffect } from "react";
import { SavedDataset } from "@/app/types/visualization";
import {
    Bookmark,
    BookmarkCheck,
    ChevronRight,
    FileBarChart,
    FileSpreadsheet,
    Loader2,
    MoreVertical,
    PlusCircle,
    Trash2,
    Calendar,
    Edit2,
    X,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";

interface SavedDatasetListProps {
    onSelectDataset: (dataset: SavedDataset) => void;
    onSaveCurrentDataset: () => void;
    hasCurrentDataset: boolean;
}

export default function SavedDatasetList({
    onSelectDataset,
    onSaveCurrentDataset,
    hasCurrentDataset,
}: SavedDatasetListProps) {
    const [datasets, setDatasets] = useState<SavedDataset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [isRenaming, setIsRenaming] = useState<string | null>(null);
    const [newName, setNewName] = useState("");

    const { userId, isLoaded, isSignedIn } = useAuth();

    useEffect(() => {
        if (isLoaded) {
            fetchDatasets();
        }
    }, [isLoaded]);

    const fetchDatasets = async () => {
        try {
            setIsLoading(true);
            setError(null);

            if (!isSignedIn) {
                setDatasets([]);
                setError("Please sign in to view your saved datasets");
                setIsLoading(false);
                return;
            }

            const response = await fetch("/api/datasets");

            if (!response.ok) {
                throw new Error("Failed to fetch datasets");
            }

            const data = await response.json();
            setDatasets(data);
        } catch (err) {
            console.error("Error fetching datasets:", err);
            setError("Failed to load saved datasets");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFavorite = async (dataset: SavedDataset) => {
        try {
            const response = await fetch("/api/datasets", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: dataset.id,
                    is_favorite: !dataset.is_favorite,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to update dataset");
            }

            // Update local state
            setDatasets(
                datasets.map((d) =>
                    d.id === dataset.id
                        ? { ...d, is_favorite: !dataset.is_favorite }
                        : d
                )
            );
        } catch (err) {
            console.error("Error updating dataset:", err);
        } finally {
            setActiveDropdown(null);
        }
    };

    const deleteDataset = async (datasetId: string) => {
        try {
            const response = await fetch(`/api/datasets?id=${datasetId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete dataset");
            }

            // Update local state
            setDatasets(datasets.filter((d) => d.id !== datasetId));
        } catch (err) {
            console.error("Error deleting dataset:", err);
        } finally {
            setActiveDropdown(null);
        }
    };

    const startRenaming = (dataset: SavedDataset) => {
        setNewName(dataset.name);
        setIsRenaming(dataset.id);
        setActiveDropdown(null);
    };

    const handleRename = async (datasetId: string) => {
        if (!newName.trim()) {
            setIsRenaming(null);
            return;
        }

        try {
            const response = await fetch("/api/datasets", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: datasetId,
                    name: newName.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to rename dataset");
            }

            // Update local state
            setDatasets(
                datasets.map((d) =>
                    d.id === datasetId ? { ...d, name: newName.trim() } : d
                )
            );
        } catch (err) {
            console.error("Error renaming dataset:", err);
        } finally {
            setIsRenaming(null);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInDays = Math.floor(
            (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffInDays === 0) {
            return "Today";
        } else if (diffInDays === 1) {
            return "Yesterday";
        } else if (diffInDays < 7) {
            return `${diffInDays} days ago`;
        } else {
            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
            });
        }
    };

    if (!isLoaded) {
        return (
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-center">
                Loading auth state...
            </div>
        );
    }

    if (!isSignedIn) {
        return (
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <p className="text-gray-400">
                    Sign in to save and access your datasets
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 flex justify-center items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
                <p className="text-gray-400">Loading saved datasets...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <p className="text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex justify-between items-center">
                <h3 className="font-medium">Saved Datasets</h3>
                {hasCurrentDataset && (
                    <button
                        onClick={onSaveCurrentDataset}
                        className="flex items-center text-sm text-blue-500 hover:text-blue-400 transition-colors"
                    >
                        <PlusCircle className="mr-1 h-4 w-4" />
                        Save Current
                    </button>
                )}
            </div>

            {datasets.length === 0 ? (
                <div className="p-6 text-center">
                    <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-600 mb-2" />
                    <p className="text-gray-400 mb-3">No saved datasets yet</p>
                    {hasCurrentDataset && (
                        <button
                            onClick={onSaveCurrentDataset}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm text-white transition-colors"
                        >
                            <PlusCircle className="mr-1.5 h-4 w-4" />
                            Save Current Dataset
                        </button>
                    )}
                </div>
            ) : (
                <ul className="divide-y divide-gray-800 max-h-[400px] overflow-y-auto">
                    {datasets.map((dataset) => (
                        <li
                            key={dataset.id}
                            className="relative p-3 hover:bg-gray-800/50 transition-colors"
                        >
                            {isRenaming === dataset.id ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) =>
                                            setNewName(e.target.value)
                                        }
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded py-1 px-2 text-sm text-white"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleRename(dataset.id);
                                            } else if (e.key === "Escape") {
                                                setIsRenaming(null);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => handleRename(dataset.id)}
                                        className="p-1 text-green-500 hover:text-green-400"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setIsRenaming(null)}
                                        className="p-1 text-gray-500 hover:text-gray-400"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    <button
                                        onClick={() => toggleFavorite(dataset)}
                                        className="mr-2 text-gray-500 hover:text-amber-400 transition-colors"
                                    >
                                        {dataset.is_favorite ? (
                                            <BookmarkCheck className="h-5 w-5 text-amber-400" />
                                        ) : (
                                            <Bookmark className="h-5 w-5" />
                                        )}
                                    </button>

                                    <button
                                        onClick={() => onSelectDataset(dataset)}
                                        className="flex-1 flex items-center overflow-hidden"
                                    >
                                        <div className="flex-shrink-0 mr-3 bg-gray-800 rounded p-2">
                                            <FileBarChart className="h-6 w-6 text-blue-500" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center">
                                                <h4 className="font-medium text-white truncate">
                                                    {dataset.name}
                                                </h4>
                                                {dataset.is_favorite && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                                                        Favorite
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center text-xs text-gray-400 mt-1">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                <span>
                                                    {formatDate(
                                                        dataset.created_at
                                                    )}
                                                </span>
                                                <span className="mx-2">•</span>
                                                <span>
                                                    {dataset.row_count} rows
                                                </span>
                                                <span className="mx-2">•</span>
                                                <span>
                                                    {formatFileSize(
                                                        dataset.size
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    <div className="flex-shrink-0 relative">
                                        <button
                                            onClick={() =>
                                                setActiveDropdown(
                                                    activeDropdown ===
                                                        dataset.id
                                                        ? null
                                                        : dataset.id
                                                )
                                            }
                                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>

                                        {activeDropdown === dataset.id && (
                                            <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 rounded-md shadow-lg z-10 py-1">
                                                <button
                                                    onClick={() =>
                                                        toggleFavorite(dataset)
                                                    }
                                                    className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-700"
                                                >
                                                    {dataset.is_favorite ? (
                                                        <>
                                                            <Bookmark className="h-4 w-4 mr-2" />
                                                            Unfavorite
                                                        </>
                                                    ) : (
                                                        <>
                                                            <BookmarkCheck className="h-4 w-4 mr-2" />
                                                            Favorite
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        startRenaming(dataset)
                                                    }
                                                    className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-700"
                                                >
                                                    <Edit2 className="h-4 w-4 mr-2" />
                                                    Rename
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        deleteDataset(
                                                            dataset.id
                                                        )
                                                    }
                                                    className="flex items-center w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-gray-700"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
