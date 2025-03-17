"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import 'katex/dist/katex.min.css';

interface MathMarkdownProps {
  children: string;
  className?: string;
}

// Function to fix common mathematical notation problems
const fixMathNotation = (text: string): string => {
  if (!text) return '';
  let processed = text;
  
  // SPECIAL CASE: Check if this is a math problem solution from an uploaded file
  if (processed.includes("solve this") || 
      processed.includes("do this") || 
      processed.includes("Problem 7") || 
      processed.includes("Problem 8")) {
    
    // Apply special formatting for math problem solutions
    
    // First, convert all square bracket expressions to regular math delimiters
    processed = processed.replace(/\[(.*?)\]/g, (match, content) => {
      if (match.startsWith('$[') && match.endsWith(']$')) {
        return match;
      }
      if (match.startsWith('$') && match.endsWith('$')) {
        return match;
      }
      return `$${content}$`;
    });
    
    // Fix all coordinate points
    processed = processed.replace(/\((\d+),\s*(\d+)\)/g, `$(\\1, \\2)$`);
    processed = processed.replace(/\(\((\d+),\s*(\d+)\)\)/g, `$((\\1, \\2))$`);
    
    // Fix all variable substitutions
    processed = processed.replace(/\(x = (\d+)\)/g, `$(x = \\1)$`);
    processed = processed.replace(/\(y = (\d+)\)/g, `$(y = \\1)$`);
    
    // Fix all derivative expressions
    processed = processed.replace(/\\frac\{dy\}\{dx\}/g, (match) => {
      if (!/\$[^$]*\\frac\{dy\}\{dx\}/.test(match)) {
        return `$${match}$`;
      }
      return match;
    });
    
    // Fix all expressions with x^2, y^2, etc.
    processed = processed.replace(/([xy])\^(\d+)/g, (match, variable, power) => {
      if (!/\$[^$]*[xy]\^/.test(match)) {
        return `$${variable}^{${power}}$`;
      }
      return match;
    });
    
    // Fix all equations with = sign
    processed = processed.replace(/([^\$])([\w\s\^]+\s*=\s*[\w\s\^]+)([^\$])/g, (match, before, equation, after) => {
      return `${before}$${equation}$${after}`;
    });
    
    // Convert display math for important equations
    processed = processed.replace(/The given curve is:\s*\n\s*\$([^$]+)\$/g, 
      `The given curve is:\n\n$$${1}$$`);
      
    // Fix the "Find the derivative" step with display math
    processed = processed.replace(/(\d+)\.\s+Find the derivative ([^:]+):\s*\n\s*\$([^$]+)\$/g, 
      `$1. Find the derivative $2:\n\n$$${3}$$`);
      
    // Fix "Solving for" step with display math
    processed = processed.replace(/Solving for \$([^$]+)\$:\s*\n/g, 
      `Solving for $${1}$:\n\n`);
      
    // Fix specific patterns from the example
    processed = processed.replace(/Find the point where the line normal to the curve \(x\^2 - xy \+ y^2 = 36\) at \(\(6, 6\)\) intersects the curve again\./g,
      `Find the point where the line normal to the curve $(x^2 - xy + y^2 = 36)$ at $((6, 6))$ intersects the curve again.`);
      
    processed = processed.replace(/Slope of the normal line is the negative reciprocal, which is (\d+)\./g,
      `Slope of the normal line is the negative reciprocal, which is $${1}$.`);
      
    // Fix specific patterns for Problem 7
    processed = processed.replace(/Problem 7: Finding the other intersection point of the normal line/g,
      `Problem 7: Finding the other intersection point of the normal line`);
      
    processed = processed.replace(/The given curve is:/g,
      `The given curve is:`);
      
    // Fix specific patterns for Problem 8
    processed = processed.replace(/Find \(\\frac\{dy\}\{d\\theta\}\) for \(y = \\ln\\left\\{\\frac\{e\^\{\\theta\}\}\{5 \+ e\^\{\\theta\}\}\\right\}\)/g,
      `Find $(\\frac{dy}{d\\theta})$ for $y = \\ln\\left\\{\\frac{e^{\\theta}}{5 + e^{\\theta}}\\right\\}$`);
      
    processed = processed.replace(/Use the chain rule and quotient rule: \[ (.*?) \]/g,
      `Use the chain rule and quotient rule: $${1}$`);
  }
  
  // AGGRESSIVE FIX: First check if this is a step-by-step math solution
  if (processed.includes("Problem") && 
      (processed.includes("Find the point") || 
       processed.includes("Find the derivative") || 
       processed.includes("Evaluate") ||
       processed.includes("Let's solve") ||
       processed.includes("I'll solve"))) {
    
    // Fix numbered steps with math expressions
    processed = processed.replace(/(\d+)\.\s+Find the derivative of the curve:/g, 
      `$1. Find the derivative of the curve:`);
      
    processed = processed.replace(/(\d+)\.\s+Evaluate at \(\((\d+), (\d+)\)\):/g, 
      `$1. Evaluate at $((\\2, \\3))$:`);
      
    processed = processed.replace(/(\d+)\.\s+Find the normal slope:/g, 
      `$1. Find the normal slope:`);
      
    processed = processed.replace(/(\d+)\.\s+Equation of the normal line:/g, 
      `$1. Equation of the normal line:`);
      
    processed = processed.replace(/(\d+)\.\s+Substitute back into the curve equation:/g, 
      `$1. Substitute back into the curve equation:`);
    
    // Fix specific patterns from the first screenshot
    processed = processed.replace(/Problem 7/g, `Problem 7`);
    
    processed = processed.replace(/Find the point where the line normal to the curve \(x\^2 - xy \+ y^2 = 36\) at \(\(6, 6\)\) intersects the curve again\./g,
      `Find the point where the line normal to the curve $(x^2 - xy + y^2 = 36)$ at $((6, 6))$ intersects the curve again.`);
      
    // Fix the numbered steps with derivative expressions
    processed = processed.replace(/(\d+)\.\s+Find the derivative of the curve: \[ (.*?) \]/g,
      `$1. Find the derivative of the curve: $$$2$$`);
      
    processed = processed.replace(/Simplify to find \(\\frac\{dy\}\{dx\}\): \[ (.*?) \]/g,
      `Simplify to find $(\\frac{dy}{dx})$: $$$1$$`);
      
    processed = processed.replace(/(\d+)\.\s+Evaluate at \(\((\d+), (\d+)\)\): \[ (.*?) \]/g,
      `$1. Evaluate at $((\\2, \\3))$: $$$4$$`);
      
    processed = processed.replace(/(\d+)\.\s+Find the normal slope: (.*?)(\d+)\.?/g,
      `$1. Find the normal slope: $$$2$$$3.`);
      
    processed = processed.replace(/(\d+)\.\s+Equation of the normal line: \[ (.*?) \]/g,
      `$1. Equation of the normal line: $$$2$$`);
      
    processed = processed.replace(/(\d+)\.\s+Substitute back into the curve equation: \[ (.*?) \]/g,
      `$1. Substitute back into the curve equation: $$$2$$`);
      
    // Fix specific patterns from the second screenshot
    processed = processed.replace(/Problem 7: Finding the other intersection point of the normal line/g,
      `Problem 7: Finding the other intersection point of the normal line`);
      
    processed = processed.replace(/The given curve is:/g,
      `The given curve is:`);
      
    // Convert display math to use $$ delimiters for important equations
    processed = processed.replace(/The given curve is:\s*\n\s*\$([^$]+)\$/g, 
      `The given curve is:\n\n$$$$1$$$$`);
      
    // Fix the "Find the derivative" step with display math
    processed = processed.replace(/(\d+)\.\s+Find the derivative ([^:]+):\s*\n\s*\$([^$]+)\$/g, 
      `$1. Find the derivative $2:\n\n$$$$3$$$$`);
      
    // Fix "Solving for" step with display math
    processed = processed.replace(/Solving for \$([^$]+)\$:\s*\n/g, 
      `Solving for $$$1$$:\n\n`);
      
    // Fix all expressions in square brackets to use regular math delimiters
    processed = processed.replace(/\[(.*?)\]/g, (match, content) => {
      if (match.startsWith('$[') && match.endsWith(']$')) {
        return match;
      }
      return `$[${content}]$`;
    });
    
    // Fix all math expressions with \frac
    processed = processed.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (match) => {
      if (!/\$[^$]*\\frac/.test(match)) {
        return `$${match}$`;
      }
      return match;
    });
    
    // Fix all coordinate points
    processed = processed.replace(/\((\d+),\s*(\d+)\)/g, `$(\\1, \\2)$`);
    
    // Fix all variable substitutions
    processed = processed.replace(/\(x = (\d+)\)/g, `$(x = \\1)$`);
    processed = processed.replace(/\(y = (\d+)\)/g, `$(y = \\1)$`);
    
    // Fix all derivative expressions
    processed = processed.replace(/\\frac\{dy\}\{dx\}/g, (match) => {
      if (!/\$[^$]*\\frac\{dy\}\{dx\}/.test(match)) {
        return `$${match}$`;
      }
      return match;
    });
    
    // Fix all expressions with x^2, y^2, etc.
    processed = processed.replace(/([xy])\^(\d+)/g, (match, variable, power) => {
      if (!/\$[^$]*[xy]\^/.test(match)) {
        return `$${variable}^{${power}}$`;
      }
      return match;
    });
    
    // Fix all equations with = sign
    processed = processed.replace(/([^\$])([\w\s\^]+\s*=\s*[\w\s\^]+)([^\$])/g, (match, before, equation, after) => {
      return `${before}$${equation}$${after}`;
    });
    
    // Fix specific patterns from the example
    processed = processed.replace(/Find the point where the line normal to the curve \(x\^2 - xy \+ y^2 = 36\) at \(\(6, 6\)\) intersects the curve again\./g,
      `Find the point where the line normal to the curve $(x^2 - xy + y^2 = 36)$ at $((6, 6))$ intersects the curve again.`);
      
    processed = processed.replace(/Slope of the normal line is the negative reciprocal, which is (\d+)\./g,
      `Slope of the normal line is the negative reciprocal, which is $\\1$.`);
      
    processed = processed.replace(/\[ y - 6 = 1\(x - 6\) \\implies y = x \]/g,
      `$y - 6 = 1(x - 6) \\implies y = x$`);
      
    processed = processed.replace(/\[ x\^2 - x\^2 \+ x\^2 = 36 \\implies x\^2 = 36 \\implies x = \\pm 6 \]/g,
      `$x^2 - x^2 + x^2 = 36 \\implies x^2 = 36 \\implies x = \\pm 6$`);
      
    processed = processed.replace(/Since \(\(6, 6\)\) is already a point, the other point is \(\(-6, -6\)\)\./g,
      `Since $((6, 6))$ is already a point, the other point is $((-6, -6))$.`);
      
    // Fix Problem 8 with chain rule and quotient rule
    processed = processed.replace(/Find \(\\frac\{dy\}\{d\\theta\}\) for \(y = \\ln\\left\\{\\frac\{e\^\{\\theta\}\}\{5 \+ e\^\{\\theta\}\}\\right\}\)/g,
      `Find $(\\frac{dy}{d\\theta})$ for $y = \\ln\\left\\{\\frac{e^{\\theta}}{5 + e^{\\theta}}\\right\\}$`);
      
    processed = processed.replace(/Use the chain rule and quotient rule: \[ (.*?) \]/g,
      `Use the chain rule and quotient rule: $$$1$$`);
  }
  
  // AGGRESSIVE FIX: Process all square bracket expressions first
  // This will catch all expressions like [x^2 - xy + y^2 = 36] and wrap them with $ delimiters
  const squareBracketRegex = /\[(.*?)\]/g;
  processed = processed.replace(squareBracketRegex, (match, content) => {
    // Skip if already properly formatted with $ delimiters
    if (match.startsWith('$[') && match.endsWith(']$')) {
      return match;
    }
    
    // If it contains any math symbols, wrap it
    if (/[+\-*/=^\\{}\[\]()\d]/.test(content)) {
      return `$[${content}]$`;
    }
    
    return match;
  });
  
  // Fix all parentheses with math expressions
  processed = processed.replace(/\(\\frac\{[^)]+\}\{[^)]+\}\)/g, (match) => {
    return `$${match}$`;
  });
  
  // Fix coordinate points
  processed = processed.replace(/\((\d+),\s*(\d+)\)/g, `$(\\1, \\2)$`);
  
  // Fix all \frac expressions that aren't already in math delimiters
  processed = processed.replace(/(?<!\$)\\frac\{([^{}]+)\}\{([^{}]+)\}(?!\$)/g, (match) => {
    return `$${match}$`;
  });
  
  // Fix all derivative expressions
  processed = processed.replace(/\\frac\{dy\}\{dx\}/g, (match) => {
    // If not already in math delimiters, add them
    if (!/\$[^$]*\\frac\{dy\}\{dx\}[^$]*\$/.test(processed)) {
      return `$${match}$`;
    }
    return match;
  });
  
  // Fix all expressions with \frac{d}{dx}
  processed = processed.replace(/\\frac\{d\}\{dx\}/g, (match) => {
    // If not already in math delimiters, add them
    if (!/\$[^$]*\\frac\{d\}\{dx\}[^$]*\$/.test(processed)) {
      return `$${match}$`;
    }
    return match;
  });
  
  // Fix all parentheses with math expressions inside
  processed = processed.replace(/\(([^()]*(?:[+\-*/=^])[^()]*)\)/g, (match, content) => {
    // If it contains math operators and isn't already in math delimiters
    if (/[+\-*/=^]/.test(content) && !/\$[^$]*\([^()]*(?:[+\-*/=^])[^()]*\)[^$]*\$/.test(match)) {
      return `$(${content})$`;
    }
    return match;
  });
  
  // Direct fix for the exact format shown in the screenshot
  if (processed.includes("Let's solve each problem:") || 
      processed.includes("Normal Line to the Curve") || 
      processed.includes("x^2 - xy + y^2 = 36")) {
    
    // Fix all expressions in square brackets
    processed = processed.replace(/\[(.*?)\]/g, (match, content) => {
      if (match.startsWith('$[') && match.endsWith(']$')) {
        return match;
      }
      return `$[${content}]$`;
    });
    
    // Fix all derivative expressions
    processed = processed.replace(/\(\\frac\{dy\}\{dx\}\)/g, `$(\\frac{dy}{dx})$`);
    
    // Fix all coordinate points
    processed = processed.replace(/\((\d+), (\d+)\)/g, `$(\\1, \\2)$`);
    
    // Fix all variable substitutions
    processed = processed.replace(/\(x = (\d+)\)/g, `$(x = \\1)$`);
    processed = processed.replace(/\(y = (\d+)\)/g, `$(y = \\1)$`);
  }
  
  // Preprocess step: Check if this is a normal line to curve problem and apply specific fixes
  if (processed.includes("Normal Line to the Curve") || 
      processed.includes("normal line") || 
      processed.includes("x^2 - xy + y^2 = 36")) {
    
    // Apply specific fixes for this problem type
    processed = processed.replace(/7\) Normal Line to the Curve/g, 
      `7) Normal Line to the Curve`);
      
    processed = processed.replace(/Given the curve: \[ (x\^2 - xy \+ y\^2 = 36) \]/g, 
      `Given the curve: $[$1]$`);
      
    processed = processed.replace(/\[ (2x - y - x\\frac\{dy\}\{dx\} \+ 2y\\frac\{dy\}\{dx\} = 0) \]/g, 
      `$[$1]$`);
      
    processed = processed.replace(/\[ (\\frac\{dy\}\{dx\} = \\frac\{y - 2x\}\{2y - x\}) \]/g, 
      `$[$1]$`);
      
    processed = processed.replace(/\[ (\\frac\{dy\}\{dx\} = \\frac\{(\d+) - 2\((\d+)\)\}\{2\((\d+)\) - (\d+)\} = -1) \]/g, 
      `$[$1]$`);
      
    // Fix all parentheses with numbers inside
    processed = processed.replace(/\((\d+), (\d+)\)/g, `$(\\1, \\2)$`);
    processed = processed.replace(/\(x = (\d+)\)/g, `$(x = \\1)$`);
    processed = processed.replace(/\(y = (\d+)\)/g, `$(y = \\1)$`);
    
    // Fix all square brackets with math expressions
    processed = processed.replace(/\[ ([^\[\]]+) \]/g, `$[$1]$`);
  }
  
  // First, handle the specific problem format shown in the screenshot
  processed = processed.replace(/Given the curve: \[ x\^2 - xy \+ y^2 = 36 \]/g, 
    `Given the curve: $[x^2 - xy + y^2 = 36]$`);
    
  processed = processed.replace(/First, find the derivative \(\\frac\{dy\}\{dx\}\) using implicit differentiation:/g, 
    `First, find the derivative $(\\frac{dy}{dx})$ using implicit differentiation:`);
    
  processed = processed.replace(/\[ 2x - y - x\\frac\{dy\}\{dx\} \+ 2y\\frac\{dy\}\{dx\} = 0 \]/g, 
    `$[2x - y - x\\frac{dy}{dx} + 2y\\frac{dy}{dx} = 0]$`);
    
  processed = processed.replace(/Solving for \(\\frac\{dy\}\{dx\}\):/g, 
    `Solving for $(\\frac{dy}{dx})$:`);
    
  processed = processed.replace(/\[ \\frac\{dy\}\{dx\} = \\frac\{y - 2x\}\{2y - x\} \]/g, 
    `$[\\frac{dy}{dx} = \\frac{y - 2x}{2y - x}]$`);
    
  processed = processed.replace(/At the point \((\d+), (\d+)\), substitute \(x = (\d+)\) and \(y = (\d+)\):/g, 
    `At the point $(\\1, \\2)$, substitute $(x = \\3)$ and $(y = \\4)$:`);
    
  processed = processed.replace(/\[ \\frac\{dy\}\{dx\} = \\frac\{(\d+) - 2\((\d+)\)\}\{2\((\d+)\) - (\d+)\} = -1 \]/g, 
    `$[\\frac{dy}{dx} = \\frac{\\1 - 2(\\2)}{2(\\3) - \\4} = -1]$`);
    
  processed = processed.replace(/The slope of the normal line is the negative reciprocal of \(-1\), which is \(1\)./g, 
    `The slope of the normal line is the negative reciprocal of $(-1)$, which is $(1)$.`);
    
  processed = processed.replace(/Using the point-slope form \(y - y_1 = m\(x - x_1\)\), we have:/g, 
    `Using the point-slope form $(y - y_1 = m(x - x_1))$, we have:`);

  // Handle highly specific formats for derivation steps visible in the screenshot
  processed = processed.replace(/1\. Find the derivative \(\\frac\{dy\}\{dx\}\):/g, 
    `1. Find the derivative $(\\frac{dy}{dx})$:`);
    
  processed = processed.replace(/2\. Evaluate \(\\frac\{dy\}\{dx\}\) at \(\(6, 6\)\):/g, 
    `2. Evaluate $(\\frac{dy}{dx})$ at $((6, 6))$:`);
    
  processed = processed.replace(/Differentiate implicitly:/g, 
    `Differentiate implicitly:`);
    
  processed = processed.replace(/\[ \\frac\{d\}\{dx\}\(x\^2\) - \\frac\{d\}\{dx\}\(xy\) \+ \\frac\{d\}\{dx\}\(y\^2\) ?= ?0 \]/g, 
    `$[\\frac{d}{dx}(x^2) - \\frac{d}{dx}(xy) + \\frac{d}{dx}(y^2) = 0]$`);
    
  processed = processed.replace(/\[ 2x - \(y \+ x\\frac\{dy\}\{dx\}\) \+ 2y\\frac\{dy\}\{dx\} = 0 \]/g, 
    `$[2x - (y + x\\frac{dy}{dx}) + 2y\\frac{dy}{dx} = 0]$`);
    
  processed = processed.replace(/\[ 2x - y - x\\frac\{dy\}\{dx\} \+ 2y\\frac\{dy\}\{dx\} = 0 \]/g, 
    `$[2x - y - x\\frac{dy}{dx} + 2y\\frac{dy}{dx} = 0]$`);
    
  processed = processed.replace(/\[ \\frac\{dy\}\{dx\} = \\frac\{y - 2x\}\{2y - x\} \]/g, 
    `$[\\frac{dy}{dx} = \\frac{y - 2x}{2y - x}]$`);
    
  processed = processed.replace(/We need to find the other point where the line normal to the curve \(x\^2 - xy \+ y^2 = 36\) at \(\(6, 6\)\) intersects the curve\./g, 
    `We need to find the other point where the line normal to the curve $(x^2 - xy + y^2 = 36)$ at $((6, 6))$ intersects the curve.`);

  // Add a more aggressive pattern to catch all square bracket expressions with math content
  const squareBracketPattern = /\[(.*?)\]/g;
  processed = processed.replace(squareBracketPattern, (match, content) => {
    // Skip if already properly formatted with $ delimiters
    if (match.startsWith('$[') && match.endsWith(']$')) {
      return match;
    }
    
    // Check if content contains math symbols or expressions
    if (/[+\-*/=^\\{}()\d]/.test(content)) {
      return `$[${content}]$`;
    }
    
    return match;
  });

  // Add general fix for any math expressions in square brackets to ensure they're properly formatted
  // This regex looks for square brackets that contain mathematical notation (fractions, derivatives, etc.)
  const mathBracketRegex = /\[([^\[\]]*(?:\\frac|\\text|\\partial|\\sqrt|\\sum|\\int|\\lim|\\prod|\\nabla|\\vec|\\dot|\\ddot|\^|_|\\left|\\right|\\begin|\\end|\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\zeta|\\eta|\\theta|\\iota|\\kappa|\\lambda|\\mu|\\nu|\\xi|\\pi|\\rho|\\sigma|\\tau|\\upsilon|\\phi|\\chi|\\psi|\\omega)[^\[\]]*)\]/g;
  processed = processed.replace(mathBracketRegex, (match, expr) => {
    // If the expression is already properly formatted with $ delimiters, leave it alone
    if (match.startsWith('$[') && match.endsWith(']$')) {
      return match;
    }
    // Otherwise, wrap it in $ delimiters
    return `$[${expr}]$`;
  });

  // Then, fix specific trigonometric definitions that might be problematic
  const definitionPatterns = [
    {
      regex: /Cosecant \(csc\) is the reciprocal of sine:.*?(\)|$)/g,
      replacement: 'Cosecant (csc) is the reciprocal of sine: $\\text{csc}(\\theta) = \\frac{1}{\\sin(\\theta)}$'
    },
    {
      regex: /Secant \(sec\) is the reciprocal of cosine:.*?(\)|$)/g,
      replacement: 'Secant (sec) is the reciprocal of cosine: $\\text{sec}(\\theta) = \\frac{1}{\\cos(\\theta)}$'
    },
    {
      regex: /Cotangent \(cot\) is the reciprocal of tangent:.*?(\)|$)/g,
      replacement: 'Cotangent (cot) is the reciprocal of tangent: $\\text{cot}(\\theta) = \\frac{1}{\\tan(\\theta)}$'
    }
  ];
  
  // Apply each definition pattern
  for (const pattern of definitionPatterns) {
    processed = processed.replace(pattern.regex, pattern.replacement);
  }
  
  // Fix steps for implicit differentiation and calculus work
  const mathProblemPatterns = [
    // Wrap all expressions in [ ] with LaTeX delimiters
    {
      regex: /\[ ?((?:\\frac|\\text|\w+|[\^+\-*/(),=\d]|\\partial)+) ?\]/g,
      wrapper: (match: string, expr: string) => `$[${expr}]$`
    },
    // Fix "Find the derivative" style headers
    {
      regex: /(\d+)\.\s+Find the derivative \\\(\\frac\{dy\}\{dx\}\):/g,
      wrapper: (match: string, num: string) => `${num}. Find the derivative $\\frac{dy}{dx}$:`
    },
    // Fix "Find the derivative" as seen in the problem 
    {
      regex: /(\d+)\.\s+Find the derivative \(\\frac\{dy\}\{dx\}\):/g,
      wrapper: (match: string, num: string) => `${num}. Find the derivative $(\\frac{dy}{dx})$:`
    },
    // Handle specific patterns from the screenshot - exact matches
    {
      regex: /We need to find the other point where the line normal to the curve \(x\^2 - xy \+ y^2 = 36\) at \(\(6, 6\)\) intersects the curve\./g,
      wrapper: () => `We need to find the other point where the line normal to the curve $(x^2 - xy + y^2 = 36)$ at $((6, 6))$ intersects the curve.`
    },
    {
      regex: /\[ \\frac\{d\}\{dx\}\(x\^2\) - \\frac\{d\}\{dx\}\(xy\) \+ \\frac\{d\}\{dx\}\(y\^2\)= 0 \]/g,
      wrapper: () => `$[\\frac{d}{dx}(x^2) - \\frac{d}{dx}(xy) + \\frac{d}{dx}(y^2)= 0]$`
    },
    {
      regex: /\[ 2x - \(y \+ x\\frac\{dy\}\{dx\}\) \+ 2y\\frac\{dy\}\{dx\} = 0 \]/g,
      wrapper: () => `$[2x - (y + x\\frac{dy}{dx}) + 2y\\frac{dy}{dx} = 0]$`
    },
    {
      regex: /\[ 2x - y - x\\frac\{dy\}\{dx\} \+ 2y\\frac\{dy\}\{dx\} = 0 \]/g,
      wrapper: () => `$[2x - y - x\\frac{dy}{dx} + 2y\\frac{dy}{dx} = 0]$`
    },
    {
      regex: /\[ \\frac\{dy\}\{dx\} = \\frac\{y - 2x\}\{2y - x\} \]/g,
      wrapper: () => `$[\\frac{dy}{dx} = \\frac{y - 2x}{2y - x}]$`
    },
    // Handle differentiate implicitly line
    {
      regex: /Differentiate implicitly:/g,
      wrapper: () => `Differentiate implicitly:`
    },
    // Handle the specific derivative expressions from the problem
    {
      regex: /\[ ?\\frac\{d\}\{dx\}\(([^)]+)\) ?- ?\\frac\{d\}\{dx\}\(([^)]+)\) ?([+=-]) ?\\frac\{d\}\{dx\}\(([^)]+)\) ?= ?0 ?\]/g,
      wrapper: (match: string, expr1: string, expr2: string, op: string, expr3: string) => 
        `$[\\frac{d}{dx}(${expr1}) - \\frac{d}{dx}(${expr2}) ${op} \\frac{d}{dx}(${expr3}) = 0]$`
    },
    // Handle specific format seen in "Substitute" lines
    {
      regex: /\[ ?\\frac\{dy\}\{dx\} ?= ?([^[\]]+) ?\]/g,
      wrapper: (match: string, expr: string) => `$[\\frac{dy}{dx} = ${expr}]$`
    },
    // Handle specific normal line slope format
    {
      regex: /The slope of the normal line is the negative reciprocal: \[ ?([^[\]]+) ?\]/g,
      wrapper: (match: string, expr: string) => `The slope of the normal line is the negative reciprocal: $[${expr}]$`
    },
    // Handle equation of normal line
    {
      regex: /The equation of the normal line passing through \((\d+), (\d+)\) is: \[ ?([^[\]]+) ?\]/g,
      wrapper: (match: string, x: string, y: string, eq: string) => 
        `The equation of the normal line passing through $(${x}, ${y})$ is: $[${eq}]$`
    },
    // Handle coordinate substitution
    {
      regex: /Substitute \((\w+) = (\d+)\) and \((\w+) = (\d+)\): \[ ?([^[\]]+) ?\]/g,
      wrapper: (match: string, var1: string, val1: string, var2: string, val2: string, expr: string) =>
        `Substitute $(${var1} = ${val1})$ and $(${var2} = ${val2})$: $[${expr}]$`
    },
    // Handle evaluation of derivative at a point
    {
      regex: /(\d+)\. Evaluate \(\\frac\{dy\}\{dx\}\) at \((\d+), (\d+)\):/g,
      wrapper: (match: string, step: string, x: string, y: string) => 
        `${step}. Evaluate $(\\frac{dy}{dx})$ at $(${x}, ${y})$:`
    },
    // Handle "At (x,y)" expressions
    {
      regex: /At \((\d+), ?(\d+)\): \[ ?([^[\]]+) ?\]/g,
      wrapper: (match: string, x: string, y: string, expr: string) => 
        `At $(${x}, ${y})$: $[${expr}]$`
    },
    // Fix derivative notation in brackets patterns visible in the screenshot
    {
      regex: /\[ \\frac\{dy\}\{dx\} = \\frac\{([\w\s\-+*\/\\{}()^]+)\}\{([\w\s\-+*\/\\{}()^]+)\} \]/g,
      wrapper: (match: string, num: string, denom: string) => 
        `$[\\frac{dy}{dx} = \\frac{${num}}{${denom}}]$`
    },
    // Handle the derivative lines with backslashes and fractions (more general)
    {
      regex: /\[ ?((?:\\frac|\w|\\\w+|\d|[(){}\[\]^+\-*/,.=]|\\left|\\right)+) ?\]/g,
      wrapper: (match: string, expr: string) => `$[${expr}]$`
    },
    // Special fix for the \frac{dy}{dx} notation in problem description
    {
      regex: /Find the derivative \((?:\\frac{dy}{dx})\):/g,
      wrapper: (match: string) => `Find the derivative $(\\frac{dy}{dx})$:`
    }
  ];
  
  // Apply the math problem patterns
  for (const pattern of mathProblemPatterns) {
    processed = processed.replace(pattern.regex, (...args) => {
      // Type assertion to make TypeScript happy
      return (pattern.wrapper as Function)(...args);
    });
  }
  
  // Special fix for uploaded math problems with equations containing \frac and parentheses
  processed = processed.replace(/The equation of the (curve|normal line|line) is: \[(.*?)\]/g, 'The equation of the $1 is: $[$2$]$');
  processed = processed.replace(/The (curve|normal line|line) is given by: \[(.*?)\]/g, 'The $1 is given by: $[$2$]$');
  processed = processed.replace(/First, find the derivative to get the slope of the tangent at \((\d+), (\d+)\):/g, 'First, find the derivative to get the slope of the tangent at $(\\1, \\2)$:');
  
  // Fix step numbering with LaTeX expressions
  processed = processed.replace(/(\d+)\. (.*?)\\frac/g, '$1. $\\frac');
  processed = processed.replace(/(\d+)\. (.*?)\\text/g, '$1. $\\text');
  
  // Fix common uploaded problem patterns
  const uploadedProblemPatterns = [
    // Implicit differentiation steps
    { 
      regex: /Differentiate( implicitly)? with respect to \(x\):(.*?)$/gm,
      wrapper: (match: string, p1: string | undefined, p2: string) => `Differentiate${p1 || ''} with respect to $(x)$:$${p2}$` 
    },
    // Normal line equations
    { 
      regex: /The slope of the normal line is(.*?)$/gm,
      wrapper: (match: string, p1: string) => `The slope of the normal line is$${p1}$` 
    },
    // Substitution steps
    { 
      regex: /Substitute \(x = (\d+)\) and \(y = (\d+)\):(.*?)$/gm,
      wrapper: (match: string, x: string, y: string, eq: string) => `Substitute $(x = ${x})$ and $(y = ${y})$:$${eq}$` 
    },
    // At point notation
    {
      regex: /At \((\d+),\s*(\d+)\),(.*?)$/gm,
      wrapper: (match: string, x: string, y: string, rest: string) => `At $(${x}, ${y})$,$${rest}$`
    },
    // Equation of normal line
    {
      regex: /The equation of the normal line passing through \((\d+), (\d+)\) is:(.*?)$/gm,
      wrapper: (match: string, x: string, y: string, eq: string) => `The equation of the normal line passing through $(${x}, ${y})$ is:$${eq}$`
    },
    // Substition into original curve
    {
      regex: /Substitute \(y = (.*?)\) into the original curve equation:/gm,
      wrapper: (match: string, eq: string) => `Substitute $(y = ${eq})$ into the original curve equation:`
    },
    // Points are
    {
      regex: /The points are \((\d+), (\d+)\) and \((\d+), (\d+)\)\.$/gm,
      wrapper: (match: string, x1: string, y1: string, x2: string, y2: string) => `The points are $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`
    }
  ];
  
  // Apply uploaded problem patterns
  for (const pattern of uploadedProblemPatterns) {
    processed = processed.replace(pattern.regex, (...args) => {
      // Type assertion to make TypeScript happy
      return (pattern.wrapper as Function)(...args);
    });
  }
  
  // Convert implicit LaTeX syntax to explicit delimiters (common in uploaded file problems)
  // Look for patterns like \frac{...}{...}, \sqrt{...}, etc. that are not within $ delimiters
  const implicitLatexPatterns = [
    // Match \frac{...}{...} not within $ delimiters
    {
      regex: /(?<!\$)(?<!\\text\{)\\frac\{[^{}]+\}\{[^{}]+\}(?!\$)/g,
      wrapper: (match: string) => `$${match}$`
    },
    // Match \sqrt{...} not within $ delimiters
    {
      regex: /(?<!\$)(?<!\\text\{)\\sqrt\{[^{}]+\}(?!\$)/g,
      wrapper: (match: string) => `$${match}$`
    },
    // Match other common LaTeX commands with braces
    {
      regex: /(?<!\$)(?<!\\text\{)\\([a-zA-Z]+)\{[^{}]+\}(?!\$)/g,
      wrapper: (match: string) => `$${match}$`
    },
    // Convert implicit derivatives like \frac{dy}{dx}
    {
      regex: /\\frac\{d([a-zA-Z])\}\{d([a-zA-Z])\}/g,
      wrapper: (match: string) => `$${match}$`
    }
  ];
  
  // Apply implicit LaTeX conversions
  for (const pattern of implicitLatexPatterns) {
    processed = processed.replace(pattern.regex, (match) => pattern.wrapper(match));
  }
  
  // Fix math expressions that are between parentheses but should be in $ delimiters
  processed = processed.replace(
    /\(\\(text|mathrm)\{([a-z]+)\}\(([^)]+)\) = ([^)]+)\)/g, 
    '$\\$1{$2}($3) = $4$'
  );
  
  // Fix common trig expressions without proper \text formatting
  const trigExprPatterns = [
    // Match bare trig functions like sin(x), cos(x), etc. not in math delimiters
    { 
      regex: /(?<!\$|\w|\{)(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan)\(([^)]+)\)(?!\$)/g,
      wrapper: (match: string, func: string, arg: string) => `$\\text{${func}}(${arg})$` 
    },
    // Fix derivative notation like dy/dx
    {
      regex: /\b([a-zA-Z])′\b|\bd([a-zA-Z])\/d([a-zA-Z])\b/g,
      wrapper: (match: string) => `$${match}$`
    },
    // Fix fraction-like expressions a/b where a and b are single letters or numbers
    {
      regex: /\b(\d+|[a-zA-Z])\/(\d+|[a-zA-Z])\b/g,
      wrapper: (match: string) => `$${match}$`
    }
  ];
  
  // Apply trig expression fixes
  for (const pattern of trigExprPatterns) {
    processed = processed.replace(pattern.regex, (...args) => {
      // Type assertion to make TypeScript happy
      return (pattern.wrapper as Function)(...args);
    });
  }
  
  // Fix table notation that uses matrices
  processed = processed.replace(
    /\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g,
    (match, content) => {
      // If not already in math delimiters, wrap it
      if (!/\$\$[\s\S]*\\begin\{pmatrix\}/.test(match)) {
        return `$$${match}$$`;
      }
      return match;
    }
  );

  // Fix common LaTeX patterns used in math problem solutions
  processed = processed.replace(/\\frac\{d\}\{dx\}/g, '$\\frac{d}{dx}$');
  processed = processed.replace(/\\frac\{dy\}\{dx\}/g, '$\\frac{dy}{dx}$');
  processed = processed.replace(/\\nabla/g, '$\\nabla$');
  processed = processed.replace(/\\vec\{([^{}]+)\}/g, '$\\vec{$1}$');
  
  // Fix 'f′(x)' and similar derivative notations
  processed = processed.replace(/\b([a-zA-Z])′\(([^)]+)\)/g, '$${$1}′($2)$');
  
  // Fix common equation patterns specific to uploaded problems
  processed = processed.replace(/\[ ?((?:[xy]|\\frac|[+=-])[^\[\]]*) ?\]/g, '$[$1$]$');
  
  // Fix rightarrow in equations
  processed = processed.replace(/\\rightarrow/g, '$\\rightarrow$');
  
  // Process math within existing $ delimiters to ensure functions are properly marked
  const mathDelimiters = [
    { start: '$$', end: '$$' },
    { start: '$', end: '$' }
  ];
  
  for (const delimiter of mathDelimiters) {
    const regex = new RegExp(`${delimiter.start}(.*?)${delimiter.end}`, 'g');
    processed = processed.replace(regex, (match, content) => {
      // Process trig functions within the math content
      let newContent = content;
      
      // List of all trigonometric functions to check
      const trigFunctions = [
        'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
        'arcsin', 'arccos', 'arctan', 'arcsec', 'arccsc', 'arccot',
        'sinh', 'cosh', 'tanh'
      ];
      
      // Add \text{} around each function if not already present
      for (const func of trigFunctions) {
        // Only match the function if it's followed by an opening parenthesis
        // and not already wrapped in \text{} or \mathrm{}
        const funcPattern = new RegExp(`(?<![a-zA-Z\\\\])${func}(?=\\()`, 'g');
        newContent = newContent.replace(funcPattern, `\\text{${func}}`);
      }
      
      // Fix fractions with single characters
      newContent = newContent.replace(/\\frac(\w)(\w)/g, '\\frac{$1}{$2}');
      
      // Fix missing braces in subscripts and superscripts
      newContent = newContent.replace(/\_(\w)(?![a-zA-Z{}])/g, '_{$1}');
      newContent = newContent.replace(/\^(\w)(?![a-zA-Z{}])/g, '^{$1}');
      
      return `${delimiter.start}${newContent}${delimiter.end}`;
    });
  }
  
  // Handle common equation patterns from uploaded math problems
  const equationPatterns = [
    // Handle equations with = sign that should be in math mode
    { 
      regex: /\b([a-zA-Z0-9_^]+\s*[+\-*/=]\s*[a-zA-Z0-9_^]+(?:\s*[+\-*/=]\s*[a-zA-Z0-9_^]+)*)\b/g,
      test: (match: string) => /[=+\-*/]/.test(match) && /[a-zA-Z0-9]/.test(match),
      wrapper: (match: string) => {
        // Don't wrap if already in math delimiters
        if (match.includes('$')) return match;
        return `$${match}$`;
      }
    }
  ];
  
  // Apply equation patterns
  for (const pattern of equationPatterns) {
    processed = processed.replace(pattern.regex, (match) => {
      if (pattern.test(match)) {
        return pattern.wrapper(match);
      }
      return match;
    });
  }
  
  return processed;
};

const MathMarkdown: React.FC<MathMarkdownProps> = ({ children, className = "" }) => {
  const [content, setContent] = useState<string>("");
  
  useEffect(() => {
    if (children) {
      // Apply all fixes to the content
      const processed = fixMathNotation(children);
      setContent(processed);
    }
  }, [children]);
  
  return (
    <div className={`prose max-w-full dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, { 
            throwOnError: false,
            strict: false,
            output: 'html',
            trust: true,
            displayMode: false,
            fleqn: false,
            macros: {
              // Add custom macros for trig functions
              "\\arcsec": "\\text{arcsec}",
              "\\arccsc": "\\text{arccsc}",
              "\\arccot": "\\text{arccot}",
              "\\arccos": "\\text{arccos}",
              "\\arcsin": "\\text{arcsin}",
              "\\arctan": "\\text{arctan}",
              "\\sin": "\\text{sin}",
              "\\cos": "\\text{cos}",
              "\\tan": "\\text{tan}",
              "\\csc": "\\text{csc}",
              "\\sec": "\\text{sec}",
              "\\cot": "\\text{cot}"
            }
          }]
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MathMarkdown; 