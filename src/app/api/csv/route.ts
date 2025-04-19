import { NextRequest, NextResponse } from "next/server";

// Constants for optimization
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const MAX_ROWS = 100000; // Maximum rows to process
const MAX_COLUMNS = 50; // Maximum columns to process
const MAX_DATAPOINTS = 5000; // Maximum datapoints (for downsampling)

// Helper function to parse CSV content with optimizations for large files
const parseCSV = async (csvContent: string) => {
    const lines = csvContent.split("\n");
    if (lines.length === 0) {
        throw new Error("CSV file is empty");
    }

    // Limit number of rows to prevent memory issues
    const rowLimit = Math.min(lines.length, MAX_ROWS);

    // Parse headers (first row)
    const allHeaders = lines[0].split(",").map((header) => header.trim());
    if (allHeaders.length === 0) {
        throw new Error("CSV file has no headers");
    }

    // Limit number of columns to prevent memory issues
    const headers = allHeaders.slice(0, MAX_COLUMNS);

    // Pre-allocate array for better memory efficiency
    const data = new Array(rowLimit - 1);

    // Process in chunks for better performance
    const chunkSize = 1000; // Process 1000 lines at a time

    for (let chunkStart = 1; chunkStart < rowLimit; chunkStart += chunkSize) {
        const chunkEnd = Math.min(chunkStart + chunkSize, rowLimit);

        // Process this chunk
        for (let i = chunkStart; i < chunkEnd; i++) {
            if (!lines[i] || !lines[i].trim()) continue; // Skip empty lines

            const values = lines[i]
                .split(",")
                .map((value) => value.trim())
                .slice(0, headers.length);

            if (values.length === headers.length) {
                const row: Record<string, string | number> = {};
                headers.forEach((header, index) => {
                    // Try to convert to number if possible, using faster conversion method
                    const value = values[index];
                    let numValue;

                    // Fast number conversion with validation
                    if (value === "" || value === null) {
                        numValue = 0;
                    } else {
                        // Use the unary plus operator for faster number conversion
                        numValue = +value;
                        if (isNaN(numValue)) {
                            // If not a number, keep the original string
                            numValue = value;
                        }
                    }

                    row[header] = numValue;
                });
                data[i - 1] = row;
            }
        }

        // This artificial delay prevents the event loop from blocking for too long
        // and allows other pending operations to execute
        if (chunkEnd < rowLimit) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    // Filter out null entries from the data array
    const filteredData = data.filter(Boolean);

    if (filteredData.length === 0) {
        throw new Error("CSV file has no valid data rows");
    }

    return { headers, data: filteredData };
};

// Process CSV data into chart-friendly format with optimizations
const processCSVForChart = (parsedData: { headers: string[]; data: any[] }) => {
    const { headers, data } = parsedData;

    // First column is typically labels (like dates, categories, etc.)
    const labelKey = headers[0];

    // Downsample data if too large
    const downsampleFactor = Math.ceil(data.length / MAX_DATAPOINTS) || 1;
    const needsDownsampling = downsampleFactor > 1;

    let labels: string[] = [];
    let datasets: { label: string; data: number[] }[] = [];

    if (needsDownsampling) {
        // Downsample using averaging approach
        labels = new Array(Math.ceil(data.length / downsampleFactor));

        // For each column (except the first one which is labels)
        for (
            let colIndex = 1;
            colIndex < Math.min(headers.length, MAX_COLUMNS);
            colIndex++
        ) {
            const datasetKey = headers[colIndex];
            const dataPoints = new Array(
                Math.ceil(data.length / downsampleFactor)
            );

            // For each downsampled point
            for (let i = 0; i < labels.length; i++) {
                const startIdx = i * downsampleFactor;
                const endIdx = Math.min(
                    startIdx + downsampleFactor,
                    data.length
                );

                // Take the label from the first point in the group
                if (colIndex === 1) {
                    // Only need to do this once
                    labels[i] = String(data[startIdx]?.[labelKey] || "");
                }

                // Average the values in this group
                let sum = 0;
                let count = 0;
                for (let j = startIdx; j < endIdx; j++) {
                    const value = data[j]?.[datasetKey];
                    if (typeof value === "number" && !isNaN(value)) {
                        sum += value;
                        count++;
                    }
                }

                dataPoints[i] = count > 0 ? sum / count : 0;
            }

            datasets.push({
                label: datasetKey,
                data: dataPoints,
            });
        }
    } else {
        // No downsampling needed
        labels = data.map((row) => String(row[labelKey] || ""));

        // Rest of columns are datasets
        for (let i = 1; i < Math.min(headers.length, MAX_COLUMNS); i++) {
            const datasetKey = headers[i];
            const dataPoints = data.map((row) => {
                // Ensure we have a valid number
                const value = row[datasetKey];
                return typeof value === "number" && !isNaN(value) ? value : 0;
            });

            datasets.push({
                label: datasetKey,
                data: dataPoints,
            });
        }
    }

    // Default empty datasets if no valid data found
    if (datasets.length === 0) {
        datasets.push({
            label: "No Data",
            data: Array(labels.length).fill(0),
        });
    }

    return {
        labels,
        datasets,
    };
};

// Generate sample data when no file is provided
const generateSampleData = () => {
    // Generate random monthly data for the last 12 months
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];
    const currentMonth = new Date().getMonth();

    // Organize the months so we start from 12 months ago until current month
    const labels = Array.from({ length: 12 }, (_, i) => {
        const monthIndex = (currentMonth - 11 + i + 12) % 12;
        return months[monthIndex];
    });

    // Generate random metrics (avoid very large numbers that might cause stack overflow)
    const values1 = Array.from({ length: 12 }, () =>
        Math.floor(Math.random() * 100)
    );
    const values2 = Array.from({ length: 12 }, () =>
        Math.floor(Math.random() * 80)
    );

    return {
        labels,
        datasets: [
            {
                label: "Dataset 1",
                data: values1,
            },
            {
                label: "Dataset 2",
                data: values2,
            },
        ],
    };
};

export async function GET(request: NextRequest) {
    try {
        // Return sample data for GET requests
        const data = generateSampleData();

        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        console.error("Error processing sample data:", error);
        return NextResponse.json(
            { error: "Failed to generate sample data" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Check if it's a CSV file
        if (!file.name.endsWith(".csv")) {
            return NextResponse.json(
                { error: "Please upload a CSV file" },
                { status: 400 }
            );
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    error: `File size exceeds the ${
                        MAX_FILE_SIZE / (1024 * 1024)
                    }MB limit`,
                },
                { status: 400 }
            );
        }

        try {
            // Read the file content
            const fileContent = await file.text();

            // Parse the CSV asynchronously
            const parsedData = await parseCSV(fileContent);

            // Process data for chart
            const chartData = processCSVForChart(parsedData);

            return NextResponse.json(chartData, { status: 200 });
        } catch (error) {
            console.error("Error parsing CSV:", error);
            // Return a more specific error message when possible
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to process CSV file";
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }
    } catch (error) {
        console.error("Error processing CSV file:", error);
        return NextResponse.json(
            { error: "Failed to process CSV file" },
            { status: 500 }
        );
    }
}
