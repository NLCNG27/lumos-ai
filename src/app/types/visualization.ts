// Define the chart data type
export type ChartDataType = {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
    }[];
};

// Define dataset item type
export type DatasetItem = {
    label: string;
    data: number[];
};

// Define comparison view type for multi-chart comparisons
export type ComparisonView = {
    id: string;
    chartType: "line" | "bar" | "area" | "scatter" | "bubble";
    title: string;
    selectedDatasets: number[]; // Indices of selected datasets
};

// Define saved dataset type for database
export type SavedDataset = {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    data: ChartDataType;
    size: number;
    row_count: number;
    column_count: number;
    created_at: string;
    updated_at: string;
    is_favorite: boolean;
};
