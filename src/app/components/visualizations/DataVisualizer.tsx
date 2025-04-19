"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
    ChartData,
    Decimation,
    ArcElement,
    RadialLinearScale,
    BubbleController,
    ScatterController,
    LineController,
    BarController,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { ChartDataType } from "@/app/types/visualization";

// Register Chart.js components including Decimation for large datasets
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    BubbleController,
    ScatterController,
    LineController,
    BarController,
    Title,
    Tooltip,
    Legend,
    Decimation // Add decimation for large datasets
);

// Color palette for multiple datasets
const colorPalettes = {
    // Main colors for datasets (more vibrant for primary series)
    backgroundColors: [
        "rgba(59, 130, 246, 0.5)", // Blue
        "rgba(16, 185, 129, 0.5)", // Green
        "rgba(249, 115, 22, 0.5)", // Orange
        "rgba(236, 72, 153, 0.5)", // Pink
        "rgba(139, 92, 246, 0.5)", // Purple
        "rgba(234, 179, 8, 0.5)", // Yellow
        "rgba(14, 165, 233, 0.5)", // Sky
        "rgba(244, 63, 94, 0.5)", // Rose
        "rgba(20, 184, 166, 0.5)", // Teal
        "rgba(168, 85, 247, 0.5)", // Violet
        "rgba(251, 146, 60, 0.5)", // Amber
        "rgba(45, 212, 191, 0.5)", // Cyan
        "rgba(99, 102, 241, 0.5)", // Indigo
    ],
    // Border colors (solid versions of the background colors)
    borderColors: [
        "rgba(59, 130, 246, 1)", // Blue
        "rgba(16, 185, 129, 1)", // Green
        "rgba(249, 115, 22, 1)", // Orange
        "rgba(236, 72, 153, 1)", // Pink
        "rgba(139, 92, 246, 1)", // Purple
        "rgba(234, 179, 8, 1)", // Yellow
        "rgba(14, 165, 233, 1)", // Sky
        "rgba(244, 63, 94, 1)", // Rose
        "rgba(20, 184, 166, 1)", // Teal
        "rgba(168, 85, 247, 1)", // Violet
        "rgba(251, 146, 60, 1)", // Amber
        "rgba(45, 212, 191, 1)", // Cyan
        "rgba(99, 102, 241, 1)", // Indigo
    ],
};

// Function to get color for a dataset index (cycles through the color palette)
const getDatasetColor = (index: number, isBackground: boolean = true) => {
    const palette = isBackground
        ? colorPalettes.backgroundColors
        : colorPalettes.borderColors;
    return palette[index % palette.length];
};

// Function to downsample data if it exceeds a threshold
const downsampleData = (data: number[], maxDataPoints: number): number[] => {
    if (data.length <= maxDataPoints) return data;

    const factor = Math.ceil(data.length / maxDataPoints);
    const result: number[] = [];

    for (let i = 0; i < data.length; i += factor) {
        // Calculate average for this group
        let sum = 0;
        let count = 0;
        for (let j = i; j < i + factor && j < data.length; j++) {
            if (typeof data[j] === "number" && !isNaN(data[j])) {
                sum += data[j];
                count++;
            }
        }
        result.push(count > 0 ? sum / count : 0);
    }

    return result;
};

// Function to downsample labels accordingly
const downsampleLabels = (
    labels: string[],
    maxDataPoints: number
): string[] => {
    if (labels.length <= maxDataPoints) return labels;

    const factor = Math.ceil(labels.length / maxDataPoints);
    const result: string[] = [];

    for (let i = 0; i < labels.length; i += factor) {
        result.push(labels[i]);
    }

    return result;
};

