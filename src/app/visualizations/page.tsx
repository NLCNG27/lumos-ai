"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { BarChart2, AlertTriangle, Save, Database } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import MainMenu from "@/app/components/MainMenu";
import dynamic from "next/dynamic";
import CSVUploader from "@/app/components/visualizations/CSVUploader";
import SavedDatasetList from "@/app/components/visualizations/SavedDatasetList";
import SaveDatasetModal from "@/app/components/visualizations/SaveDatasetModal";
import {
    ChartDataType,
    DatasetItem,
    SavedDataset,
} from "@/app/types/visualization";
import { useAuth } from "@clerk/nextjs";

// Dynamically import the DataVisualizer component to reduce initial load time
const DataVisualizer = dynamic(
    () => import("@/app/components/visualizations/DataVisualizer"),
    {
        ssr: false,
        loading: () => (
            <div className="flex justify-center items-center h-[400px] bg-gray-900/50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        ),
    }
);

// Color palette for dataset statistics
const colorClasses = [
    "text-blue-400", // Blue
    "text-green-400", // Green
    "text-orange-400", // Orange
    "text-pink-400", // Pink
    "text-purple-400", // Purple
    "text-yellow-400", // Yellow
    "text-sky-400", // Sky
    "text-rose-400", // Rose
    "text-teal-400", // Teal
    "text-violet-400", // Violet
    "text-amber-400", // Amber
    "text-cyan-400", // Cyan
    "text-indigo-400", // Indigo
];

// Function to get TailwindCSS color class for a dataset index
const getColorClass = (index: number): string => {
    return colorClasses[index % colorClasses.length];
};

export default function VisualizationsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<ChartDataType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isUsingCustomData, setIsUsingCustomData] = useState(false);
    const [filename, setFilename] = useState<string | null>(null);
    const [dataSize, setDataSize] = useState<string | null>(null);
    const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
    const [renderDuration, setRenderDuration] = useState<number | null>(null);

    // New state for dataset saving/loading
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showDatasetSidebar, setShowDatasetSidebar] = useState(false);
    const [activeSavedDataset, setActiveSavedDataset] =
        useState<SavedDataset | null>(null);

    const { isSignedIn } = useAuth();

    // Track performance metrics
    useEffect(() => {
        if (data && !isLoading) {
            setRenderStartTime(performance.now());

            return () => {
                if (renderStartTime) {
                    const duration = performance.now() - renderStartTime;
                    setRenderDuration(duration);
                }
            };
        }
    }, [data, isLoading]);

    useEffect(() => {
        if (!isUsingCustomData && !activeSavedDataset) {
            fetchSampleData();
        }
    }, [isUsingCustomData, activeSavedDataset]);

    const fetchSampleData = async () => {
        try {
            setIsLoading(true);
            setError(null);
            setRenderDuration(null);
            setActiveSavedDataset(null);

            const response = await fetch("/api/csv");

            if (!response.ok) {
                throw new Error("Failed to fetch data");
            }

            const result = await response.json();
            setData(result);
            setFilename(null);

            // Calculate data size metrics
            calculateDataMetrics(result);
        } catch (err) {
            setError("Error loading sample data. Please try again later.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateDataMetrics = (chartData: ChartDataType) => {
        if (!chartData || !chartData.datasets) return;

        // Calculate total number of data points
        const totalDataPoints = chartData.datasets.reduce(
            (sum, dataset) => sum + dataset.data.length,
            0
        );

        setDataSize(
            `${chartData.labels.length} labels × ${chartData.datasets.length} datasets (${totalDataPoints} data points)`
        );
    };

    const handleFileUploadStart = () => {
        setIsLoading(true);
        setError(null);
        setRenderDuration(null);
        setActiveSavedDataset(null);
    };

    const handleDataLoaded = (uploadedData: ChartDataType) => {
        setData(uploadedData);
        setIsLoading(false);
        setIsUsingCustomData(true);

        // Calculate data size metrics
        calculateDataMetrics(uploadedData);
    };

    const handleUploadError = (errorMessage: string) => {
        setError(errorMessage);
        setIsLoading(false);
    };

    const handleResetToSample = () => {
        setIsUsingCustomData(false);
        setActiveSavedDataset(null);
    };

    // New handlers for dataset operations
    const handleToggleDatasetSidebar = () => {
        setShowDatasetSidebar(!showDatasetSidebar);
    };

    const handleSaveDataset = () => {
        if (!data) return;
        setShowSaveModal(true);
    };

    const handleSaveSuccess = () => {
        setShowSaveModal(false);
        // Update the sidebar if it's open
        if (showDatasetSidebar) {
            // The datasets will refresh automatically due to the component's useEffect
        }
    };

    const handleSelectDataset = (dataset: SavedDataset) => {
        setIsLoading(true);
        setError(null);
        setRenderDuration(null);
        setIsUsingCustomData(false);

        try {
            // Process the dataset
            const loadedData = dataset.data;
            setData(loadedData);
            setFilename(dataset.name);
            setActiveSavedDataset(dataset);

            // Calculate metrics
            calculateDataMetrics(loadedData);
        } catch (err) {
            console.error("Error loading dataset:", err);
            setError("Failed to load the selected dataset");
        } finally {
            setIsLoading(false);
        }
    };

    const renderStats = (datasetIndex: number, colorClass: string) => {
        if (!data || !data.datasets[datasetIndex]) return null;

        const dataset = data.datasets[datasetIndex];

        // Use a safer approach to calculate stats
        let sum = 0;
        let max = Number.NEGATIVE_INFINITY;
        let min = Number.POSITIVE_INFINITY;

        // Loop through data array to find min, max, and sum
        for (let i = 0; i < dataset.data.length; i++) {
            const value = dataset.data[i];
            // Skip non-numeric values
            if (typeof value !== "number" || isNaN(value)) continue;

            sum += value;
            if (value > max) max = value;
            if (value < min) min = value;
        }

        // Calculate average
        const average =
            dataset.data.length > 0
                ? (sum / dataset.data.length).toFixed(2)
                : "0";

        return (
            <div>
                <p className="mb-2">
                    <span className={`font-medium ${colorClass}`}>
                        Average:{" "}
                    </span>
                    {average}
                </p>
                <p className="mb-2">
                    <span className={`font-medium ${colorClass}`}>Max: </span>
                    {max !== Number.NEGATIVE_INFINITY ? max : "N/A"}
                </p>
                <p>
                    <span className={`font-medium ${colorClass}`}>Min: </span>
                    {min !== Number.POSITIVE_INFINITY ? min : "N/A"}
                </p>
            </div>
        );
    };

    // Use memoization to prevent unnecessary re-renders of the analysis panes
    const analysisPane = useMemo(() => {
        if (!data || !data.datasets.length) return null;

        // Get number of datasets to display (cap at 4 for UI simplicity)
        const maxDatasets = Math.min(data.datasets.length, 4);
        const gridCols = maxDatasets <= 2 ? "md:grid-cols-2" : "md:grid-cols-4";

        return (
            <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
                {data.datasets
                    .slice(0, maxDatasets)
                    .map((dataset: DatasetItem, index: number) => (
                        <div
                            key={index}
                            className="bg-gray-900 rounded-lg border border-gray-800 p-6"
                        >
                            <h2 className="text-xl font-semibold mb-4">
                                {dataset.label} Analysis
                            </h2>
                            <p className="text-gray-400 mb-2">
                                Statistics for {dataset.label} across{" "}
                                {data.labels.length} data points.
                            </p>
                            {renderStats(index, getColorClass(index))}
                        </div>
                    ))}
            </div>
        );
    }, [data]);

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <Navbar />
            <MainMenu />

            <div className="ml-16 pt-16 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold">
                                Data Visualizations
                            </h1>
                            {dataSize && !isLoading && (
                                <p className="text-gray-400 text-sm mt-1">
                                    {dataSize}
                                </p>
                            )}
                        </div>

                        <div className="flex space-x-2">
                            {isSignedIn && (
                                <button
                                    onClick={handleToggleDatasetSidebar}
                                    className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                                        showDatasetSidebar
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-800 text-white hover:bg-gray-700"
                                    }`}
                                >
                                    <Database className="mr-1.5 h-4 w-4" />
                                    Saved Datasets
                                </button>
                            )}

                            {(isUsingCustomData || activeSavedDataset) && (
                                <button
                                    onClick={handleResetToSample}
                                    className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                                >
                                    Use Sample Data
                                </button>
                            )}

                            {isSignedIn && data && !isLoading && (
                                <button
                                    onClick={handleSaveDataset}
                                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center"
                                >
                                    <Save className="mr-1.5 h-4 w-4" />
                                    Save Dataset
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Main content area */}
                        <div
                            className={`flex-1 ${
                                showDatasetSidebar ? "md:w-2/3" : "w-full"
                            }`}
                        >
                            {!activeSavedDataset &&
                                !isUsingCustomData &&
                                !isLoading &&
                                !error && (
                                    <div className="mb-6">
                                        <CSVUploader
                                            onDataLoaded={handleDataLoaded}
                                            onUploadStart={
                                                handleFileUploadStart
                                            }
                                            onUploadError={handleUploadError}
                                        />
                                    </div>
                                )}

                            {error && (
                                <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6 flex items-start">
                                    <AlertTriangle className="text-red-500 mr-3 h-5 w-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="font-medium text-red-400">
                                            Error
                                        </h3>
                                        <p className="text-red-300 mt-1">
                                            {error}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!error && data && !isLoading && (
                                <div className="space-y-6">
                                    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                                        <div className="p-3 border-b border-gray-800">
                                            <h2 className="font-medium flex items-center">
                                                <BarChart2 className="mr-2 h-5 w-5 text-blue-500" />
                                                {activeSavedDataset
                                                    ? activeSavedDataset.name
                                                    : filename
                                                    ? `CSV: ${filename}`
                                                    : "Chart Visualization"}
                                            </h2>
                                        </div>
                                        <div className="p-4">
                                            <DataVisualizer data={data} />
                                        </div>
                                    </div>

                                    {analysisPane}

                                    {renderDuration !== null && (
                                        <div className="text-xs text-gray-500 text-right">
                                            Chart rendered in{" "}
                                            {renderDuration.toFixed(2)}ms
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Saved datasets sidebar */}
                        {showDatasetSidebar && (
                            <div className="md:w-1/3 flex-shrink-0 md:max-w-sm">
                                <SavedDatasetList
                                    onSelectDataset={handleSelectDataset}
                                    onSaveCurrentDataset={handleSaveDataset}
                                    hasCurrentDataset={!!data && !isLoading}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Dataset Modal */}
            {showSaveModal && data && (
                <SaveDatasetModal
                    data={data}
                    onClose={() => setShowSaveModal(false)}
                    onSuccess={handleSaveSuccess}
                    filename={filename}
                />
            )}
        </div>
    );
}
