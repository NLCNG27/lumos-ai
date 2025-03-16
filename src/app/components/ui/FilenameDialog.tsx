import React, { useState, useRef, useEffect } from 'react';

interface FilenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filename: string) => void;
  suggestedFilename: string;
}

const FilenameDialog: React.FC<FilenameDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  suggestedFilename,
}) => {
  const [filename, setFilename] = useState(suggestedFilename);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus the input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // Select the filename part without the extension
      const lastDotIndex = suggestedFilename.lastIndexOf('.');
      if (lastDotIndex > 0) {
        inputRef.current.setSelectionRange(0, lastDotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isOpen, suggestedFilename]);
  
  // Handle pressing Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
  
  const handleSave = () => {
    onSave(filename);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-medium text-white mb-4">Save File</h3>
        
        <div className="mb-4">
          <label htmlFor="filename" className="block text-sm font-medium text-gray-300 mb-2">
            Filename
          </label>
          <input
            ref={inputRef}
            type="text"
            id="filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilenameDialog; 