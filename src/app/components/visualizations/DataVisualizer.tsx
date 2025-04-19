"use client";

import { useEffect, useRef, useMemo, useState } from 'react';
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
  Decimation
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { ChartDataType } from '@/app/types/visualization';

// Register Chart.js components including Decimation for large datasets
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Decimation // Add decimation for large datasets
);

// Color palette for multiple datasets
const colorPalettes = {
  // Main colors for datasets (more vibrant for primary series)
  backgroundColors: [
    'rgba(59, 130, 246, 0.5)',   // Blue
    'rgba(16, 185, 129, 0.5)',   // Green
    'rgba(249, 115, 22, 0.5)',   // Orange
    'rgba(236, 72, 153, 0.5)',   // Pink
    'rgba(139, 92, 246, 0.5)',   // Purple
    'rgba(234, 179, 8, 0.5)',    // Yellow
    'rgba(14, 165, 233, 0.5)',   // Sky
    'rgba(244, 63, 94, 0.5)',    // Rose
    'rgba(20, 184, 166, 0.5)',   // Teal
    'rgba(168, 85, 247, 0.5)',   // Violet
    'rgba(251, 146, 60, 0.5)',   // Amber
    'rgba(45, 212, 191, 0.5)',   // Cyan
    'rgba(99, 102, 241, 0.5)',   // Indigo
  ],
  // Border colors (solid versions of the background colors)
  borderColors: [
    'rgba(59, 130, 246, 1)',    // Blue
    'rgba(16, 185, 129, 1)',    // Green
    'rgba(249, 115, 22, 1)',    // Orange
    'rgba(236, 72, 153, 1)',    // Pink
    'rgba(139, 92, 246, 1)',    // Purple
    'rgba(234, 179, 8, 1)',     // Yellow
    'rgba(14, 165, 233, 1)',    // Sky
    'rgba(244, 63, 94, 1)',     // Rose
    'rgba(20, 184, 166, 1)',    // Teal
    'rgba(168, 85, 247, 1)',    // Violet
    'rgba(251, 146, 60, 1)',    // Amber
    'rgba(45, 212, 191, 1)',    // Cyan
    'rgba(99, 102, 241, 1)',    // Indigo
  ],
};

// Function to get color for a dataset index (cycles through the color palette)
const getDatasetColor = (index: number, isBackground: boolean = true) => {
  const palette = isBackground ? colorPalettes.backgroundColors : colorPalettes.borderColors;
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
      if (typeof data[j] === 'number' && !isNaN(data[j])) {
        sum += data[j];
        count++;
      }
    }
    result.push(count > 0 ? sum / count : 0);
  }
  
  return result;
};

// Function to downsample labels accordingly
const downsampleLabels = (labels: string[], maxDataPoints: number): string[] => {
  if (labels.length <= maxDataPoints) return labels;
  
  const factor = Math.ceil(labels.length / maxDataPoints);
  const result: string[] = [];
  
  for (let i = 0; i < labels.length; i += factor) {
    result.push(labels[i]);
  }
  
  return result;
};

export default function DataVisualizer({ data }: { data: ChartDataType | null }) {
  const chartRef = useRef<ChartJS>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Reset chart on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  if (!data) {
    return <div>No data available</div>;
  }

  // Memoize data sanitization to prevent unnecessary re-processing
  const sanitizedData = useMemo(() => {
    const MAX_DATA_POINTS = 1000; // Threshold for downsampling
    
    // Validate and clean data to prevent errors
    const sanitizedDatasets = data.datasets.map(dataset => {
      // Ensure data array doesn't contain invalid values
      const cleanData = dataset.data
        .map(value => typeof value === 'number' && !isNaN(value) ? value : null)
        .filter(value => value !== null) as number[];
      
      // Downsample if necessary
      const downsampledData = downsampleData(cleanData, MAX_DATA_POINTS);
      
      return {
        ...dataset,
        data: downsampledData
      };
    });
    
    // Downsample labels if necessary
    const downsampledLabels = downsampleLabels(data.labels || [], MAX_DATA_POINTS);
    
    return {
      labels: downsampledLabels,
      datasets: sanitizedDatasets
    };
  }, [data]);

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => ({
    labels: sanitizedData.labels,
    datasets: sanitizedData.datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      backgroundColor: getDatasetColor(index, true),
      borderColor: getDatasetColor(index, false),
      borderWidth: chartType === 'line' ? 2 : 0,
      tension: 0.4,
      fill: false,
      // Performance optimization - only draw points if there are few data points
      pointRadius: dataset.data.length > 100 ? 0 : 3,
      pointHoverRadius: 5
    }))
  }), [sanitizedData, chartType]);

  // Memoize chart options to prevent unnecessary re-renders
  const options: ChartOptions<'line' | 'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: sanitizedData.labels.length > 100 ? 0 : 1000 // Disable animation for large datasets
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          // Limit the number of ticks for better performance
          maxTicksLimit: 8
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          // Reduce number of grid lines for better performance
          tickLength: 8
        }
      },
      x: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          // Show fewer ticks for better performance
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          display: false // Hide x-axis grid lines for better performance
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.9)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        // Limit tooltip information for better performance
        mode: 'index',
        intersect: false
      },
      decimation: {
        enabled: sanitizedData.datasets[0]?.data.length > 500,
        algorithm: 'lttb' // Largest-Triangle-Three-Bucket algorithm
      }
    },
    // Options specific to very large datasets
    elements: {
      line: {
        borderWidth: sanitizedData.labels.length > 1000 ? 1 : 2 // Thinner lines for large datasets
      },
      point: {
        // Hide points completely for extremely large datasets to improve performance
        radius: sanitizedData.labels.length > 2000 ? 0 : undefined
      }
    }
  }), [sanitizedData]);

  const toggleChartType = () => {
    setChartType(prev => prev === 'line' ? 'bar' : 'line');
  };

  return (
    <div className="w-full h-full">
      <div className="flex justify-end mb-2">
        <button 
          onClick={toggleChartType}
          className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        >
          {chartType === 'line' ? 'Switch to Bar Chart' : 'Switch to Line Chart'}
        </button>
      </div>
      <Chart 
        ref={chartRef as any} 
        type={chartType}
        data={chartData} 
        options={options}
        // Use reduced motion to prevent heavy animations
        redraw={false}
      />
    </div>
  );
} 