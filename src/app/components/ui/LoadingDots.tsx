"use client";

import { useEffect, useState } from "react";

interface LoadingDotsProps {
  color?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function LoadingDots({ 
  color = "text-blue-400", 
  size = 'medium' 
}: LoadingDotsProps) {
  const [dots, setDots] = useState("");
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots.length >= 3) {
          return "";
        }
        return prevDots + ".";
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, []);
  
  // Determine size classes based on size prop
  const dotSizeClass = {
    small: 'w-1.5 h-1.5 mx-0.5',
    medium: 'w-2 h-2 mx-1',
    large: 'w-2.5 h-2.5 mx-1.5'
  }[size];
  
  return (
    <div className="flex items-center">
      <div className="flex space-x-1">
        <div className={`${dotSizeClass} rounded-full bg-purple-400 ${dots.length >= 1 ? 'animate-pulse' : 'opacity-30'}`}></div>
        <div className={`${dotSizeClass} rounded-full bg-blue-400 ${dots.length >= 2 ? 'animate-pulse' : 'opacity-30'}`}></div>
        <div className={`${dotSizeClass} rounded-full bg-indigo-400 ${dots.length >= 3 ? 'animate-pulse' : 'opacity-30'}`}></div>
      </div>
    </div>
  );
} 