// Define the chart data type
export type ChartDataType = {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
    }[];
    // Metadata for filtering and column information
    metadata?: {
        columnTypes: Record<string, 'numeric' | 'categorical' | 'date' | 'text'>;
        filterOptions?: Record<string, string[]>; // Available filter values for each categorical field
        // Track which fields/columns are categorical and should only be used for filtering
        categoricalFields?: string[];
        // Track which fields are numeric and should be plotted in charts
        numericFields?: string[];
        // Original column names from the raw data (before processing)
        originalColumns?: string[];
    };
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
    activeFilters?: Record<string, string[]>; // Filters applied to this specific view
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
