import React, { useState, useEffect, useMemo } from 'react';

interface DatasetPreviewProps {
  content: string;
  format: string;
  filename: string;
  mimeType: string;
}

const DatasetPreview: React.FC<DatasetPreviewProps> = ({
  content,
  format,
  filename,
  mimeType
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [customFilename, setCustomFilename] = useState(filename);
  const [showFilenameInput, setShowFilenameInput] = useState(false);
  const [expandedView, setExpandedView] = useState(false);

  // Update filename when prop changes
  useEffect(() => {
    setCustomFilename(filename);
  }, [filename]);

  // Parse CSV data for visualization
  const parsedData = useMemo(() => {
    if (!content || format !== 'csv') return { headers: [], rows: [] };

    try {
      const lines = content.trim().split('\n');
      if (lines.length === 0) return { headers: [], rows: [] };

      // Parse CSV, handling quoted values correctly
      const parseCSVLine = (line: string) => {
        const result = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        result.push(currentValue); // Add the last value
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1, Math.min(lines.length, expandedView ? 100 : 11)).map(line => parseCSVLine(line));
      
      return { headers, rows };
    } catch (e) {
      console.error('Error parsing CSV data:', e);
      return { headers: [], rows: [] };
    }
  }, [content, format, expandedView]);

  // Function to handle download
  const handleDownload = () => {
    setIsDownloading(true);
    console.log('Downloading dataset:', { format, filename: customFilename, contentLength: content.length });
    
    try {
      // Create a blob with the content
      const blob = new Blob([content], { type: mimeType });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = customFilename;
      link.style.display = 'none';
      
      // Add the link to the document
      document.body.appendChild(link);
      
      // Trigger the download
      link.click();
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
        setIsDownloading(false);
      }, 500);
    } catch (error) {
      console.error('Error downloading dataset:', error);
      setIsDownloading(false);
      
      // Show an alert if there's an error
      alert('Error downloading the dataset. Please try again.');
    }
  };

  // Function to toggle filename input
  const toggleFilenameInput = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowFilenameInput(!showFilenameInput);
  };

  // Function to handle filename change
  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomFilename(e.target.value);
  };

  // Function to handle filename form submission
  const handleFilenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowFilenameInput(false);
    handleDownload();
  };

  // Toggle expanded view
  const toggleExpandedView = () => {
    setExpandedView(!expandedView);
  };

  // Render table visualization for CSV data
  const renderTableVisualization = () => {
    if (format === 'csv' && parsedData.headers.length > 0 && parsedData.rows.length > 0) {
      // Generate column letters (A, B, C, ...)
      const columnLetters = Array.from({ length: parsedData.headers.length }, (_, i) => 
        String.fromCharCode(65 + i)
      );
      
      return (
        <div className="overflow-x-auto mt-3 mb-2">
          <div className="border border-gray-600 rounded shadow-lg bg-gray-850">
            {/* Spreadsheet toolbar */}
            <div className="flex items-center px-3 py-2 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center space-x-2 text-gray-300">
                <span className="text-sm font-medium">{customFilename}</span>
              </div>
              <div className="ml-auto flex items-center space-x-2">
                <button 
                  onClick={handleDownload}
                  className="text-gray-300 hover:text-white text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button 
                  onClick={toggleExpandedView}
                  className="text-gray-300 hover:text-white text-sm flex items-center"
                >
                  {expandedView ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Show Less
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Show More
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr className="bg-gray-750">
                  {/* Empty cell for row numbers column */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-10 border-r border-gray-700 sticky left-0 bg-gray-750">
                    
                  </th>
                  {/* Column letters */}
                  {columnLetters.map((letter, index) => (
                    <th 
                      key={index} 
                      className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider border-r border-gray-700"
                    >
                      {letter}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-750">
                  {/* Row number header */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-10 border-r border-gray-700 border-t border-gray-700 sticky left-0 bg-gray-750">
                    #
                  </th>
                  {/* Actual headers */}
                  {parsedData.headers.map((header, index) => (
                    <th 
                      key={index} 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-300 tracking-wider border-r border-gray-700 border-t border-gray-700 bg-gray-700"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-800">
                {parsedData.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-800 spreadsheet-row">
                    {/* Row number */}
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-400 font-medium border-r border-gray-700 text-center sticky left-0 bg-gray-750">
                      {rowIndex + 1}
                    </td>
                    {/* Row data */}
                    {row.map((cell, cellIndex) => {
                      // Determine if cell is numeric
                      const isNumeric = !isNaN(parseFloat(cell)) && isFinite(Number(cell));
                      return (
                        <td 
                          key={cellIndex} 
                          className={`px-3 py-2 whitespace-nowrap text-sm text-gray-300 border-r border-gray-700 ${isNumeric ? 'text-right' : 'text-left'} spreadsheet-cell`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Spreadsheet footer */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
              <div>
                {parsedData.rows.length} rows × {parsedData.headers.length} columns
              </div>
              <div>
                {expandedView ? 
                  `Showing ${Math.min(parsedData.rows.length, 100)} of ${content.split('\n').length - 1} rows` : 
                  `Showing ${Math.min(parsedData.rows.length, 10)} of ${content.split('\n').length - 1} rows`
                }
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // For non-CSV data or if parsing failed, show the raw preview
    return renderRawPreview();
  };

  // Determine preview content based on format for non-tabular data
  const renderRawPreview = () => {
    // For large datasets, only show a preview
    const previewLines = content.split('\n').slice(0, 10);
    const hasMoreLines = content.split('\n').length > 10;
    
    return (
      <div className="font-mono text-xs overflow-x-auto max-h-60 bg-gray-800 p-2 rounded">
        {previewLines.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap">{line}</div>
        ))}
        {hasMoreLines && (
          <div className="text-gray-400 mt-2">... {content.split('\n').length - 10} more lines</div>
        )}
      </div>
    );
  };

  console.log('Rendering DatasetPreview:', { format, filename, contentLength: content.length });

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900 mb-4">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mr-2 uppercase">
            {format}
          </div>
          <h3 className="text-white font-medium">{customFilename}</h3>
        </div>
        
        {showFilenameInput ? (
          <form onSubmit={handleFilenameSubmit} className="flex">
            <input
              type="text"
              value={customFilename}
              onChange={handleFilenameChange}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-l px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              className="bg-blue-600 text-white text-sm px-2 py-1 rounded-r hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </form>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={toggleFilenameInput}
              className="text-gray-400 hover:text-white text-sm flex items-center transition-colors"
              title="Rename file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Rename
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="bg-blue-600 text-white text-sm px-3 py-1 rounded hover:bg-blue-700 transition-colors flex items-center"
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* Prominent download instructions */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 mb-4 flex items-center">
        <div className="mr-3 text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm text-blue-300 font-medium">Download this {format.toUpperCase()} dataset</p>
          <p className="text-xs text-blue-400 mt-1">Click the button below to save this file to your computer.</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors animate-attention flex items-center"
        >
          {isDownloading ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Downloading...
            </>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download {format.toUpperCase()} File
            </>
          )}
        </button>
      </div>
      
      {/* Render table visualization for CSV or raw preview for other formats */}
      {format === 'csv' ? renderTableVisualization() : renderRawPreview()}
      
      <div className="mt-3 text-xs text-gray-400">
        {format.toUpperCase()} dataset • {content.length.toLocaleString()} characters • {content.split('\n').length} rows
      </div>
    </div>
  );
};

export default DatasetPreview; 