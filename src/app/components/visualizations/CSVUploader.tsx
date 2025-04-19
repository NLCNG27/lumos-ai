"use client";

import { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { ChartDataType } from '@/app/types/visualization';

interface CSVUploaderProps {
  onDataLoaded: (data: ChartDataType) => void;
  onUploadStart: () => void;
  onUploadError: (error: string) => void;
}

export default function CSVUploader({ onDataLoaded, onUploadStart, onUploadError }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  
  // Format file size from bytes to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  };
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      onUploadError('Please upload a CSV file');
      return;
    }
    
    // Show file information
    setFileInfo({
      name: file.name,
      size: formatFileSize(file.size)
    });
    
    // Check file size (10MB limit on server)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      onUploadError(`File size exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit`);
      return;
    }
    
    // Reset any previous upload states
    setUploadProgress(0);
    setIsUploading(true);
    
    // Start the upload process
    handleFileUpload(file);
  };
  
  const handleFileUpload = async (file: File) => {
    try {
      onUploadStart();
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Simulate upload progress for better UX (since FormData doesn't have progress events)
      // This is just for UI feedback - the actual processing happens on the server
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Hold at 90% until processing completes
          }
          return prev + (10 - prev / 10); // Slow down as it progresses
        });
      }, 300);
      
      try {
        const response = await fetch('/api/csv', {
          method: 'POST',
          body: formData,
        });
        
        clearInterval(progressInterval);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload file');
        }
        
        setUploadProgress(100);
        
        // Add a small delay before loading the chart to allow UI to update
        setTimeout(async () => {
          const data = await response.json();
          onDataLoaded(data);
          setIsUploading(false);
          setFileInfo(null);
        }, 500);
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    } catch (error) {
      setIsUploading(false);
      onUploadError(error instanceof Error ? error.message : 'Failed to upload file');
    }
  };
  
  const renderFileInfo = () => {
    if (!fileInfo) return null;
    
    return (
      <div className="mt-4 p-3 bg-gray-800 rounded-md">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-white">{fileInfo.name}</span>
          <span className="text-gray-400">({fileInfo.size})</span>
        </div>
        
        {isUploading && (
          <div className="mt-3">
            <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Uploading & Processing</span>
              <span>{uploadProgress}%</span>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // If we're uploading, show a simplified UI with progress
  if (isUploading) {
    return (
      <div className="border-2 border-gray-700 rounded-lg p-6 text-center">
        <div className="flex flex-col items-center">
          <div className="animate-pulse mb-4">
            <Upload size={32} className="text-blue-500" />
          </div>
          <p className="text-lg font-medium mb-2">Processing your CSV file</p>
          <p className="text-gray-500 text-sm mb-4">
            This may take a moment for large files. Please wait...
          </p>
          {renderFileInfo()}
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        id="csv-file" 
        accept=".csv" 
        className="hidden" 
        onChange={handleFileInput}
      />
      
      <label 
        htmlFor="csv-file" 
        className="cursor-pointer flex flex-col items-center justify-center gap-3"
      >
        <Upload size={40} className="text-gray-400" />
        <div className="text-lg font-medium">
          Drag & drop your CSV file or click to browse
        </div>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Your CSV file should have headers in the first row. The first column will be used as labels (e.g., dates, categories), and other columns will be visualized as data series.
        </p>
        
        <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm">
          <AlertCircle size={16} />
          <span>For optimal performance, files should be under 10MB or 100,000 rows.</span>
        </div>
      </label>
      
      {renderFileInfo()}
    </div>
  );
} 