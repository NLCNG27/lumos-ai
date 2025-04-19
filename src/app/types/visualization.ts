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