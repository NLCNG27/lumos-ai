import React from "react";
import { Code } from "lucide-react";

interface CodeExecutionToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    className?: string;
}

export default function CodeExecutionToggle({
    enabled,
    onChange,
    className = "",
}: CodeExecutionToggleProps) {
    return (
        <button
            type="button"
            onClick={() => onChange(!enabled)}
            className={`flex items-center justify-center h-8 w-8 text-sm rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative group ${className}`}
            aria-label={
                enabled ? "Disable code execution" : "Enable code execution"
            }
        >
            <Code
                className={`h-5 w-5 ${
                    enabled ? "text-blue-600" : "text-gray-400"
                }`}
            />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-md whitespace-nowrap">
                    Code Execution
                </div>
            </div>
        </button>
    );
}
