import React, { useState, useEffect } from 'react';
import { downloadCode } from '@/app/lib/fileUtils';
import FilenameDialog from './FilenameDialog';

interface DownloadButtonProps {
  content: string;
  language: string;
  suggestedFilename?: string;
  className?: string;
  highlightAttention?: boolean;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  content,
  language,
  suggestedFilename = `file.${language}`,
  className = '',
  highlightAttention = false
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAttention, setShowAttention] = useState(highlightAttention);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // If highlightAttention prop changes, update showAttention
  useEffect(() => {
    setShowAttention(highlightAttention);
  }, [highlightAttention]);
  
  // When user interacts with the button, stop showing attention animation
  const handleMouseOver = () => {
    if (showAttention) {
      setShowAttention(false);
    }
  };
  
  const handleDownload = (e: React.MouseEvent) => {
    // If user holds Shift key while clicking, show the filename dialog
    if (e.shiftKey) {
      setIsDialogOpen(true);
      return;
    }
    
    // Otherwise download directly
    downloadWithFilename(suggestedFilename);
  };
  
  const downloadWithFilename = (filename: string) => {
    setIsDownloading(true);
    setShowAttention(false);
    
    try {
      downloadCode(content, language, filename);
    } catch (error) {
      console.error('Error downloading file:', error);
    } finally {
      // Reset the downloading state after a short delay
      setTimeout(() => setIsDownloading(false), 1000);
    }
  };
  
  return (
    <>
      <button
        onClick={handleDownload}
        onMouseOver={handleMouseOver}
        disabled={isDownloading}
        className={`download-button text-gray-400 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700 ${className} ${
          isDownloading ? 'opacity-70 cursor-not-allowed' : ''
        } ${showAttention ? 'animate-attention' : ''}`}
        title={`Download as ${suggestedFilename} (Shift+Click to rename)`}
      >
        {isDownloading ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Downloading...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </>
        )}
      </button>
      
      <FilenameDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={downloadWithFilename}
        suggestedFilename={suggestedFilename}
      />
    </>
  );
};

export default DownloadButton; 