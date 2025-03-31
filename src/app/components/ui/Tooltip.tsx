"use client";

import { useState } from "react";

type TooltipProps = {
    children: React.ReactNode;
    content: string;
    side?: "top" | "right" | "bottom" | "left";
};

export function Tooltip({ children, content, side = "top" }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    // Determine position based on side
    let positionClasses = "";
    switch (side) {
        case "top":
            positionClasses = "bottom-full left-1/2 -translate-x-1/2 mb-2";
            break;
        case "right":
            positionClasses = "left-full top-1/2 -translate-y-1/2 ml-2";
            break;
        case "bottom":
            positionClasses = "top-full left-1/2 -translate-x-1/2 mt-2";
            break;
        case "left":
            positionClasses = "right-full top-1/2 -translate-y-1/2 mr-2";
            break;
    }

    return (
        <div 
            className="relative flex"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            
            {isVisible && (
                <div 
                    className={`absolute z-50 ${positionClasses} px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded-md shadow-sm pointer-events-none whitespace-nowrap`}
                >
                    {content}
                    <div className="tooltip-arrow"></div>
                </div>
            )}
        </div>
    );
} 