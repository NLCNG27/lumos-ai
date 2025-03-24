import { DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/gemini";
import { GEMINI_MODELS, generateGeminiResponse, callGeminiWithTimeout, generateMultimodalResponse } from "@/app/lib/gemini";
import { NextResponse } from "next/server";
// Add child_process for advanced PDF extraction fallback
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir, access } from "fs/promises";
import path from "path";
import fs from "fs";
// After the imports, add this for PDF.js
import * as pdfjs from "pdfjs-dist";
// Add worker threads for parallel processing
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";

// Add this import for PDF metadata extraction
import { PDFDocument } from "pdf-lib";

// Add imports for RAG functionality
import { addDocument, queryDocument } from "@/app/lib/documentManager";
import { createDocumentSummary } from "@/app/lib/documentProcessor";
// Import our new simple PDF extractor
import {
    extractPdfText,
    extractPdfMetadata as simplePdfMetadata,
    extractPdfStructure,
} from "@/app/lib/simplePdfExtractor";

// Import our new document extractor for Office documents
import {
    extractOfficeDocumentText,
    extractOfficeMetadata
} from "@/app/lib/documentExtractor";

// Import the dataset generator
import { generateRandomDataset } from "@/app/lib/datasetGenerator";

// Import the conversation service for saving messages
import { saveMessageToConversation } from "@/app/lib/conversation-service";

// Add a simple in-memory cache for Gemini responses
const CACHE_TTL = 1000 * 60 * 60; // 1 hour in milliseconds
type CacheEntry = {
    response: any;
    timestamp: number;
};
const responseCache = new Map<string, CacheEntry>();

// Add a file processing cache to avoid reprocessing the same files
const fileProcessingCache = new Map<string, {
    content: string;
    timestamp: number;
}>();

// Helper function to generate a cache key
const generateCacheKey = (messages: any[], model: string): string => {
    return `${JSON.stringify(messages)}_${model}`;
};

// Helper function to check if a cache entry is still valid
const isCacheValid = (entry: CacheEntry | undefined): entry is CacheEntry => {
    return !!entry && (Date.now() - entry.timestamp < CACHE_TTL);
};

// Helper function to get a unique file identifier
const getFileIdentifier = (file: any): string => {
    return `${file.name}_${file.size}_${file.type}`;
};

// Configure PDF.js for Node environment
if (typeof window === "undefined") {
    // We're running on server - set up the Node.js environment for PDF.js
    try {
        // Load the polyfills needed for PDF.js in Node
        const canvas = require("canvas");
        const { DOMMatrix, DOMPoint } = require("dommatrix");

        // Add necessary globals
        global.DOMMatrix = DOMMatrix;
        global.DOMPoint = DOMPoint;

        console.log("PDF environment configured for Node");
    } catch (err) {
        console.error("Error configuring PDF environment for Node:", err);
    }
}

const execPromise = promisify(exec);

// Helper function to check if a path exists
const pathExists = async (path: string): Promise<boolean> => {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
};

// Create a mock for pdf-parse if it fails to load properly
const createPdfParseMock = () => {
    console.warn("Using mock PDF parser due to module initialization issues");
    return async (buffer: Buffer) => {
        return {
            text: "PDF parsing module could not be initialized. Using fallback methods.",
        };
    };
};

// Helper function to extract text from Office documents
const extractOfficeText = async (
    buffer: Buffer,
    fileType: string,
    fileName: string
): Promise<string> => {
    try {
        // Use our new document extractor module
        return await extractOfficeDocumentText(buffer, fileType, fileName);
    } catch (error) {
        console.error(`Error extracting text from Office document (${fileName}):`, error);
        throw new Error(`Failed to extract text from ${fileName}`);
    }
};

// Helper function to extract text from ZIP-based documents (like Office files)
const extractTextFromZipArchive = async (buffer: Buffer): Promise<string> => {
    try {
        // Import JSZip properly
        const JSZipModule = await import("jszip");
        const JSZip = JSZipModule.default;
        const zip = new JSZip();

        // Load the ZIP content
        const zipContent = await zip.loadAsync(buffer);

        // Look for common text-containing files in the archive
        let textContent = "";

        // Process all files
        const textFiles: string[] = [];
        zipContent.forEach((relativePath: string, zipEntry: any) => {
            if (!zipEntry.dir) {
                // Check if it's an XML file or other text file
                if (
                    relativePath.endsWith(".xml") ||
                    relativePath.includes("word/document.xml") ||
                    relativePath.includes("ppt/slides/") ||
                    relativePath.includes("xl/worksheets/") ||
                    relativePath.includes("content.xml") ||
                    relativePath.endsWith(".txt")
                ) {
                    textFiles.push(relativePath);
                }
            }
        });

        // Extract content from identified text files
        for (const filePath of textFiles) {
            const fileContent = await zipContent
                .file(filePath)
                ?.async("string");
            if (fileContent) {
                // Simple XML content extraction - remove tags but keep their content
                const textOnly = fileContent
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                if (textOnly.length > 20) {
                    // Only include if it has meaningful content
                    textContent += `--- From ${filePath} ---\n${textOnly}\n\n`;
                }
            }
        }

        return textContent;
    } catch (error) {
        console.error("Error extracting text from ZIP archive:", error);
        throw new Error("Failed to extract text from document archive");
    }
};

type FileData = {
    id: string;
    name: string;
    type: string;
    size: number;
    content: string;
};

type ImageContent = {
    type: "image_url";
    image_url: {
        url: string;
        detail: "low" | "high" | "auto";
    };
};

type TextContent = {
    type: "text";
    text: string;
};

// Define our message format to avoid TypeScript errors
interface Message {
    role: "system" | "user" | "assistant";
    content: string | Array<TextContent | ImageContent>;
}

// Function to get the appropriate data directory based on environment
const getDataDirectory = () => {
    // Stub function - no longer creates directories
    return '';
};

// Helper function to ensure directory exists
const ensureDirectoryExists = async (directoryPath: string) => {
    // Stub function - no longer creates directories
    return true;
};

// Create necessary directories at module initialization time
// Removed initialization code

