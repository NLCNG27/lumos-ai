"use client";

import { useState } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { ChartDataType } from "@/app/types/visualization";

interface SaveDatasetModalProps {
    data: ChartDataType;
    onClose: () => void;
    onSuccess: () => void;
    filename?: string | null;
}

export default function SaveDatasetModal({
    data,
    onClose,
    onSuccess,
    filename,
}: SaveDatasetModalProps) {
    const [name, setName] = useState(filename || "");
    const [description, setDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!name.trim()) {
            setError("Please enter a name for your dataset");
            return;
        }

        try {
            setIsSaving(true);
            setError(null);

            const response = await fetch("/api/datasets", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    data,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save dataset");
            }

            onSuccess();
        } catch (err) {
            console.error("Error saving dataset:", err);
            setError(
                err instanceof Error ? err.message : "Failed to save dataset"
            );
        } finally {
            setIsSaving(false);
        }
    };

    // Prevent background scroll when modal is open
    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/70 transition-opacity"
                    onClick={onClose}
                />

                {/* Modal */}
                <div className="relative transform overflow-hidden rounded-lg bg-gray-900 border border-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                    <div className="px-4 pb-4 pt-5 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium">
                                Save Dataset
                            </h3>
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-300"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md flex items-start">
                                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label
                                    htmlFor="dataset-name"
                                    className="block text-sm font-medium text-gray-300 mb-1"
                                >
                                    Dataset Name{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="dataset-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter a name for your dataset"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSaving}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="dataset-description"
                                    className="block text-sm font-medium text-gray-300 mb-1"
                                >
                                    Description (optional)
                                </label>
                                <textarea
                                    id="dataset-description"
                                    value={description}
                                    onChange={(e) =>
                                        setDescription(e.target.value)
                                    }
                                    placeholder="Add a description"
                                    rows={3}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="bg-gray-800/50 rounded-md p-3">
                                <h4 className="text-sm font-medium text-gray-300 mb-2">
                                    Dataset Summary
                                </h4>
                                <ul className="text-sm text-gray-400 space-y-1">
                                    <li>Labels: {data.labels.length}</li>
                                    <li>Datasets: {data.datasets.length}</li>
                                    <li>
                                        Total Data Points:{" "}
                                        {data.labels.length *
                                            data.datasets.length}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                        <button
                            type="button"
                            onClick={handleSave}
                            className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <svg
                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 -ml-1 h-4 w-4" />
                                    Save Dataset
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-3 inline-flex w-full justify-center rounded-md bg-gray-700 px-3 py-2 text-sm font-medium text-gray-300 shadow-sm hover:bg-gray-600 sm:mt-0 sm:w-auto"
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