export default function DataVisualizer({
    data,
}: {
    data: ChartDataType | null;
}) {
    const chartRef = useRef<ChartJS>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chartType, setChartType] = useState<"line" | "bar" | "area" | "scatter" | "bubble">("line");
    const [zoomRange, setZoomRange] = useState<[number, number]>([0, 100]); // [start, end] percentages
    const [copyStatus, setCopyStatus] = useState<string | null>(null);
    const [showChartOptions, setShowChartOptions] = useState(false);
    const [renderError, setRenderError] = useState(false);

    // Reset chart on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, []);

    // Error handling for chart rendering
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            // Check if the error is related to Chart.js
            if (event.message && (
                event.message.includes('Cannot set properties of undefined (setting \'cp1x\')') ||
                event.message.includes('Chart.js') ||
                event.message.includes('updateControlPoints')
            )) {
                console.error('Chart rendering error detected:', event.message);
                setRenderError(true);
                // Prevent the error from bubbling up
                event.preventDefault();
                event.stopPropagation();
            }
        };

        // Add global error handler
        window.addEventListener('error', handleError);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleError);
        };
    }, []);

    // Reset error state when data or chart type changes
    useEffect(() => {
        setRenderError(false);
    }, [chartType, data]);

    if (!data) {
        return <div>No data available</div>;
    }

    // Memoize data sanitization to prevent unnecessary re-processing
    const sanitizedData = useMemo(() => {
        const MAX_DATA_POINTS = 1000; // Threshold for downsampling

        // Validate and clean data to prevent errors
        const sanitizedDatasets = data.datasets.map((dataset) => {
            // Ensure data array doesn't contain invalid values
            const cleanData = dataset.data
                .map((value) =>
                    typeof value === "number" && !isNaN(value) ? value : null
                )
                .filter((value) => value !== null) as number[];

            // Downsample if necessary
            const downsampledData = downsampleData(cleanData, MAX_DATA_POINTS);

            return {
                ...dataset,
                data: downsampledData,
            };
        });

        // Downsample labels if necessary
        const downsampledLabels = downsampleLabels(
            data.labels || [],
            MAX_DATA_POINTS
        );

        return {
            labels: downsampledLabels,
            datasets: sanitizedDatasets,
        };
    }, [data]);

    // Calculate visible data range based on zoom slider
    const visibleDataRange = useMemo(() => {
        if (!sanitizedData.labels || sanitizedData.labels.length === 0) {
            return { startIndex: 0, endIndex: 0 };
        }

        const totalPoints = sanitizedData.labels.length;
        const startIndex = Math.floor((zoomRange[0] / 100) * (totalPoints - 1));
        const endIndex = Math.ceil((zoomRange[1] / 100) * (totalPoints - 1));

        return { startIndex, endIndex };
    }, [sanitizedData.labels, zoomRange]);

    // Memoize chart data to prevent unnecessary re-renders
    const chartData = useMemo(() => {
        const { startIndex, endIndex } = visibleDataRange;
        const visibleLabels = sanitizedData.labels.slice(
            startIndex,
            endIndex + 1
        );

        // For scatter and bubble charts, we need to transform the data
        if (chartType === "scatter" || chartType === "bubble") {
            return {
                datasets: sanitizedData.datasets.map((dataset, index) => {
                    const visibleData = dataset.data.slice(startIndex, endIndex + 1);
                    
                    // For scatter plots, convert to {x, y} format
                    if (chartType === "scatter") {
                        return {
                            label: dataset.label,
                            data: visibleData.map((value, i) => ({
                                x: i, // Use index as x value or convert to date if needed
                                y: value,
                            })),
                            backgroundColor: getDatasetColor(index, true),
                            borderColor: getDatasetColor(index, false),
                        };
                    }
                    
                    // For bubble charts, include a random size (r) property
                    return {
                        label: dataset.label,
                        data: visibleData.map((value, i) => ({
                            x: i, // Use index as x value
                            y: value,
                            r: Math.max(4, Math.min(20, value / 1000000000)), // Scale the bubble size based on value
                        })),
                        backgroundColor: getDatasetColor(index, true),
                        borderColor: getDatasetColor(index, false),
                    };
                }),
            };
        }

        // For regular charts (line, bar, area)
        return {
            labels: visibleLabels,
            datasets: sanitizedData.datasets.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.data.slice(startIndex, endIndex + 1),
                backgroundColor: getDatasetColor(index, true),
                borderColor: getDatasetColor(index, false),
                borderWidth: chartType === "line" || chartType === "area" ? 2 : 0,
                // Only apply tension when there are enough points and for line/area charts
                tension: (chartType === "line" || chartType === "area") && visibleLabels.length > 2 ? 0.4 : 0,
                fill: chartType === "area" ? true : false,
                // Performance optimization - only draw points if there are few data points
                pointRadius: visibleLabels.length > 100 ? 0 : 3,
                pointHoverRadius: 5,
            })),
        };
    }, [sanitizedData, chartType, visibleDataRange]);

    // Determine the actual chart type to pass to Chart.js
    const actualChartType = useMemo(() => {
        switch (chartType) {
            case "area":
                return "line"; // Area chart is a line chart with fill=true
            case "scatter":
                return "scatter";
            case "bubble":
                return "bubble";
            default:
                return chartType;
        }
    }, [chartType]);

    // Memoize chart options to prevent unnecessary re-renders
    const options: ChartOptions<"line" | "bar"> = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: sanitizedData.labels.length > 100 ? 0 : 1000, // Disable animation for large datasets
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "rgba(255, 255, 255, 0.7)",
                        // Limit the number of ticks for better performance
                        maxTicksLimit: 8,
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.1)",
                        // Reduce number of grid lines for better performance
                        tickLength: 8,
                    },
                },
                x: {
                    ticks: {
                        color: "rgba(255, 255, 255, 0.7)",
                        // Show fewer ticks for better performance
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10,
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.1)",
                        display: false, // Hide x-axis grid lines for better performance
                    },
                },
            },
            plugins: {
                legend: {
                    position: "top" as const,
                    labels: {
                        color: "rgba(255, 255, 255, 0.9)",
                        font: {
                            size: 12,
                        },
                        // Optimize legend by showing fewer items for many datasets
                        boxWidth: sanitizedData.datasets.length > 8 ? 8 : 12,
                        padding: sanitizedData.datasets.length > 8 ? 8 : 12,
                    },
                    // For many datasets, display legend in multiple rows
                    display: true,
                },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    titleColor: "white",
                    bodyColor: "white",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    // Limit tooltip information for better performance
                    mode: "index",
                    intersect: false,
                },
                decimation: {
                    enabled: sanitizedData.datasets[0]?.data.length > 500,
                    algorithm: "lttb", // Largest-Triangle-Three-Bucket algorithm
                },
            },
            // Options specific to very large datasets
            elements: {
                line: {
                    borderWidth: sanitizedData.labels.length > 1000 ? 1 : 2, // Thinner lines for large datasets
                    tension: sanitizedData.labels.length <= 2 ? 0 : undefined, // Prevent tension calculation for very small datasets
                },
                point: {
                    // Hide points completely for extremely large datasets to improve performance
                    radius: sanitizedData.labels.length > 2000 ? 0 : undefined,
                },
            },
        }),
        [sanitizedData]
    );

    const toggleChartOptions = () => {
        setShowChartOptions(!showChartOptions);
    };

    const selectChartType = (type: "line" | "bar" | "area" | "scatter" | "bubble") => {
        setChartType(type);
        setShowChartOptions(false);
    };

    const handleZoomChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        isEnd: boolean
    ) => {
        const newValue = parseInt(e.target.value, 10);

        setZoomRange((prev) => {
            // Ensure minimum visible range (at least 5% of data)
            const MIN_RANGE = 5;

            if (isEnd) {
                // Adjusting end value
                if (newValue <= prev[0] + MIN_RANGE) {
                    return [prev[0], prev[0] + MIN_RANGE];
                }
                return [prev[0], newValue];
            } else {
                // Adjusting start value
                if (newValue >= prev[1] - MIN_RANGE) {
                    return [prev[1] - MIN_RANGE, prev[1]];
                }
                return [newValue, prev[1]];
            }
        });
    };

    const resetZoom = () => {
        setZoomRange([0, 100]);
    };

    const copyChartToClipboard = async () => {
        if (!chartRef.current || !chartContainerRef.current) return;
        
        try {
            // Get chart canvas
            const canvas = chartRef.current.canvas;
            
            // Create a new canvas with background
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;
            const ctx = exportCanvas.getContext('2d');
            
            if (!ctx) return;
            
            // Fill background
            ctx.fillStyle = '#111827'; // Dark background matching the theme
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            
            // Draw the original canvas content onto the export canvas
            ctx.drawImage(canvas, 0, 0);
            
            // Convert to blob
            const blob = await new Promise<Blob | null>(resolve => {
                exportCanvas.toBlob(resolve, 'image/png');
            });
            
            if (!blob) {
                throw new Error('Failed to create image');
            }
            
            // Copy to clipboard using Clipboard API
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            
            setCopyStatus('success');
            setTimeout(() => setCopyStatus(null), 2000);
        } catch (err) {
            console.error('Failed to copy chart:', err);
            setCopyStatus('error');
            setTimeout(() => setCopyStatus(null), 2000);
        }
    };

    return (
        <div className="w-full h-full">
            <div className="flex justify-between mb-2 items-center">
                <div className="text-sm text-gray-300">
                    {sanitizedData.labels && sanitizedData.labels.length > 0
                        ? `Showing ${
                              visibleDataRange.endIndex -
                              visibleDataRange.startIndex +
                              1
                          } of ${sanitizedData.labels.length} data points`
                        : "No data points"}
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={copyChartToClipboard}
                        className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors flex items-center"
                        title="Copy chart as image"
                    >
                        {copyStatus === 'success' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : copyStatus === 'error' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                        )}
                    </button>
                    <div className="relative">
                        <button
                            onClick={toggleChartOptions}
                            className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors flex items-center"
                        >
                            <span className="mr-1">{
                                chartType === "line" ? "Line Chart" : 
                                chartType === "bar" ? "Bar Chart" : 
                                chartType === "area" ? "Area Chart" : 
                                chartType === "scatter" ? "Scatter Plot" : 
                                "Bubble Chart"
                            }</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        
                        {showChartOptions && (
                            <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10 w-40">
                                <ul className="py-1">
                                    <li>
                                        <button 
                                            onClick={() => selectChartType("line")}
                                            className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-700 ${chartType === "line" ? "bg-gray-700" : ""}`}
                                        >
                                            Line Chart
                                        </button>
                                    </li>
                                    <li>
                                        <button 
                                            onClick={() => selectChartType("area")}
                                            className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-700 ${chartType === "area" ? "bg-gray-700" : ""}`}
                                        >
                                            Area Chart
                                        </button>
                                    </li>
                                    <li>
                                        <button 
                                            onClick={() => selectChartType("bar")}
                                            className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-700 ${chartType === "bar" ? "bg-gray-700" : ""}`}
                                        >
                                            Bar Chart
                                        </button>
                                    </li>
                                    <li>
                                        <button 
                                            onClick={() => selectChartType("scatter")}
                                            className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-700 ${chartType === "scatter" ? "bg-gray-700" : ""}`}
                                        >
                                            Scatter Plot
                                        </button>
                                    </li>
                                    <li>
                                        <button 
                                            onClick={() => selectChartType("bubble")}
                                            className={`block px-4 py-2 text-sm w-full text-left hover:bg-gray-700 ${chartType === "bubble" ? "bg-gray-700" : ""}`}
                                        >
                                            Bubble Chart
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart container with fixed height */}
            <div 
                ref={chartContainerRef} 
                className="h-[420px] w-full bg-gray-900"
            >
                {renderError ? (
                    // Fallback simple chart with no curve tension if we encounter rendering errors
                    <Chart
                        ref={chartRef as any}
                        type="bar"
                        data={{
                            labels: sanitizedData.labels.slice(
                                visibleDataRange.startIndex,
                                visibleDataRange.endIndex + 1
                            ),
                            datasets: sanitizedData.datasets.map((dataset, index) => ({
                                label: dataset.label,
                                data: dataset.data.slice(
                                    visibleDataRange.startIndex,
                                    visibleDataRange.endIndex + 1
                                ),
                                backgroundColor: getDatasetColor(index, true),
                                borderColor: getDatasetColor(index, false),
                                borderWidth: 1
                            })),
                        }}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: { duration: 0 }, // No animation for better stability
                            elements: {
                                line: { tension: 0 }, // No tension
                                point: { radius: 0 } // No points
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: { color: "rgba(255, 255, 255, 0.7)" },
                                    grid: { color: "rgba(255, 255, 255, 0.1)" },
                                },
                                x: {
                                    ticks: { 
                                        color: "rgba(255, 255, 255, 0.7)",
                                        maxRotation: 0,
                                        autoSkip: true,
                                        maxTicksLimit: 10
                                    },
                                    grid: { display: false },
                                },
                            },
                        }}
                        redraw={false}
                        className="w-full h-full"
                    />
                ) : (
                    <Chart
                        ref={chartRef as any}
                        type={actualChartType as any}
                        data={chartData as any}
                        options={{
                            ...options,
                            maintainAspectRatio: false,
                        }}
                        redraw={false}
                        className="w-full h-full"
                    />
                )}
            </div>

            {sanitizedData.labels && sanitizedData.labels.length > 10 && (
                <div className="mt-3">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400">
                            X-Axis Zoom
                        </span>
                        <button
                            onClick={resetZoom}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Reset
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="0"
                            max="95"
                            value={zoomRange[0]}
                            onChange={(e) => handleZoomChange(e, false)}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                            style={{
                                WebkitAppearance: "none",
                                appearance: "none",
                                background:
                                    "linear-gradient(90deg, #1f2937 60%, #3b82f6 60%)",
                                height: "8px",
                                borderRadius: "4px",
                            }}
                        />
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={zoomRange[1]}
                            onChange={(e) => handleZoomChange(e, true)}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                            style={{
                                WebkitAppearance: "none",
                                appearance: "none",
                                background:
                                    "linear-gradient(90deg, #3b82f6 60%, #1f2937 60%)",
                                height: "8px",
                                borderRadius: "4px",
                            }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{zoomRange[0]}%</span>
                        <span>{zoomRange[1]}%</span>
                    </div>

                    {/* Add CSS for slider thumbs */}
                    <style jsx>{`
                        input[type="range"]::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            appearance: none;
                            width: 16px;
                            height: 16px;
                            background: #3b82f6;
                            border-radius: 50%;
                            cursor: pointer;
                            border: 2px solid #111827;
                        }

                        input[type="range"]::-moz-range-thumb {
                            width: 16px;
                            height: 16px;
                            background: #3b82f6;
                            border-radius: 50%;
                            cursor: pointer;
                            border: 2px solid #111827;
                        }

                        input[type="range"]:focus {
                            outline: none;
                        }

                        input[type="range"]:focus::-webkit-slider-thumb {
                            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                        }

                        input[type="range"]:focus::-moz-range-thumb {
                            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
