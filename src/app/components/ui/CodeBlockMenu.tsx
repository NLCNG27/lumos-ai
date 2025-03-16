import React, { useState, useRef, useEffect } from 'react';
import FilenameDialog from './FilenameDialog';
import { downloadCode, suggestFilename } from '@/app/lib/fileUtils';

interface CodeBlockMenuProps {
  codeBlockRef: React.RefObject<HTMLDivElement | null>;
  content: string;
  language: string;
}

const CodeBlockMenu: React.FC<CodeBlockMenuProps> = ({
  codeBlockRef,
  content,
  language,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const suggestedName = suggestFilename(content, language);
  
  const handleContextMenu = (e: MouseEvent) => {
    if (codeBlockRef.current && codeBlockRef.current.contains(e.target as Node)) {
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
      setIsOpen(true);
    }
  };
  
  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };
  
  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsOpen(false);
  };
  
  const handleDownload = () => {
    downloadCode(content, language, suggestedName);
    setIsOpen(false);
  };
  
  const handleSaveAs = () => {
    setIsDialogOpen(true);
    setIsOpen(false);
  };
  
  if (!isOpen) return null;
  
  const menuStyle = {
    top: `${Math.min(position.y, window.innerHeight - 150)}px`,
    left: `${Math.min(position.x, window.innerWidth - 200)}px`,
  };
  
  return (
    <>
      <div 
        ref={menuRef}
        className="fixed z-50 bg-gray-800/95 border border-gray-700 rounded-md shadow-xl py-1 backdrop-blur-sm"
        style={menuStyle}
      >
        <button 
          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
          onClick={handleCopy}
        >
          <svg className="w-4 h-4 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Copy
        </button>
        
        <button 
          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
          onClick={handleDownload}
        >
          <svg className="w-4 h-4 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
        
        <button 
          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
          onClick={handleSaveAs}
        >
          <svg className="w-4 h-4 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16v2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2m6 0v3m0 0H9m4 0h4" />
          </svg>
          Save As...
        </button>
      </div>
      
      <FilenameDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={(filename) => downloadCode(content, language, filename)}
        suggestedFilename={suggestedName}
      />
    </>
  );
};

export default CodeBlockMenu; 