export async function POST(req: Request) {
    try {
        const { messages, files } = await req.json();

        // Process files if they exist
        let fileContents = "";
        let hasUnprocessableFiles = false;
        let hasImageFiles = false;
        let imageUrls: { url: string; name: string }[] = [];
        let pdfStats = {
            totalCount: 0,
            successCount: 0,
            failureCount: 0,
            methodsUsed: [] as string[],
            errors: [] as string[],
        };

        // RAG-specific variables
        const processedDocsInfo = [];
        let documentContext = "";

        if (files && files.length > 0) {
            try {
                // Original file processing for general content
                const result = await processFiles(files);
                fileContents = result.contents;
                hasUnprocessableFiles = result.hasUnprocessableFiles;
                hasImageFiles = result.hasImageFiles;
                imageUrls = result.imageUrls;
                pdfStats = result.pdfStats;

                // Additional processing for RAG with PDFs
                for (const file of files) {
                    // Only process PDFs for document understanding
                    if (
                        file.type === "application/pdf" ||
                        file.name.toLowerCase().endsWith(".pdf")
                    ) {
                        try {
                            const base64Data = file.content.split(",")[1]; // Remove data URL prefix
                            const buffer = Buffer.from(base64Data, "base64");

                            // Use our new simple extractor
                            const pdfText = await extractPdfText(buffer);

                            if (pdfText && pdfText.trim()) {
                                // Process the document (chunk and store in vector db)
                                const docInfo = await addDocument(
                                    pdfText,
                                    file.name,
                                    false
                                );
                                processedDocsInfo.push(docInfo);
                            }
                        } catch (fileError) {
                            console.error(
                                `Error processing file ${file.name}:`,
                                fileError
                            );
                        }
                    }
                }
            } catch (error) {
                console.error("Error processing files:", error);
                // Continue without file processing rather than failing completely
                hasUnprocessableFiles = true;
            }
        }

        // Get the last user message for RAG retrieval
        // @ts-ignore - TypeScript doesn't recognize the filtered messages type
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const lastUserMessage = messages
            .filter((m: { role: string }) => m.role === "user")
            .pop();

        // If we have processed documents and a user query, perform retrieval
        if (processedDocsInfo.length > 0 && lastUserMessage) {
            // For each processed document, get relevant chunks
            for (const docInfo of processedDocsInfo) {
                try {
                    const relevantChunks = await queryDocument(
                        docInfo.id,
                        lastUserMessage.content,
                        3
                    );

                    if (relevantChunks.length > 0) {
                        // Create context from relevant chunks
                        const contextFromDoc = relevantChunks
                            .map(
                                (chunk) =>
                                    `--- From document "${docInfo.fileName}" ---\n${chunk.pageContent}\n`
                            )
                            .join("\n");

                        documentContext += contextFromDoc + "\n\n";
                    }
                } catch (queryError) {
                    console.error(
                        `Error querying document ${docInfo.id}:`,
                        queryError
                    );
                }
            }
        }

        // Create a system message that includes file content information
        let systemMessage: Message = {
            role: "system",
            content: 'You are Lumos, a helpful AI assistant that can analyze various types of files including documents, images, and data. ' +
            'When providing mathematical expressions, always use LaTeX notation surrounded by $ for inline math or $$ for block math. ' +
            'Follow these rules for mathematical expressions:\n' +
            '1. Always use $\\text{sin}(x)$, $\\text{cos}(x)$, etc. for trigonometric functions (with \\text{})\n' +
            '2. Use proper fractions like $\\frac{a}{b}$ with curly braces, never $\\frac ab$\n' +
            '3. For derivatives, use $\\frac{d}{dx}$ notation with curly braces\n' +
            '4. For subscripts and superscripts with multiple characters, use curly braces: $x_{123}$ not $x_123$\n' +
            '5. For equations with = signs, always wrap in math delimiters: $a = b + c$\n' +
            '6. For matrices and tables, use $$ delimiters (block math)\n' +
            '7. For math problems from uploaded files, be extra careful to use proper LaTeX formatting in your answers\n' +
            '8. When solving math problems, wrap each equation and mathematical expression with appropriate $ delimiters\n' +
            '9. For coordinate points, always write them as $(x, y)$ with delimiters\n' +
            '10. For equations containing square brackets like [x^2 - y + 1 = 0], convert them to $x^2 - y + 1 = 0$\n' +
            '11. When writing steps for solving math problems, add delimiters to all mathematical expressions\n' +
            '12. When solving uploaded math problems with derivatives, always format expressions like $\\frac{dy}{dx}$ and $\\frac{d}{dx}(x^2)$ with proper LaTeX\n' +
            '13. For implicit differentiation steps, format expressions like $2x - y - x\\frac{dy}{dx} + 2y\\frac{dy}{dx} = 0$ with proper delimiters\n' +
            '14. Always wrap expressions in square brackets with math delimiters: $expression$ (not $[expression]$)\n' +
            '15. When solving calculus problems, ensure all derivatives, integrals, and limits use proper LaTeX notation with delimiters\n' +
            '16. For normal line problems, always format expressions like $x^2 - xy + y^2 = 36$ with proper delimiters\n' +
            '17. When solving implicit differentiation problems, always wrap each step in proper math delimiters\n' +
            '18. For any expression containing \\frac, ensure it is wrapped in $ delimiters\n' +
            '19. When writing coordinate points like (6, 6), always format as $(6, 6)$ with delimiters\n' +
            '20. For variable substitutions like (x = 6), always format as $(x = 6)$ with delimiters\n' +
            '21. When solving step-by-step problems, use the format "1. Step description: $math expression$"\n' +
            '22. For implications in equations, use $\\implies$ symbol: $x = 2 \\implies x^2 = 4$\n' +
            '23. When writing solutions to uploaded problems, format them exactly like ChatGPT does, with clean LaTeX math expressions\n' +
            '24. Use display math ($$...$$) for important equations that should be centered on their own line\n' +
            '25. For step-by-step solutions, number each step and ensure all math is properly formatted with LaTeX'
        };

        if (files && files.length > 0) {
            if (hasUnprocessableFiles) {
                systemMessage.content += `\n\nThe user has uploaded some complex files. Do your best to analyze them with the provided information.`;
            }

            if (fileContents) {
                systemMessage.content += `\n\nThe user has uploaded the following files. Here's the content of these files: \n${fileContents}\n\nPlease help the user analyze and understand these files. Answer their questions based on the content.`;
            }

            // Add RAG retrieved content if available
            if (documentContext) {
                systemMessage.content += `\n\nThe following specific information is retrieved from the user's documents based on their query:\n\n${documentContext}\n\nYour answer should prioritize this retrieved information.`;
            }

            // Log the first 500 characters of the system message to check if file contents are included
            console.log(
                "System message preview (first 500 chars):",
                (systemMessage.content as string).substring(0, 500)
            );
            console.log("System message length:", (systemMessage.content as string).length);

            // Check if the system message contains Java code markers
            const containsJavaCode = (systemMessage.content as string).includes("```java");
            console.log(
                "System message contains Java code blocks:",
                containsJavaCode
            );

            // Add specific instructions for Java files
            if (containsJavaCode) {
                systemMessage.content += `\n\nIMPORTANT: The uploaded files include Java code. You should analyze this code by explaining:
1. The classes and their relationships
2. The methods and their purposes
3. The functionality of the code
4. Any design patterns or notable features in the implementation`;
            }

            // Check if the system message contains C++ code markers
            const containsCppCode =
                (systemMessage.content as string).includes("```cpp") ||
                (systemMessage.content as string).includes("```c") ||
                (systemMessage.content as string).includes("```h") ||
                (systemMessage.content as string).includes("```hpp");
            console.log(
                "System message contains C++ code blocks:",
                containsCppCode
            );

            // Add specific instructions for C++ files
            if (containsCppCode) {
                systemMessage.content += `\n\nIMPORTANT: The uploaded files include C++ code. You should analyze this code by explaining:
1. The functions, classes, and their relationships
2. The purpose of each component
3. The overall functionality of the code
4. Memory management and pointer usage
5. Any algorithms or data structures used
6. Potential optimization opportunities or issues`;
            }

            // Check if the system message contains Python code markers
            const containsPythonCode =
                (systemMessage.content as string).includes("```python") ||
                (systemMessage.content as string).includes("```py");
            console.log(
                "System message contains Python code blocks:",
                containsPythonCode
            );

            // Add specific instructions for Python files
            if (containsPythonCode) {
                systemMessage.content += `\n\nIMPORTANT: The uploaded files include Python code. You should analyze this code by explaining:
1. The functions, classes, and their relationships
2. The purpose of each component
3. The overall functionality of the code
4. Any libraries or frameworks used
5. Potential optimizations or Pythonic improvements`;
            }

            // Check if the system message contains JavaScript/TypeScript code markers
            const containsJsCode =
                (systemMessage.content as string).includes("```js") ||
                (systemMessage.content as string).includes("```jsx") ||
                (systemMessage.content as string).includes("```ts") ||
                (systemMessage.content as string).includes("```tsx");
            console.log(
                "System message contains JavaScript/TypeScript code blocks:",
                containsJsCode
            );

            // Add specific instructions for JavaScript/TypeScript files
            if (containsJsCode) {
                systemMessage.content += `\n\nIMPORTANT: The uploaded files include JavaScript/TypeScript code. You should analyze this code by explaining:
1. The functions, objects, and their relationships
2. Any frameworks or libraries being used
3. The overall functionality of the code
4. Async patterns and error handling
5. Type definitions (for TypeScript)
6. Potential optimizations or best practices`;
            }

            // Check for other programming languages using regex
            const codeBlockRegex = /```([a-zA-Z0-9]+)\n/g;
            const matches = [...(systemMessage.content as string).matchAll(codeBlockRegex)];
            const languagesFound = matches
                .map((match) => match[1])
                .filter(
                    (lang) =>
                        ![
                            "java",
                            "cpp",
                            "c",
                            "h",
                            "hpp",
                            "python",
                            "py",
                            "js",
                            "jsx",
                            "ts",
                            "tsx",
                        ].includes(lang.toLowerCase())
                );

            // Add instructions for other programming languages if found
            if (languagesFound.length > 0) {
                // Get unique languages
                const uniqueLanguages = [...new Set(languagesFound)];
                // Get friendly language names where possible
                const friendlyNames = uniqueLanguages.map((ext) =>
                    getLanguageFromExtension(ext) !== "Unknown"
                        ? getLanguageFromExtension(ext)
                        : ext
                );

                systemMessage.content += `\n\nIMPORTANT: The uploaded files include code in the following languages: ${friendlyNames.join(
                    ", "
                )}. For each language, please:
1. Identify the main components and their relationships
2. Explain the functionality and purpose of the code
3. Analyze any language-specific patterns or features
4. Point out any notable algorithms or data structures
5. Suggest improvements or optimizations where appropriate`;
            }

            // Check if the system message is too long
            if ((systemMessage.content as string).length > 100000) {
                console.log(
                    "Warning: System message is very long:",
                    (systemMessage.content as string).length,
                    "characters"
                );
            }
        }

        // Format messages for API
        const formattedMessages: Message[] = [
            systemMessage,
        ];

        // For code files, add an explicit assistant message showing the file content
        // This ensures code files are visible to the model even if there's an issue with the system message
        if (files && files.length > 0) {
            const codeFiles = files.filter(
                (file: FileData) =>
                    file.name.endsWith(".java") ||
                    file.name.endsWith(".py") ||
                    file.name.endsWith(".js") ||
                    file.name.endsWith(".ts") ||
                    file.name.endsWith(".cpp") ||
                    file.name.endsWith(".c") ||
                    file.name.endsWith(".h") ||
                    file.name.endsWith(".hpp") ||
                    file.name.endsWith(".cs") ||
                    file.name.endsWith(".go") ||
                    file.name.endsWith(".rs") ||
                    file.name.endsWith(".rb") ||
                    file.name.endsWith(".php") ||
                    file.name.endsWith(".swift") ||
                    file.name.endsWith(".kt") ||
                    file.name.endsWith(".scala")
            );

            if (codeFiles.length > 0) {
                for (const file of codeFiles) {
                    try {
                        const base64Content = file.content.split(",")[1];
                        const content = Buffer.from(
                            base64Content,
                            "base64"
                        ).toString("utf-8");
                        const fileExt =
                            file.name.split(".").pop()?.toLowerCase() || "";

                        // Add detailed information for different programming languages
                        let languageDescription =
                            getLanguageFromExtension(fileExt);
                        let additionalInfo = "";

                        // Add language-specific context
                        if (
                            fileExt === "cpp" ||
                            fileExt === "c" ||
                            fileExt === "h" ||
                            fileExt === "hpp"
                        ) {
                            additionalInfo =
                                " I'll analyze the data structures, memory management, and algorithms in this code.";
                        } else if (fileExt === "java") {
                            additionalInfo =
                                " I'll examine the classes, methods, and object-oriented design.";
                        } else if (fileExt === "py") {
                            additionalInfo =
                                " I'll look at the functionality and any libraries or frameworks used.";
                        } else if (fileExt === "js" || fileExt === "ts") {
                            additionalInfo =
                                " I'll examine the functionality, any frameworks used, and code structure.";
                        }

                        // Add an assistant message that explicitly shows the code
                        formattedMessages.push({
                            role: "assistant",
                            content: `I see you've uploaded a ${languageDescription} file named ${file.name}.${additionalInfo} Here's the content:\n\n\`\`\`${fileExt}\n${content}\n\`\`\``,
                        });

                        console.log(
                            `Added explicit assistant message for ${file.name}`
                        );
                    } catch (error) {
                        console.error(
                            `Error adding explicit message for ${file.name}:`,
                            error
                        );
                    }
                }
            }
        }

        // Add user messages with appropriate content format
        if (messages && Array.isArray(messages)) {
            for (const msg of messages) {
                if (
                    msg &&
                    typeof msg.role === "string" &&
                    (msg.role === "user" ||
                        msg.role === "assistant" ||
                        msg.role === "system")
                ) {
                    formattedMessages.push({
                        role: msg.role as "user" | "assistant" | "system",
                        content: msg.content || "",
                    });
                }
            }
        }

        // Handle the case where there are image files
        if (hasImageFiles && imageUrls.length > 0) {
            // Find the last user message index
            let lastUserMessageIndex = -1;
            for (let i = formattedMessages.length - 1; i >= 0; i--) {
                if (formattedMessages[i].role === "user") {
                    lastUserMessageIndex = i;
                    break;
                }
            }

            if (lastUserMessageIndex !== -1) {
                // Create a content array that includes images
                const contentArray: any[] = [];

                // Add the text content
                const currentContent =
                    formattedMessages[lastUserMessageIndex].content;
                contentArray.push({
                    type: "text",
                    text:
                        typeof currentContent === "string"
                            ? currentContent
                            : "Please analyze these files",
                });

                // Add each image, making sure the URL is valid and NOT a PDF
                for (const img of imageUrls) {
                    if (img.url && img.url.startsWith("data:")) {
                        // Check if it's a PDF being sent as an image
                        const isPdf =
                            img.name.startsWith("PDF document:") || 
                            img.name.includes("PDF document") ||
                            (img.name &&
                                img.name.toLowerCase().includes("pdf"));

                        // Add a special message if it's a PDF being treated as an image
                        if (isPdf) {
                            // Add text explaining this is a PDF
                            contentArray.push({
                                type: "text",
                                text: `I've attached a PDF document named "${img.name}". This is a visual representation of the PDF content. Please analyze what you can see in this document, including text content, form fields, headers, logos, tables, and any other visual elements you can identify.\n\n`,
                            });
                        }

                        // Add the image/PDF content
                        contentArray.push({
                            type: "image_url",
                            image_url: {
                                url: img.url,
                                detail: "high",
                            },
                        });
                    }
                }

                // Replace the content with the array if we have valid images
                if (contentArray.length > 1) {
                    formattedMessages[lastUserMessageIndex].content =
                        contentArray;
                }
            }

            // Only use the vision model if we actually have real images or PDFs
            const validImageCount = imageUrls.filter(
                (img) => img.url && img.url.startsWith("data:image/")
            ).length;

            // Check if we have PDFs that should be processed visually
            const hasPdfsForVisualProcessing = imageUrls.some(
                (img) => img.name.startsWith('PDF document:')
            );

            if (validImageCount > 0 || hasPdfsForVisualProcessing) {
                // Use a vision-capable model
                try {
                    console.log(
                        "Using gemini-2.0-flash for processing images/PDFs"
                    );
                    
                    // Generate cache key for vision model requests
                    const cacheKey = generateCacheKey(formattedMessages as any, GEMINI_MODELS.GEMINI_FLASH);
                    const cachedEntry = responseCache.get(cacheKey);
                    
                    // Use cached response if available and valid
                    if (cachedEntry && isCacheValid(cachedEntry)) {
                        console.log("Using cached vision model response");
                        return NextResponse.json({
                            ...cachedEntry!.response,
                            _cached: true,
                            pdfStats
                        });
                    }
                    
                    // If no cache hit, make the API call
                    console.log("Making multimodal API call with gemini-2.0-flash");
                    
                    // Use the multimodal function with the flash model for handling images
                    const response = await generateMultimodalResponse(
                        formattedMessages as any,
                        GEMINI_MODELS.GEMINI_FLASH,
                        0.7,
                        3000
                    ) as any;
                    
                    // Cache the response
                    responseCache.set(cacheKey, {
                        response: response,
                        timestamp: Date.now()
                    });

                    // Log PDF stats
                    console.log(
                        "PDF Processing Statistics:",
                        JSON.stringify(pdfStats, null, 2)
                    );

                    // Return the multimodal response with NextResponse
                    return NextResponse.json(response.choices[0].message);
                } catch (error) {
                    console.error("Error with vision model:", error);

                    // Create a simple text-only version of messages for fallback
                    const fallbackMessages = formattedMessages.map((msg) => {
                        return {
                            role: msg.role,
                            content:
                                typeof msg.content === "string"
                                    ? msg.content
                                    : "Please analyze the files that were uploaded. I cannot show you the images directly.",
                        };
                    });

                    // Use a simpler model with shorter outputs but still use the flash model
                    const fallbackModel = GEMINI_MODELS.GEMINI_FLASH;
                    
                    // If the error is a timeout or rate limit, use a simpler model
                    if (error instanceof Error && 
                        (error.message.includes('timeout') || 
                         error.message.includes('rate limit') ||
                         error.message.includes('429'))) {
                        console.log('Falling back after timeout or rate limit, but still using gemini-2.0-flash');
                        
                        // Still use the flash model but with reduced token count
                        return NextResponse.json({
                            role: 'assistant',
                            content: await generateGeminiResponse(
                                fallbackMessages as any,
                                GEMINI_MODELS.GEMINI_FLASH,
                                0.7,
                                500 // Limit token count for fallback
                            ).then(res => res.choices[0].message.content)
                        });
                    }
                    
                    // Fall back to regular model if multimodal processing fails
                    const fallbackResponse = await callModelWithTimeout(
                        fallbackMessages as any,
                        fallbackModel,
                        0.7,
                        3000
                    ) as any; // Type assertion

                    // Add detailed PDF metrics to response if we processed PDFs
                    return NextResponse.json(
                        pdfStats.totalCount > 0
                            ? {
                                ...fallbackResponse.choices[0].message,
                                __debug:
                                    process.env.NODE_ENV === "development"
                                        ? {
                                            pdfStats,
                                            modelUsed: fallbackModel,
                                        }
                                        : undefined,
                            }
                            : fallbackResponse.choices[0].message
                    );
                }
            } else {
                // If we only have PDFs, use the standard text model
                const response = await callModelWithTimeout(
                    formattedMessages as any,
                    GEMINI_MODELS.GEMINI_FLASH,
                    0.7,
                    3000
                ) as any; // Type assertion

                // Log PDF stats
                console.log(
                    "PDF Processing Statistics:",
                    JSON.stringify(pdfStats, null, 2)
                );

                // Log information about the messages sent to Gemini
                console.log(
                    "Messages sent to Gemini:",
                    formattedMessages.map((msg) => ({
                        role: msg.role,
                        contentType: typeof msg.content,
                        contentLength:
                            typeof msg.content === "string"
                                ? msg.content.length
                                : "array",
                        contentPreview:
                            typeof msg.content === "string"
                                ? msg.content.substring(0, 100) + "..."
                                : "array content",
                    }))
                );

                // Add detailed PDF metrics to response
                return NextResponse.json(
                    pdfStats.totalCount > 0
                        ? {
                              ...response.choices[0].message,
                              __debug:
                                  process.env.NODE_ENV === "development"
                                      ? {
                                            pdfStats,
                                            modelUsed: GEMINI_MODELS.GEMINI_FLASH,
                                            note: "Used text model because no valid images were found",
                                        }
                                      : undefined,
                          }
                        : response.choices[0].message
                );
            }
        } else {
            // Standard text processing
            try {
                console.log("Using standard text processing with timeout");
                const response = await callModelWithTimeout(
                    formattedMessages as any,
                    GEMINI_MODELS.GEMINI_FLASH,
                    0.7,
                    3000
                ) as any; // Type assertion

                // Log information about the messages sent to Gemini
                console.log(
                    "Messages sent to Gemini:",
                    formattedMessages.map((msg) => ({
                        role: msg.role,
                        contentType: typeof msg.content,
                        contentLength:
                            typeof msg.content === "string"
                                ? msg.content.length
                                : "array",
                        contentPreview:
                            typeof msg.content === "string"
                                ? msg.content.substring(0, 100) + "..."
                                : "array content",
                    }))
                );

                // Add detailed PDF metrics to response if we processed PDFs
                return NextResponse.json(
                    pdfStats.totalCount > 0
                        ? {
                              ...response.choices[0].message,
                              __debug:
                                  process.env.NODE_ENV === "development"
                                      ? {
                                            pdfStats,
                                            modelUsed: GEMINI_MODELS.GEMINI_FLASH,
                                        }
                                      : undefined,
                          }
                        : response.choices[0].message
                );
            } catch (error) {
                console.error("Error in text processing:", error);
                // Fallback to an extremely simple response
                return NextResponse.json({
                    role: "assistant",
                    content: "I'm sorry, but I couldn't process your request due to a server timeout. Please try again with a smaller file or simpler query."
                });
            }
        }

        // For non-image files, make sure they're included directly in the user message
        // Find the last user message index again to ensure we're working with the updated message structure
        if (files && files.length > 0 && fileContents && !hasImageFiles) {
            let lastUserMessageIndex = -1;
            for (let i = formattedMessages.length - 1; i >= 0; i--) {
                if (formattedMessages[i].role === "user") {
                    lastUserMessageIndex = i;
                    break;
                }
            }

            if (lastUserMessageIndex !== -1) {
                // Get current content
                const currentContent =
                    formattedMessages[lastUserMessageIndex].content;
                let userContent =
                    typeof currentContent === "string"
                        ? currentContent
                        : "Please analyze these files";

                // Append file content directly to the user message
                userContent +=
                    "\n\nHere are the file contents:\n" + fileContents;

                // Add a specific note for Java files to ensure they are recognized
                if (fileContents.includes("```java")) {
                    userContent +=
                        "\n\nNOTE: The content above includes Java code. Please analyze it and explain what it does.";
                }

                // Add a specific note for C++ files
                if (
                    fileContents.includes("```cpp") ||
                    fileContents.includes("```c") ||
                    fileContents.includes("```h") ||
                    fileContents.includes("```hpp")
                ) {
                    userContent +=
                        "\n\nNOTE: The content above includes C++ code. Please analyze the algorithms, data structures, memory management, and overall functionality.";
                }

                // Add a specific note for Python files
                if (
                    fileContents.includes("```python") ||
                    fileContents.includes("```py")
                ) {
                    userContent +=
                        "\n\nNOTE: The content above includes Python code. Please analyze it and explain the functionality, design patterns, and any libraries being used.";
                }

                // Add a specific note for JavaScript/TypeScript files
                if (
                    fileContents.includes("```js") ||
                    fileContents.includes("```jsx") ||
                    fileContents.includes("```ts") ||
                    fileContents.includes("```tsx")
                ) {
                    userContent +=
                        "\n\nNOTE: The content above includes JavaScript/TypeScript code. Please analyze it, including any frameworks, async patterns, and overall functionality.";
                }

                // Generic note for any other programming languages
                const codeBlockRegex = /```([a-zA-Z0-9]+)\n/g;
                const matches = [...fileContents.matchAll(codeBlockRegex)];
                const languagesFound = matches
                    .map((match) => match[1])
                    .filter(
                        (lang) =>
                            ![
                                "java",
                                "cpp",
                                "c",
                                "h",
                                "hpp",
                                "python",
                                "py",
                                "js",
                                "jsx",
                                "ts",
                                "tsx",
                            ].includes(lang.toLowerCase())
                    );

                if (languagesFound.length > 0) {
                    // Get unique languages
                    const uniqueLanguages = [...new Set(languagesFound)];
                    // Get friendly language names where possible
                    const friendlyNames = uniqueLanguages.map((ext) =>
                        getLanguageFromExtension(ext) !== "Unknown"
                            ? getLanguageFromExtension(ext)
                            : ext
                    );

                    userContent += `\n\nNOTE: The content above includes code in the following languages: ${friendlyNames.join(
                        ", "
                    )}. Please analyze the code structure, functionality, and purpose.`;
                }

                console.log(
                    "Enhanced user message with file contents, new length:",
                    userContent.length
                );

                // Update the message
                formattedMessages[lastUserMessageIndex].content = userContent;
            }
        }

        // Process the user's message to detect dataset generation requests
        const userMessage = messages[messages.length - 1];
        if (userMessage.role === 'user') {
            // Define types for message content items
            type ContentItem = {
                type: string;
                text?: string;
                image_url?: { url: string };
            };
            
            const content = typeof userMessage.content === 'string' 
                ? userMessage.content 
                : Array.isArray(userMessage.content) 
                    ? userMessage.content.filter((item: ContentItem) => item.type === 'text').map((item: ContentItem) => item.text || '').join(' ')
                    : '';

            // Check for dataset generation requests
            const datasetRegex = /generate\s+(?:a|an)\s+(?<rows>\d+)?\s*(?:row)?\s*(?<format>\w+)?\s*(?:dataset|data\s*set)/i;
            const match = content.match(datasetRegex);

            if (match) {
                // Extract parameters from the request
                const format = match.groups?.format || 'csv';
                const rows = parseInt(match.groups?.rows || '10', 10);

                // Extract schema information if provided
                const schemaRegex = /with\s+(?:columns|fields)\s+(?<schema>.*?)(?:$|in\s+|format\s+|with\s+)/i;
                const schemaMatch = content.match(schemaRegex);
                
                let schema: Record<string, string> = {};
                if (schemaMatch && schemaMatch.groups?.schema) {
                    // Parse the schema from the message
                    const schemaText = schemaMatch.groups.schema;
                    const columnRegex = /(\w+)\s+(?:as\s+)?(\w+)/g;
                    let columnMatch;
                    
                    while ((columnMatch = columnRegex.exec(schemaText)) !== null) {
                        const [_, columnName, columnType] = columnMatch;
                        schema[columnName] = columnType;
                    }
                }

                // If no schema was provided or parsed, use default schema
                if (Object.keys(schema).length === 0) {
                    schema = {
                        id: 'integer',
                        name: 'string',
                        value: 'float'
                    };
                }

                // Generate the dataset
                const dataset = generateRandomDataset({
                    rows,
                    format,
                    schema,
                    name: `${format}_dataset`,
                    includeHeaders: true
                });

                console.log(`Generated ${format} dataset with ${rows} rows`);

                // Create a response with the dataset in the proper format
                const responseContent = `I've generated a ${rows}-row ${format.toUpperCase()} dataset for you. Here it is:

\`\`\`dataset-${format}
${dataset.content}
\`\`\`

You can download this file using the download button above.`;

                // Return the response using NextResponse
                return NextResponse.json({
                    role: 'assistant',
                    content: responseContent
                });
            }
        }

        // Prepare the messages for the API call
        const apiMessages = [
            ...formattedMessages,
        ];

        // Check if we have a cached response
        const cacheKey = generateCacheKey(apiMessages, GEMINI_MODELS.GEMINI_FLASH);
        const cachedEntry = responseCache.get(cacheKey);
        
        if (cachedEntry && isCacheValid(cachedEntry)) {
            console.log("Using cached response");
            return NextResponse.json(cachedEntry!.response);
        }

        // If no cache hit, make the API call
        const response = await callModelWithTimeout(
            apiMessages as any,
            GEMINI_MODELS.GEMINI_FLASH,
            0.7,
            3000
        ) as any; // Type assertion

        // Cache the response
        responseCache.set(cacheKey, {
            response: response,
            timestamp: Date.now()
        });

        // Ensure we return a NextResponse object
        return NextResponse.json(response);
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return NextResponse.json(
            {
                error: "Failed to communicate with AI. Please try again.",
                details:
                    error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// Process files and extract their content
async function processFiles(files: FileData[]): Promise<{
    contents: string;
    hasUnprocessableFiles: boolean;
    hasImageFiles: boolean;
    imageUrls: { url: string; name: string }[];
    pdfStats: {
        totalCount: number;
        successCount: number;
        failureCount: number;
        methodsUsed: string[];
        errors: string[];
    };
}> {
    let combinedText = "";
    let hasUnprocessableFiles = false;
    let hasImageFiles = false;
    const imageUrls: { url: string; name: string }[] = [];
    const pdfStats = {
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        methodsUsed: [] as string[],
        errors: [] as string[],
    };

    // Skip processing if no files
    if (!files || files.length === 0) {
        return {
            contents: "",
            hasUnprocessableFiles: false,
            hasImageFiles: false,
            imageUrls: [],
            pdfStats,
        };
    }

    // Limit processing to max 5 files to avoid timeout
    const filesToProcess = files.slice(0, 5);
    if (files.length > 5) {
        console.log(`Limiting processing to 5 files out of ${files.length} to avoid timeout`);
        hasUnprocessableFiles = true;
    }

    // Define a type for the processing results
    type ProcessingResult = {
        text: string;
        isImage: boolean;
        isUnprocessable: boolean;
        imageUrl: { url: string; name: string } | null;
        pdfStats: {
            totalCount: number;
            successCount: number;
            failureCount: number;
            methodsUsed: string[];
            errors: string[];
        } | null;
    };

    // Create a timeout promise
    const timeout = (ms: number) => new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Processing timed out after ${ms}ms`)), ms)
    );

    // Process files with timeout protection
    const processingResults = await Promise.all(
        filesToProcess.map(async (file) => {
            // Skip invalid files
            if (!file || !file.id || !file.content) {
                return {
                    text: "",
                    isImage: false,
                    isUnprocessable: true,
                    imageUrl: null,
                    pdfStats: null,
                } as ProcessingResult;
            }

            // Check if we have this file in cache
            const fileId = getFileIdentifier(file);
            const cachedFile = fileProcessingCache.get(fileId);
            
            if (cachedFile && (Date.now() - cachedFile.timestamp < CACHE_TTL)) {
                console.log(`Using cached processing result for file: ${file.name}`);
                return {
                    text: cachedFile.content,
                    isImage: file.type.startsWith("image/"),
                    isUnprocessable: false,
                    imageUrl: file.type.startsWith("image/") ? { url: file.content, name: file.name } : null,
                    pdfStats: null,
                } as ProcessingResult;
            }

            try {
                // Use a processing timeout to avoid hanging the function
                return await Promise.race([
                    (async () => {
                        // Process based on file type
                        if (file.type.startsWith("image/")) {
                            // It's an image file - quick processing
                            const result = {
                                text: `[Image: ${file.name}]`,
                                isImage: true,
                                isUnprocessable: false,
                                imageUrl: { url: file.content, name: file.name },
                                pdfStats: null,
                            } as ProcessingResult;
                            
                            // Cache the result
                            fileProcessingCache.set(fileId, {
                                content: result.text,
                                timestamp: Date.now()
                            });
                            
                            return result;
                        } 
                        else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
                            // Check if PDF text extraction is enabled
                            const pdfTextExtractionEnabled = process.env.ENABLE_PDF_TEXT_EXTRACTION === 'true';
                            
                            // For PDFs, use a simplified approach in production unless text extraction is explicitly enabled
                            if (process.env.NODE_ENV === 'production' && !pdfTextExtractionEnabled) {
                                try {
                                    // In production, try to extract text but also provide visual processing
                                    console.log("Production mode: Using combined PDF handling approach");
                                    
                                    // Convert file content from base64 to buffer
                                    const contentParts = file.content.split(',');
                                    const base64Content = contentParts.length > 1 ? contentParts[1] : contentParts[0];
                                    const buffer = Buffer.from(base64Content, 'base64');
                                    
                                    // Try to extract basic metadata and text
                                    const metadata = await simplePdfMetadata(buffer);
                                    
                                    // Format a helpful text representation that includes metadata
                                    let pdfText = `[PDF Document: ${file.name}]\n\n`;
                                    pdfText += `Pages: ${metadata.pageCount || 'Unknown'}\n`;
                                    if (metadata.title && metadata.title !== 'Unknown') pdfText += `Title: ${metadata.title}\n`;
                                    if (metadata.author && metadata.author !== 'Unknown') pdfText += `Author: ${metadata.author}\n`;
                                    if (metadata.subject) pdfText += `Subject: ${metadata.subject}\n`;
                                    
                                    // Include both text representation and provide image URL for visual processing
                                    const result = {
                                        text: pdfText,
                                        isImage: true, // Also provide for visual processing
                                        isUnprocessable: false,
                                        imageUrl: { url: file.content, name: `PDF document: ${file.name}` },
                                        pdfStats: {
                                            totalCount: 1,
                                            successCount: 1,
                                            failureCount: 0,
                                            methodsUsed: ["production_combined_approach"],
                                            errors: [],
                                        },
                                    } as ProcessingResult;
                                    
                                    // Cache the result
                                    fileProcessingCache.set(fileId, {
                                        content: result.text,
                                        timestamp: Date.now()
                                    });
                                    
                                    return result;
                                } catch (error) {
                                    // Fallback to simple visual processing if errors occur
                                    console.log("Production mode: Falling back to simplified visual PDF handling");
                                    const result = {
                                        text: `[PDF Document: ${file.name} - Content will be processed visually]`,
                                        isImage: true, // Treat as image so it gets visual processing
                                        isUnprocessable: false,
                                        imageUrl: { url: file.content, name: `PDF document: ${file.name}` },
                                        pdfStats: {
                                            totalCount: 1,
                                            successCount: 1,
                                            failureCount: 0,
                                            methodsUsed: ["simplified_production_fallback"],
                                            errors: [],
                                        },
                                    } as ProcessingResult;
                                    
                                    // Cache the result
                                    fileProcessingCache.set(fileId, {
                                        content: result.text,
                                        timestamp: Date.now()
                                    });
                                    
                                    return result;
                                }
                            }
                            // In development, extract text from PDF using our simple PDF extractor
                            try {
                                // Convert file content from base64 to buffer
                                const contentParts = file.content.split(',');
                                const base64Content = contentParts.length > 1 ? contentParts[1] : contentParts[0];
                                const buffer = Buffer.from(base64Content, 'base64');
                                
                                console.log(`Processing PDF file: ${file.name}`);
                                
                                // Extract text using our simple PDF extractor
                                const extractedText = await extractPdfText(buffer);
                                // Extract structure for better context
                                const structure = await extractPdfStructure(buffer);
                                
                                // Combine text and structure
                                let pdfContent = extractedText;
                                if (structure && structure.length > 0) {
                                    pdfContent += "\n\n--- Document Structure ---\n" + structure;
                                }
                                
                                const result = {
                                    text: pdfContent,
                                    isImage: false, // We're extracting text, so don't treat as image
                                    isUnprocessable: false,
                                    imageUrl: null,
                                    pdfStats: {
                                        totalCount: 1,
                                        successCount: 1,
                                        failureCount: 0,
                                        methodsUsed: ["pdfjs_text_extraction"],
                                        errors: [],
                                    },
                                } as ProcessingResult;
                                
                                // Cache the result
                                fileProcessingCache.set(fileId, {
                                    content: result.text,
                                    timestamp: Date.now()
                                });
                                
                                return result;
                            } catch (error) {
                                console.error(`Error extracting text from PDF ${file.name}:`, error);
                                
                                // Fallback to treating as image
                                return {
                                    text: `[PDF Document: ${file.name} - Could not extract text, will process visually]`,
                                    isImage: true,
                                    isUnprocessable: false,
                                    imageUrl: { url: file.content, name: `PDF document: ${file.name}` },
                                    pdfStats: {
                                        totalCount: 1,
                                        successCount: 0,
                                        failureCount: 1,
                                        methodsUsed: ["fallback_to_visual"],
                                        errors: [error instanceof Error ? error.message : "Unknown error"],
                                    },
                                } as ProcessingResult;
                            }
                        }
                        else if (
                            file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                            file.name.toLowerCase().endsWith(".docx")
                        ) {
                            try {
                                // Convert file content from base64 to buffer
                                const contentParts = file.content.split(',');
                                const base64Content = contentParts.length > 1 ? contentParts[1] : contentParts[0];
                                const buffer = Buffer.from(base64Content, 'base64');
                                
                                // Extract text from the DOCX file
                                const text = await extractOfficeText(buffer, file.type, file.name);
                                
                                const result = {
                                    text: `[DOCX Document: ${file.name}]\n\n${text}`,
                                    isImage: false,
                                    isUnprocessable: false,
                                    imageUrl: null,
                                    pdfStats: null,
                                } as ProcessingResult;
                                
                                // Cache the result
                                fileProcessingCache.set(fileId, {
                                    content: result.text,
                                    timestamp: Date.now()
                                });
                                
                                return result;
                            } catch (error) {
                                console.error(`Error processing DOCX file ${file.name}:`, error);
                                return {
                                    text: `[Error processing DOCX file: ${file.name} - ${error instanceof Error ? error.message : "Unknown error"}]`,
                                    isImage: false,
                                    isUnprocessable: true,
                                    imageUrl: null,
                                    pdfStats: null,
                                } as ProcessingResult;
                            }
                        }
                        else if (
                            file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
                            file.name.toLowerCase().endsWith(".xlsx")
                        ) {
                            try {
                                // Convert file content from base64 to buffer
                                const contentParts = file.content.split(',');
                                const base64Content = contentParts.length > 1 ? contentParts[1] : contentParts[0];
                                const buffer = Buffer.from(base64Content, 'base64');
                                
                                // Extract text from the XLSX file
                                const text = await extractOfficeText(buffer, file.type, file.name);
                                
                                const result = {
                                    text: `[Excel Document: ${file.name}]\n\n${text}`,
                                    isImage: false,
                                    isUnprocessable: false,
                                    imageUrl: null,
                                    pdfStats: null,
                                } as ProcessingResult;
                                
                                // Cache the result
                                fileProcessingCache.set(fileId, {
                                    content: result.text,
                                    timestamp: Date.now()
                                });
                                
                                return result;
                            } catch (error) {
                                console.error(`Error processing Excel file ${file.name}:`, error);
                                return {
                                    text: `[Error processing Excel file: ${file.name} - ${error instanceof Error ? error.message : "Unknown error"}]`,
                                    isImage: false,
                                    isUnprocessable: true,
                                    imageUrl: null,
                                    pdfStats: null,
                                } as ProcessingResult;
                            }
                        }
                        else if (
                            file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || 
                            file.name.toLowerCase().endsWith(".pptx")
                        ) {
                            try {
                                // Convert file content from base64 to buffer
                                const contentParts = file.content.split(',');
                                const base64Content = contentParts.length > 1 ? contentParts[1] : contentParts[0];
                                const buffer = Buffer.from(base64Content, 'base64');
                                
                                // Extract text from the PPTX file
                                const text = await extractOfficeText(buffer, file.type, file.name);
                                
                                const result = {
                                    text: `[PowerPoint Document: ${file.name}]\n\n${text}`,
                                    isImage: false,
                                    isUnprocessable: false,
                                    imageUrl: null,
                                    pdfStats: null,
                                } as ProcessingResult;
                                
                                // Cache the result
                                fileProcessingCache.set(fileId, {
                                    content: result.text,
                                    timestamp: Date.now()
                                });
                                
                                return result;
                            } catch (error) {
                                console.error(`Error processing PowerPoint file ${file.name}:`, error);
                                return {
                                    text: `[Error processing PowerPoint file: ${file.name} - ${error instanceof Error ? error.message : "Unknown error"}]`,
                                    isImage: false,
                                    isUnprocessable: true,
                                    imageUrl: null,
                                    pdfStats: null,
                                } as ProcessingResult;
                            }
                        }
                        
                        // For other file types, return a placeholder to avoid timeout
                        const result = {
                            text: `[File: ${file.name} (${file.type || "unknown type"})]`,
                            isImage: false,
                            isUnprocessable: false,
                            imageUrl: null,
                            pdfStats: null,
                        } as ProcessingResult;
                        
                        // Cache the result
                        fileProcessingCache.set(fileId, {
                            content: result.text,
                            timestamp: Date.now()
                        });
                        
                        return result;
                    })(),
                    timeout(5000) // 5 second timeout per file processing
                ]);
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                return {
                    text: `[Error processing file: ${file.name} - ${error instanceof Error ? error.message : "Unknown error"}]`,
                    isImage: false,
                    isUnprocessable: true,
                    imageUrl: null,
                    pdfStats: null,
                } as ProcessingResult;
            }
        })
    );

    // Combine the results
    for (const result of processingResults) {
        if (result.text) {
            combinedText += result.text + "\n\n";
        }
        if (result.isUnprocessable) {
            hasUnprocessableFiles = true;
        }
        if (result.isImage) {
            hasImageFiles = true;
        }
        if (result.imageUrl) {
            imageUrls.push(result.imageUrl);
        }
        if (result.pdfStats) {
            // Update PDF stats
            pdfStats.totalCount += result.pdfStats.totalCount;
            pdfStats.successCount += result.pdfStats.successCount;
            pdfStats.failureCount += result.pdfStats.failureCount;
            pdfStats.methodsUsed.push(...result.pdfStats.methodsUsed);
            pdfStats.errors.push(...result.pdfStats.errors);
        }
    }

    return {
        contents: combinedText.trim(),
        hasUnprocessableFiles,
        hasImageFiles,
        imageUrls,
        pdfStats,
    };
}

// Add some helper functions for advanced text extraction

// Helper for better text extraction from binary files
const extractTextFromBinary = (buffer: Buffer): string => {
    // Convert to string and look for text patterns
    const bufferText = buffer.toString(
        "utf-8",
        0,
        Math.min(buffer.length, 1024 * 1024)
    ); // Limit to 1MB to avoid memory issues

    // Extract text that looks like words (3+ consecutive words)
    const textMatches =
        bufferText.match(/[A-Za-z0-9][\w\.']+(\s+[\w\.']+){2,}/g) || [];

    // Filter out very short matches and programming language symbols
    const filteredMatches = textMatches
        .filter(
            (match) =>
                match.length > 15 && // Longer sequences
                !match.includes("function") && // Avoid code
                !match.includes("class") &&
                !match.includes("const") &&
                !match.includes("import") &&
                !match.includes("var ") &&
                !match.match(/\d+\.\d+\.\d+/) // Avoid version numbers
        )
        .map((match) => match.trim())
        .filter((match, index, self) => self.indexOf(match) === index); // Remove duplicates

    return filteredMatches.join("\n");
};

// Helper to detect file type from content
const detectFileTypeFromContent = (buffer: Buffer): string | null => {
    // Check for common file signatures (magic numbers)
    if (buffer.length < 4) return null;

    // PDF: %PDF
    if (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
    ) {
        return "application/pdf";
    }

    // ZIP-based (Office documents, etc): PK
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
        return "application/zip";
    }

    // PNG
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
    ) {
        return "image/png";
    }

    // JPEG: JFIF or Exif
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        return "image/jpeg";
    }

    // GIF: GIF87a or GIF89a
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return "image/gif";
    }

    return null;
};

// Helper function to map file extensions to language names
const getLanguageFromExtension = (extension: string): string => {
    const languageMap: Record<string, string> = {
        // Web technologies
        html: "HTML",
        htm: "HTML",
        css: "CSS",
        js: "JavaScript",
        jsx: "JavaScript (React)",
        ts: "TypeScript",
        tsx: "TypeScript (React)",
        json: "JSON",

        // Backend languages
        py: "Python",
        pyw: "Python",
        java: "Java",
        c: "C",
        cpp: "C++",
        h: "C/C++ Header",
        hpp: "C++ Header",
        cs: "C#",
        go: "Go",
        rs: "Rust",
        rb: "Ruby",
        php: "PHP",
        swift: "Swift",
        scala: "Scala",
        kt: "Kotlin",

        // Shell and scripting
        sh: "Shell Script",
        bash: "Bash Script",
        ps1: "PowerShell",
        psm1: "PowerShell Module",

        // Data and config
        sql: "SQL",
        yaml: "YAML",
        yml: "YAML",
        toml: "TOML",
        xml: "XML",
        xsl: "XSL",

        // Other languages
        r: "R",
        dart: "Dart",
        lua: "Lua",
        pl: "Perl",
        pm: "Perl Module",

        // Framework-specific
        vue: "Vue.js",
        svelte: "Svelte",

        // Documentation and config
        md: "Markdown",
        markdown: "Markdown",
        gitignore: "Git Configuration",
        env: "Environment Variables",
        config: "Configuration File",
        conf: "Configuration File",
        dockerfile: "Dockerfile",
        tf: "Terraform",
        hcl: "HCL",
    };

    return languageMap[extension] || "Unknown";
};

// Helper function to extract PDF metadata
async function extractPdfMetadata(
    pdfBuffer: Buffer
): Promise<Record<string, any>> {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);

        const metadata = {
            pageCount: pdfDoc.getPageCount(),
            title: pdfDoc.getTitle() || "Unknown",
            author: pdfDoc.getAuthor() || "Unknown",
            subject: pdfDoc.getSubject() || "",
            keywords: pdfDoc.getKeywords() || "",
            creationDate: pdfDoc.getCreationDate()?.toISOString() || "Unknown",
            modificationDate:
                pdfDoc.getModificationDate()?.toISOString() || "Unknown",
        };

        return metadata;
    } catch (error) {
        console.error("Error extracting PDF metadata:", error);
        return { error: "Failed to extract metadata" };
    }
}

// Add a fallback function that uses a simpler approach with canvas
async function renderPdfToImageWithCanvas(
    pdfBuffer: Buffer
): Promise<string[]> {
    try {
        // Load the PDF document using pdf-lib with error handling
        let pdfLib;
        try {
            // @ts-ignore - Ignore TypeScript errors for dynamic imports
            pdfLib = await import("pdf-lib");
        } catch (importError) {
            console.error("Error importing pdf-lib:", importError);
            throw new Error("Failed to import pdf-lib");
        }

        const pdfDoc = await pdfLib.PDFDocument.load(pdfBuffer);

        // Get the number of pages
        const pageCount = pdfDoc.getPageCount();
        console.log(`PDF loaded with pdf-lib: ${pageCount} pages`);

        const pagesToRender = Math.min(pageCount, 3); // Render up to 3 pages
        const images: string[] = [];

        // Create a canvas
        const canvas = require("canvas");

        // For each page
        for (let i = 0; i < pagesToRender; i++) {
            try {
                // Get the page
                const page = pdfDoc.getPage(i);

                // Get page dimensions
                const { width, height } = page.getSize();

                // Create a canvas with the page dimensions
                const canvasObj = canvas.createCanvas(width, height);
                const ctx = canvasObj.getContext("2d");

                // Fill with white background
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, width, height);

                // We can't render the PDF content directly with canvas,
                // but we can create a placeholder image that indicates this is a PDF
                ctx.fillStyle = "black";
                ctx.font = "20px Arial";
                ctx.textAlign = "center";
                ctx.fillText(`PDF Page ${i + 1}`, width / 2, height / 2 - 20);
                ctx.fillText(
                    `(PDF content will be analyzed visually)`,
                    width / 2,
                    height / 2 + 20
                );

                // Convert to data URL
                const dataUrl = canvasObj.toDataURL("image/png");
                images.push(dataUrl);

                console.log(`Created placeholder image for page ${i + 1}`);
            } catch (pageError) {
                console.error(
                    `Error creating placeholder for page ${i + 1}:`,
                    pageError
                );
            }
        }

        return images;
    } catch (error) {
        console.error("Error in canvas PDF to images conversion:", error);
        return [];
    }
}

// Add a simple function to create a placeholder image for PDFs
async function createPdfPlaceholderImage(filename: string): Promise<string> {
    try {
        // Create a canvas
        const canvas = require("canvas");
        const width = 800;
        const height = 1000;

        const canvasObj = canvas.createCanvas(width, height);
        const ctx = canvasObj.getContext("2d");

        // Fill with light blue background
        ctx.fillStyle = "#f0f8ff";
        ctx.fillRect(0, 0, width, height);

        // Add a PDF icon or text
        ctx.fillStyle = "#4a86e8";
        ctx.font = "bold 40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("PDF DOCUMENT", width / 2, height / 2 - 100);

        // Add the filename
        ctx.fillStyle = "black";
        ctx.font = "30px Arial";
        ctx.fillText(filename, width / 2, height / 2);

        // Add a message
        ctx.font = "20px Arial";
        ctx.fillText(
            "This PDF will be analyzed visually",
            width / 2,
            height / 2 + 100
        );

        // Convert to data URL
        const dataUrl = canvasObj.toDataURL("image/png");
        console.log(`Created PDF placeholder image for ${filename}`);

        return dataUrl;
    } catch (error) {
        console.error("Error creating PDF placeholder image:", error);
        return "";
    }
}

// Add a helper function to call Gemini with timeout
async function callModelWithTimeout(messages: any[], model: string, temperature: number = 0.7, maxTokens?: number): Promise<any> {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error(`Gemini API call timed out after 60 seconds`));
        }, 60000); // 60 second timeout
    });

    try {
        // Race between the API call and the timeout
        const response: any = await Promise.race([
            generateGeminiResponse(
                messages as any,
                model,
                temperature,
                maxTokens
            ),
            timeoutPromise
        ]);
        
        // Ensure we're returning a consistent format
        return response;
    } catch (error) {
        console.error(`Gemini API call failed (model: ${model}):`, error);
        
        // If the error is a timeout or rate limit, use a simpler model
        if (error instanceof Error && 
            (error.message.includes('timeout') || 
             error.message.includes('rate limit') ||
             error.message.includes('429'))) {
            console.log('Falling back after timeout or rate limit, but still using gemini-2.0-flash');
            
            // Still use the flash model but with reduced token count
            return NextResponse.json({
                role: 'assistant',
                content: await generateGeminiResponse(
                    messages as any,
                    GEMINI_MODELS.GEMINI_FLASH,
                    0.7,
                    500 // Limit token count for fallback
                ).then(res => res.choices[0].message.content)
            });
        }
        
        throw error; // Re-throw if it's not a timeout
    }
}
