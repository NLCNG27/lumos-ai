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
        // Get request data
        const body = await req.json();
        const { messages, model, temperature = 0.7, maxTokens: userMaxTokens = 3000, apiKey, conversationId, userId, files = [], useGroundingSearch = false } = body;

        // for Gemini, we need a higher token count to get a decent response
        const maxTokens = Math.max(Number(userMaxTokens), 1024);

        console.log(`Chat request:
          Model: ${model || 'default'}
          Temperature: ${temperature}
          Max Tokens: ${maxTokens}
          Files: ${files.length > 0 ? `${files.length} files` : 'No files'}
          ConversationId: ${conversationId || 'Not provided'}
          UseGroundingSearch: ${useGroundingSearch ? 'Yes' : 'No'}
        `);

        // Check if API key is provided and valid
        if (apiKey && !isValidAPIKey(apiKey)) {
            return NextResponse.json(
                { error: "Invalid API key provided" },
                { status: 400 }
            );
        }

        // Default response function - overridden based on the model
        let generateModelResponse = async (messages: any[], temperature: number, maxTokens: number) => {
            throw new Error("No model implementation selected");
        };

        let finalMessages = [...messages];

        // Add system message if it doesn't exist
        if (!finalMessages.some((m) => m.role === "system")) {
            finalMessages.unshift({
                role: "system",
                content: DEFAULT_SYSTEM_MESSAGE,
            });
        }

        // Process any uploaded files
        if (files && files.length > 0) {
            const processResult = await processFiles(files);
            
            const { contents, hasUnprocessableFiles, hasImageFiles, imageUrls } = processResult;

            if (hasUnprocessableFiles) {
                // Add warning about unprocessable files to the system message
                const warningSystem = finalMessages.find(m => m.role === 'system');
                if (warningSystem) {
                    warningSystem.content += "\n\nNote: Some files could not be processed due to their format or size limitations. Please use compatible file formats and keep files under size limits.";
                }
            }

            if (contents && contents.trim()) {
                // Add file content to the first user message
                const firstUserMessageIndex = finalMessages.findIndex(m => m.role === 'user');

                if (firstUserMessageIndex >= 0) {
                    // If user message is just text
                    if (typeof finalMessages[firstUserMessageIndex].content === 'string') {
                        finalMessages[firstUserMessageIndex].content = `${finalMessages[firstUserMessageIndex].content}\n\nHere are the file contents to analyze:\n\n${contents}`;
                    } 
                    // If it's already an array of content items
                    else if (Array.isArray(finalMessages[firstUserMessageIndex].content)) {
                        // Get all text items to modify
                        const textItems = finalMessages[firstUserMessageIndex].content.filter(
                            (item: ContentItem) => item.type === 'text'
                        );
                        
                        if (textItems.length > 0) {
                            textItems[0].text = `${textItems[0].text}\n\nHere are the file contents to analyze:\n\n${contents}`;
                        } else {
                            finalMessages[firstUserMessageIndex].content.push({
                                type: 'text',
                                text: `Here are the file contents to analyze:\n\n${contents}`
                            });
                        }
                    }
                } else {
                    // If no user message found, add a new one
                    finalMessages.push({
                        role: 'user',
                        content: `Here are the file contents to analyze:\n\n${contents}`
                    });
                }
            }

            // Add any image URLs as image content to a message
            if (imageUrls && imageUrls.length > 0 && (model?.includes('gemini') || !model)) {
                const firstUserMessage = finalMessages.find(m => m.role === 'user');
                
                if (firstUserMessage) {
                    // For Gemini, we need to convert to multimodal format
                    let newContent = [];
                    
                    // If the first user message is a string, convert it to a text content item
                    if (typeof firstUserMessage.content === 'string') {
                        newContent.push({
                            type: 'text',
                            text: firstUserMessage.content
                        });
                    } 
                    // If it's already an array, use it as is
                    else if (Array.isArray(firstUserMessage.content)) {
                        newContent = [...firstUserMessage.content];
                    }
                    
                    // Add the image URLs as content items
                    for (const imageUrl of imageUrls) {
                        newContent.push({
                            type: 'image_url',
                            image_url: {
                                url: imageUrl.url,
                                detail: 'auto' // or 'low' or 'high'
                            }
                        });
                    }
                    
                    // Update the message content
                    firstUserMessage.content = newContent;
                }
            }
        }

        // Select model implementation
        if (!model || model.includes('gemini')) {
            // Use Gemini
            if (hasMultimodalContent(finalMessages)) {
                // Use vision-capable Gemini for multimodal content
                generateModelResponse = async (messages, temperature, maxTokens) => {
                    return await generateMultimodalResponse(messages, GEMINI_MODELS.GEMINI_FLASH, temperature, maxTokens, useGroundingSearch);
                };
            } else {
                // Use standard Gemini for text-only
                generateModelResponse = async (messages, temperature, maxTokens) => {
                    return await callGeminiWithTimeout(messages, GEMINI_MODELS.GEMINI_FLASH, temperature, maxTokens, useGroundingSearch);
                };
            }
        } else if (model.includes('gpt')) {
            // Use OpenAI
            generateModelResponse = async (messages, temperature, maxTokens) => {
                return await callOpenAI(messages, model, temperature, maxTokens, apiKey);
            };
        } else {
            return NextResponse.json(
                { error: `Unsupported model: ${model}` },
                { status: 400 }
            );
        }

        // Generate the response
        const response = await generateModelResponse(
            finalMessages,
            temperature,
            maxTokens
        );

        // For streamed responses, we need to save them to the conversation
        // For now just save to the conversation if a conversationId was provided
        if (conversationId && userId) {
            try {
                // Save message
                await saveMessageToConversation(
                    conversationId,
                    finalMessages[finalMessages.length - 1],
                    response.choices[0].message,
                    userId
                );
            } catch (error) {
                console.error('Error saving message to conversation:', error);
                // Don't fail the request if this fails
            }
        }

        // Add grounding metadata to the response if available
        let groundingSources = null;
        if (useGroundingSearch && response.groundingMetadata) {
            groundingSources = response.groundingMetadata;
        }

        // Ensure we have a valid content field
        const content = response.choices?.[0]?.message?.content || "";

        // Return the response
        return NextResponse.json({
            content,
            groundingSources
        });

    } catch (error: any) {
        console.error("Error in chat API:", error);
        
        return NextResponse.json(
            {
                error: error.message || "An unknown error occurred",
            },
            {
                status: error.status || 500,
            }
        );
    }
}

// Helper function to check if messages contain multimodal content
const hasMultimodalContent = (messages: Message[]): boolean => {
    return messages.some(message => {
        if (Array.isArray(message.content)) {
            return message.content.some(item => 
                item.type === 'image_url' || 
                item.type === 'image'
            );
        }
        return false;
    });
};

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
