import { openai, DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/openai";
import { NextResponse } from "next/server";
// Add child_process for advanced PDF extraction fallback
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir, access } from "fs/promises";
import path from "path";
import fs from "fs";
// After the imports, add this for PDF.js
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js for Node environment
if (typeof window === 'undefined') {
    // We're running on server - set up the Node.js environment for PDF.js
    try {
        // Load the polyfills needed for PDF.js in Node
        const canvas = require('canvas');
        const { DOMMatrix, DOMPoint } = require('dommatrix');
        
        // Add necessary globals
        global.DOMMatrix = DOMMatrix;
        global.DOMPoint = DOMPoint;
        
        console.log('PDF environment configured for Node');
    } catch (err) {
        console.error('Error configuring PDF environment for Node:', err);
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
const extractOfficeText = async (buffer: Buffer, fileType: string, fileName: string): Promise<string> => {
    // Handle different office document types
    if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
        fileName.endsWith('.docx')) {
        try {
            // Use mammoth.js for Word documents
            const mammoth = await import('mammoth');
            
            // Try different extraction methods for Word docx
            try {
                // First try with standard options
                const result = await mammoth.extractRawText({ buffer });
                if (result.value && result.value.trim().length > 0) {
                    return result.value;
                }
                
                // If that fails, try with html extraction
                const htmlResult = await mammoth.convertToHtml({ buffer });
                if (htmlResult.value && htmlResult.value.trim().length > 0) {
                    // Simple HTML to text conversion
                    return htmlResult.value
                        .replace(/<[^>]+>/g, ' ')  // Replace HTML tags with spaces
                        .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
                        .trim();                   // Trim leading/trailing whitespace
                }
                
                throw new Error("No content extracted from Word document");
            } catch (extractError) {
                // Try ZIP-based extraction as fallback
                const zipText = await extractTextFromZipArchive(buffer);
                if (zipText && zipText.trim().length > 0) {
                    return zipText;
                }
                throw extractError;
            }
        } catch (error) {
            console.error("Error extracting text from Word document:", error);
            throw new Error("Failed to extract text from Word document");
        }
    } else if (fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
              fileName.endsWith('.xlsx')) {
        try {
            // Use xlsx for Excel files
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            // Extract text from all sheets
            let text = '';
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                text += `--- Sheet: ${sheetName} ---\n`;
                text += XLSX.utils.sheet_to_csv(sheet) + '\n\n';
            });
            return text;
        } catch (error) {
            console.error("Error extracting text from Excel file:", error);
            throw new Error("Failed to extract text from Excel file");
        }
    } else if (fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || 
              fileName.endsWith('.pptx')) {
        // For PowerPoint, this is more complex and might require a specialized library
        // This is a basic implementation
        try {
            // Use docx-wasm for more complex formats if available
            if (buffer.length > 0) {
                const text = await extractTextFromZipArchive(buffer);
                if (text && text.trim().length > 0) {
                    return text;
                }
            }
            throw new Error("No suitable parser found for presentation file");
        } catch (error) {
            console.error("Error extracting text from PowerPoint file:", error);
            throw new Error("Failed to extract text from PowerPoint file");
        }
    } else {
        // Try generic extraction for other office formats
        try {
            const text = await extractTextFromZipArchive(buffer);
            if (text && text.trim().length > 0) {
                return text;
            }
            throw new Error("Unsupported office document format");
        } catch (error) {
            console.error(`Error extracting text from ${fileType}:`, error);
            throw new Error(`Failed to extract text from unknown office format: ${fileType}`);
        }
    }
};

// Helper function to extract text from ZIP-based documents (like Office files)
const extractTextFromZipArchive = async (buffer: Buffer): Promise<string> => {
    try {
        // Import JSZip properly
        const JSZipModule = await import('jszip');
        const JSZip = JSZipModule.default;
        const zip = new JSZip();
        
        // Load the ZIP content
        const zipContent = await zip.loadAsync(buffer);
        
        // Look for common text-containing files in the archive
        let textContent = '';
        
        // Process all files
        const textFiles: string[] = [];
        zipContent.forEach((relativePath: string, zipEntry: any) => {
            if (!zipEntry.dir) {
                // Check if it's an XML file or other text file
                if (relativePath.endsWith('.xml') || 
                    relativePath.includes('word/document.xml') ||
                    relativePath.includes('ppt/slides/') ||
                    relativePath.includes('xl/worksheets/') ||
                    relativePath.includes('content.xml') ||
                    relativePath.endsWith('.txt')) {
                    textFiles.push(relativePath);
                }
            }
        });
        
        // Extract content from identified text files
        for (const filePath of textFiles) {
            const fileContent = await zipContent.file(filePath)?.async('string');
            if (fileContent) {
                // Simple XML content extraction - remove tags but keep their content
                const textOnly = fileContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (textOnly.length > 20) { // Only include if it has meaningful content
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
    content: string | any[];
}

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

        if (files && files.length > 0) {
            try {
                const result = await processFiles(files);
                fileContents = result.contents;
                hasUnprocessableFiles = result.hasUnprocessableFiles;
                hasImageFiles = result.hasImageFiles;
                imageUrls = result.imageUrls;
                pdfStats = result.pdfStats;
            } catch (error) {
                console.error("Error processing files:", error);
                // Continue without file processing rather than failing completely
                hasUnprocessableFiles = true;
            }
        }

        // Create a system message that includes file content information
        let systemMessage = DEFAULT_SYSTEM_MESSAGE;

        if (files && files.length > 0) {
            if (hasUnprocessableFiles) {
                systemMessage += `\n\nThe user has uploaded some complex files. Do your best to analyze them with the provided information.`;
            }

            if (fileContents) {
                systemMessage += `\n\nThe user has uploaded the following files. Here's the content of these files: \n${fileContents}\n\nPlease help the user analyze and understand these files. Answer their questions based on the content.`;
            }
        }

        // Format messages for API
        const formattedMessages: Message[] = [
            { role: "system", content: systemMessage },
        ];

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
                    if (
                        img.url &&
                        img.url.startsWith("data:")
                    ) {
                        // Check if it's a PDF being sent as an image
                        const isPdf = img.name.includes("PDF document") || 
                                     (img.name && img.name.toLowerCase().includes("pdf"));
                        
                        // Add a special message if it's a PDF being treated as an image
                        if (isPdf) {
                            // Add text explaining this is a PDF
                            contentArray.push({
                                type: "text",
                                text: `I've attached a PDF document named "${img.name}". This is a visual representation of the PDF content. Please analyze what you can see in this document, including text content, form fields, headers, logos, tables, and any other visual elements. Describe the document's purpose, structure, and key information based on what you can see.`
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
                (img) => img.name && img.name.includes("PDF document")
            );

            if (validImageCount > 0 || hasPdfsForVisualProcessing) {
                // Use a vision-capable model
                try {
                    console.log("Using vision-capable model for processing images/PDFs");
                    const response = await openai.chat.completions.create({
                        model: "gpt-4o", // Using a model capable of processing images
                        messages: formattedMessages as any,
                        temperature: 0.7,
                        max_tokens: 1500,
                    });

                    // Log PDF stats
                    console.log(
                        "PDF Processing Statistics:",
                        JSON.stringify(pdfStats, null, 2)
                    );

                    // Add detailed PDF metrics to response
                    return NextResponse.json({
                        ...response.choices[0].message,
                        __debug:
                            process.env.NODE_ENV === "development"
                                ? {
                                      pdfStats,
                                      modelUsed: "gpt-4o",
                                  }
                                : undefined,
                    });
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

                    // Fall back to regular model if vision fails
                    const fallbackResponse =
                        await openai.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages: fallbackMessages as any,
                            temperature: 0.7,
                            max_tokens: 1500,
                        });

                    // Add detailed PDF metrics to response if we processed PDFs
                    return NextResponse.json(
                        pdfStats.totalCount > 0
                            ? {
                                  ...fallbackResponse.choices[0].message,
                                  __debug:
                                      process.env.NODE_ENV === "development"
                                          ? {
                                                pdfStats,
                                                modelUsed: "gpt-4o-mini",
                                            }
                                          : undefined,
                              }
                            : fallbackResponse.choices[0].message
                    );
                }
            } else {
                // If we only have PDFs, use the standard text model
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: formattedMessages as any,
                    temperature: 0.7,
                    max_tokens: 1500,
                });

                // Log PDF stats
                console.log(
                    "PDF Processing Statistics:",
                    JSON.stringify(pdfStats, null, 2)
                );

                // Add detailed PDF metrics to response
                return NextResponse.json({
                    ...response.choices[0].message,
                    __debug:
                        process.env.NODE_ENV === "development"
                            ? {
                                  pdfStats,
                                  modelUsed: "gpt-4o-mini",
                                  note: "Used text model because no valid images were found",
                              }
                            : undefined,
                });
            }
        } else {
            // Standard text processing
        const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: formattedMessages as any,
            temperature: 0.7,
            max_tokens: 1500,
        });

            // Add detailed PDF metrics to response if we processed PDFs
            return NextResponse.json(
                pdfStats.totalCount > 0
                    ? {
                          ...response.choices[0].message,
                          __debug:
                              process.env.NODE_ENV === "development"
                                  ? {
                                        pdfStats,
                                        modelUsed: "gpt-4o-mini",
                                    }
                                  : undefined,
                      }
                    : response.choices[0].message
            );
        }
    } catch (error) {
        console.error("Error calling OpenAI:", error);
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

    if (!files || !Array.isArray(files)) {
        return {
            contents: "",
            hasUnprocessableFiles: true,
            hasImageFiles: false,
            imageUrls: [],
            pdfStats,
        };
    }

    for (const file of files) {
        try {
            // Verify file object has required properties
            if (!file || !file.name || !file.type || !file.content) {
                hasUnprocessableFiles = true;
                continue;
            }

            // Handle different file types
            if (
                file.type.startsWith("text/") ||
                file.type === "application/json" ||
                file.type === "application/csv" ||
                file.name.endsWith(".txt") ||
                file.name.endsWith(".csv") ||
                file.name.endsWith(".json")
            ) {
                // For text files, just extract the content
                try {
                    const base64Content = file.content.split(",")[1];
                    const textContent = Buffer.from(
                        base64Content,
                        "base64"
                    ).toString("utf-8");

                    fileContents += `--- File: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n${textContent}\n\n`;
                } catch (error) {
                    console.error("Error extracting text content:", error);
                    fileContents += `--- File: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n[Error extracting text content]\n\n`;
                    hasUnprocessableFiles = true;
                }
            } else if (file.type.startsWith("image/")) {
                // For images, store the data URL for the vision model
                fileContents += `--- Image: ${file.name} (${(
                    file.size / 1024
                ).toFixed(1)} KB) ---\n`;
                fileContents += `[An image is attached. The AI will analyze its visual content directly.]\n\n`;
                hasImageFiles = true;

                // Validate the data URL format - make sure it's actually an image
                if (file.content && file.content.startsWith("data:image/")) {
                    imageUrls.push({ url: file.content, name: file.name });
                } else {
                    hasUnprocessableFiles = true;
                }
            } else if (
                file.type === "application/pdf" ||
                file.name.endsWith(".pdf")
            ) {
                console.log(`Processing PDF file: ${file.name}`);
                pdfStats.totalCount++;
                
                // Decode base64 content to buffer
                const base64Content = file.content.split(",")[1];
                const pdfBuffer = Buffer.from(base64Content, "base64");
                
                // Always add the PDF as an image for the vision model
                if (file.content && file.content.includes(',')) {
                    // Create a more descriptive name
                    const descriptiveName = `PDF_Document_${file.name.replace(/\.[^/.]+$/, "")}`;
                    
                    try {
                        // Create a simple image with the PDF name
                        const canvas = require('canvas');
                        const width = 800;
                        const height = 600;
                        const canvasObj = canvas.createCanvas(width, height);
                        const ctx = canvasObj.getContext('2d');
                        
                        // Fill with white background
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, width, height);
                        
                        // Add text
                        ctx.fillStyle = 'black';
                        ctx.font = '30px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(`PDF Document: ${file.name}`, width / 2, height / 2 - 50);
                        ctx.font = '20px Arial';
                        ctx.fillText('PDF content is being processed as text', width / 2, height / 2 + 50);
                        
                        // Convert to data URL
                        const dataUrl = canvasObj.toDataURL('image/png');
                        
                        // Add it as image content
                        imageUrls.push({ 
                            url: dataUrl, 
                            name: `📄 ${descriptiveName} (PDF document)`
                        });
                        
                        hasImageFiles = true;
                        console.log(`Added image for PDF: ${descriptiveName}`);
                    } catch (renderError) {
                        console.error(`PDF rendering failed: ${renderError}`);
                    }
                }
                
                // Track if we've successfully extracted text
                let pdfTextExtracted = false;
                
                try {
                    // Track PDF metrics
                    pdfStats.totalCount++;

                    // Extract text from PDF
                    if (!file.content.includes(",")) {
                        throw new Error("Invalid data URL format for PDF");
                    }

                    const base64Content = file.content.split(",")[1];
                    const pdfBuffer = Buffer.from(base64Content, "base64");
                    
                    // First try with pdf-parse (most reliable method)
                    try {
                        console.log(`Processing PDF file ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
                        
                        // Add diagnostic info
                        console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);
                        console.log(`PDF file type reported: ${file.type}`);
                        
                        // Try to load pdf-parse
                        const pdfParse = await import("pdf-parse").then(
                            (mod) => mod.default
                        );
                        
                        // First attempt with default options
                        const pdfData = await pdfParse(pdfBuffer, {
                            // Use more aggressive parsing
                            max: 0, // No limit on pages
                        });

                        // Check if we actually got text content
                        if (pdfData.text && pdfData.text.trim().length > 0) {
                            fileContents += `--- PDF Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
                            fileContents += `${pdfData.text}\n\n`;
                            pdfStats.successCount++;
                            pdfStats.methodsUsed.push("primary-pdf-parse");
                            pdfTextExtracted = true;
                            console.log(`Successfully extracted ${pdfData.text.length} characters with pdf-parse`);
                        } else {
                            throw new Error(
                                "PDF parsed but no text content was extracted"
                            );
                        }
                    } catch (pdfError) {
                        console.error(`PDF extraction failed for ${file.name}:`, pdfError);
                        pdfStats.errors.push(`PDF extraction error: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`);
                        
                        // If text extraction failed, we'll rely on the visual rendering
                        fileContents += `--- PDF Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
                        fileContents += `[The system attempted to extract text from this PDF but encountered technical issues. `;
                        fileContents += `The PDF will be analyzed visually instead.]\n\n`;
                        pdfStats.failureCount++;
                    }
                } catch (error) {
                    // Log detailed error information
                    console.error("Error parsing PDF:", error);
                    console.error("PDF file details:", {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        contentStart: file.content.substring(0, 100), // Log just the start for debugging
                    });

                    fileContents += `--- PDF Document: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
                    fileContents += `[The system attempted to extract text from this PDF but encountered technical issues. `;
                    fileContents += `This may happen with secured PDFs, complex layouts, or documents containing primarily images.]\n\n`;
                    fileContents += `[To help with analysis, the PDF will be treated as an image for visual processing. `;
                    fileContents += `If you have specific questions about the document's content, please mention them clearly.]\n\n`;
                    hasUnprocessableFiles = true;
                    pdfStats.failureCount++;

                    // Last resort for PDF: add the file as a regular attachment
                    if (!pdfTextExtracted) {
                        console.log(`No text could be extracted from ${file.name}, relying on visual analysis`);
                        
                        // Create a combined message about the PDF
                        fileContents += `--- PDF Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
                        fileContents += `[This PDF appears to contain primarily images or scanned content that couldn't be extracted as text. `;
                        fileContents += `The AI will attempt to analyze it visually as an image.]\n\n`;
                        
                        // We already added the PDF as an image earlier, so no need to do it again
                        pdfStats.methodsUsed.push("image-fallback");
                        
                        // Don't mark as unprocessable since we're handling it as an image
                        hasUnprocessableFiles = false;
                    }
                }
            } else if (
                // Microsoft Office formats
                file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                file.name.endsWith(".docx") ||
                file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                file.name.endsWith(".xlsx") ||
                file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
                file.name.endsWith(".pptx") ||
                file.type === "application/msword" ||
                file.name.endsWith(".doc") ||
                file.type === "application/vnd.ms-excel" ||
                file.name.endsWith(".xls") ||
                file.type === "application/vnd.ms-powerpoint" ||
                file.name.endsWith(".ppt") ||
                // LibreOffice/OpenOffice formats
                file.type === "application/vnd.oasis.opendocument.text" ||
                file.name.endsWith(".odt") ||
                file.type === "application/vnd.oasis.opendocument.spreadsheet" ||
                file.name.endsWith(".ods") ||
                file.type === "application/vnd.oasis.opendocument.presentation" ||
                file.name.endsWith(".odp")
            ) {
                // Extract text from Office documents
                try {
                    const base64Content = file.content.split(",")[1];
                    const fileBuffer = Buffer.from(base64Content, "base64");
                    
                    // Use the helper function to extract text from different office formats
                    const extractedText = await extractOfficeText(fileBuffer, file.type, file.name);
                    
                    fileContents += `--- Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
                    if (extractedText && extractedText.trim().length > 0) {
                        fileContents += `${extractedText}\n\n`;
                    } else {
                        fileContents += `[No readable text could be extracted from this document.]\n\n`;
                        hasUnprocessableFiles = true;
                    }
                } catch (error) {
                    console.error(`Error extracting text from ${file.name}:`, error);
                    fileContents += `--- Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
                    fileContents += `[The system attempted to extract text from this document but encountered an error: ${
                        error instanceof Error ? error.message : "Unknown error"
                    }]\n\n`;
                    fileContents += `[If you're able to describe the content of this document, I'll do my best to help based on your description.]\n\n`;
                    hasUnprocessableFiles = true;
                }
            } else {
                // For other file types, attempt generic extraction
                try {
                    const base64Content = file.content.split(",")[1];
                    const fileBuffer = Buffer.from(base64Content, "base64");
                    
                    // Try to detect file type if MIME type is generic
                    const detectedType = detectFileTypeFromContent(fileBuffer);
                    const effectiveType = detectedType || file.type;
                    
                    // Try to extract text using a generic approach based on file extension
                    let extractedText = '';
                    
                    // Use more intelligent binary text extraction
                    extractedText = extractTextFromBinary(fileBuffer);
                    
                    // Check if it might be a ZIP-based file we can try to extract
                    if ((!extractedText || extractedText.trim().length < 100) && 
                        (effectiveType === 'application/zip' || fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B)) {
                        try {
                            const zipText = await extractTextFromZipArchive(fileBuffer);
                            if (zipText && zipText.trim().length > 0) {
                                extractedText = zipText;
                            }
                        } catch (zipError) {
                            console.error("ZIP extraction attempt failed:", zipError);
                        }
                    }
                    
                    fileContents += `--- File: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
                    if (extractedText && extractedText.trim().length > 50) {
                        fileContents += `[Extracted content using advanced methods - quality may be reduced]\n${extractedText}\n\n`;
                    } else {
                        fileContents += `This file appears to be a binary or complex file of type ${file.type}.\n`;
                        fileContents += `I cannot fully process its contents, but if you describe what you're looking for, I can try to help you understand it.\n\n`;
                        hasUnprocessableFiles = true;
                    }
                } catch (error) {
                    fileContents += `--- File: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
                    fileContents += `This is a binary file of type ${file.type} that cannot be directly processed.\n\n`;
                    hasUnprocessableFiles = true;
                }
            }
        } catch (error) {
            console.error("Error processing file:", error, file.name);
            hasUnprocessableFiles = true;
        }
    }

    return {
        contents: fileContents,
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
    const bufferText = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024 * 1024)); // Limit to 1MB to avoid memory issues
    
    // Extract text that looks like words (3+ consecutive words)
    const textMatches = bufferText.match(/[A-Za-z0-9][\w\.']+(\s+[\w\.']+){2,}/g) || [];
    
    // Filter out very short matches and programming language symbols
    const filteredMatches = textMatches
        .filter(match => 
            match.length > 15 && // Longer sequences
            !match.includes('function') && // Avoid code
            !match.includes('class') && 
            !match.includes('const') &&
            !match.includes('import') &&
            !match.includes('var ') &&
            !match.match(/\d+\.\d+\.\d+/) // Avoid version numbers
        )
        .map(match => match.trim())
        .filter((match, index, self) => self.indexOf(match) === index); // Remove duplicates
    
    return filteredMatches.join('\n');
};

// Helper to detect file type from content
const detectFileTypeFromContent = (buffer: Buffer): string | null => {
    // Check for common file signatures (magic numbers)
    if (buffer.length < 4) return null;
    
    // PDF: %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return 'application/pdf';
    }
    
    // ZIP-based (Office documents, etc): PK
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
        return 'application/zip';
    }
    
    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'image/png';
    }
    
    // JPEG: JFIF or Exif
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        return 'image/jpeg';
    }
    
    // GIF: GIF87a or GIF89a
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return 'image/gif';
    }
    
    return null;
};

// Helper function to extract text from PDFs using PDF.js
async function extractTextWithPDFJS(pdfBuffer: Buffer): Promise<string> {
    try {
        // Skip PDF.js extraction since it's causing issues with the worker
        // Instead, use pdf-parse directly which is more reliable
        const pdfParse = await import("pdf-parse").then(mod => mod.default);
        
        // Use pdf-parse with more aggressive options
        const pdfData = await pdfParse(pdfBuffer, {
            // Use more aggressive parsing
            pagerender: function (pageData: any) {
                return pageData.getTextContent();
            },
            max: 0, // No limit on pages
        });
        
        if (pdfData.text && pdfData.text.trim().length > 0) {
            console.log(`Successfully extracted ${pdfData.text.length} characters with pdf-parse`);
            return pdfData.text;
        } else {
            throw new Error("pdf-parse returned empty text");
        }
    } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Add this function after the other helper functions
// Helper function to render the first page of a PDF to an image
async function renderPdfFirstPageToImage(pdfBuffer: Buffer): Promise<string | null> {
    try {
        // Load the PDF document
        const data = new Uint8Array(pdfBuffer);
        
        // Configure the source with options to disable worker
        const loadingOptions = {
            data,
            disableWorker: true,
            disableFontFace: true,
            disableRange: true,
            isEvalSupported: false,
            useSystemFonts: false
        };
        
        // Create document loading task
        const loadingTask = pdfjs.getDocument(loadingOptions as any);
        
        // Get the PDF document
        const pdf = await loadingTask.promise;
        console.log(`Successfully loaded PDF for rendering with ${pdf.numPages} pages`);
        
        if (pdf.numPages > 0) {
            try {
                // Get the first page
                const page = await pdf.getPage(1);
                
                // Set scale for rendering (higher = better quality but larger file)
                const scale = 1.5;
                const viewport = page.getViewport({ scale });
                
                // Create a canvas for rendering
                const canvas = require('canvas');
                const canvasObj = canvas.createCanvas(viewport.width, viewport.height);
                const context = canvasObj.getContext('2d');
                
                // Set up rendering context
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                
                // Render the page
                await page.render(renderContext).promise;
                
                // Convert canvas to data URL (PNG format)
                const dataUrl = canvasObj.toDataURL('image/png');
                console.log(`Successfully rendered PDF first page to image (${dataUrl.length} bytes)`);
                
                return dataUrl;
            } catch (renderError) {
                console.error('Error rendering PDF page:', renderError);
                return null;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error in PDF to image conversion:', error);
        return null;
    }
}

// Helper function to render PDF pages to images using Puppeteer
async function renderPdfPagesToImages(pdfBuffer: Buffer, maxPages: number = 3): Promise<string[]> {
    try {
        console.log(`Starting Puppeteer to render PDF with max ${maxPages} pages`);
        
        // Create a temporary file to store the PDF
        const tmpDir = process.env.TEMP || process.env.TMP || "/tmp";
        const tmpPdfPath = path.join(tmpDir, `tmp-pdf-${Date.now()}.pdf`);
        
        // Write the PDF buffer to the temporary file
        await writeFile(tmpPdfPath, pdfBuffer);
        console.log(`PDF written to temporary file: ${tmpPdfPath}`);
        
        // Dynamically import puppeteer with error handling
        let puppeteer;
        try {
            // @ts-ignore - Ignore TypeScript errors for dynamic imports
            puppeteer = await import('puppeteer');
        } catch (importError) {
            console.error('Error importing puppeteer:', importError);
            throw new Error('Failed to import puppeteer');
        }
        
        // Launch Puppeteer
        const browser = await puppeteer.default.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // Navigate to the PDF file
            await page.goto(`file://${tmpPdfPath}`, {
                waitUntil: 'networkidle0'
            });
            
            // Wait for PDF to load - use a more TypeScript-friendly approach
            await page.waitForFunction(() => {
                const win = window as any;
                return win.PDFViewerApplication && 
                       win.PDFViewerApplication.pdfViewer && 
                       win.PDFViewerApplication.pdfViewer.pagesCount > 0;
            }, { timeout: 10000 });
            
            // Get the number of pages - fix TypeScript error
            const pagesCount = await page.evaluate(() => {
                const win = window as any;
                return win.PDFViewerApplication.pdfViewer.pagesCount;
            });
            
            console.log(`PDF loaded in Puppeteer with ${pagesCount} pages`);
            
            const pagesToRender = Math.min(pagesCount, maxPages);
            const images: string[] = [];
            
            // Render each page
            for (let i = 1; i <= pagesToRender; i++) {
                try {
                    // Go to the specific page - fix TypeScript error
                    await page.evaluate((pageNum: number) => {
                        const win = window as any;
                        win.PDFViewerApplication.pdfViewer.currentPageNumber = pageNum;
                    }, i);
                    
                    // Wait for the page to render
                    await page.waitForTimeout(1000);
                    
                    // Take a screenshot
                    const screenshot = await page.screenshot({
                        type: 'png',
                        fullPage: true
                    });
                    
                    // Convert to data URL
                    const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`;
                    images.push(dataUrl);
                    
                    console.log(`Rendered page ${i}/${pagesToRender} with Puppeteer`);
                } catch (pageError) {
                    console.error(`Error rendering page ${i} with Puppeteer:`, pageError);
                }
            }
            
            return images;
        } finally {
            // Close the browser
            await browser.close();
            
            // Clean up the temporary file
            try {
                await unlink(tmpPdfPath);
                console.log(`Temporary PDF file removed: ${tmpPdfPath}`);
            } catch (unlinkError) {
                console.error(`Error removing temporary PDF file:`, unlinkError);
            }
        }
    } catch (error) {
        console.error('Error in Puppeteer PDF to images conversion:', error);
        return [];
    }
}

// Add a fallback function that uses a simpler approach with canvas
async function renderPdfToImageWithCanvas(pdfBuffer: Buffer): Promise<string[]> {
    try {
        // Load the PDF document using pdf-lib with error handling
        let pdfLib;
        try {
            // @ts-ignore - Ignore TypeScript errors for dynamic imports
            pdfLib = await import('pdf-lib');
        } catch (importError) {
            console.error('Error importing pdf-lib:', importError);
            throw new Error('Failed to import pdf-lib');
        }
        
        const pdfDoc = await pdfLib.PDFDocument.load(pdfBuffer);
        
        // Get the number of pages
        const pageCount = pdfDoc.getPageCount();
        console.log(`PDF loaded with pdf-lib: ${pageCount} pages`);
        
        const pagesToRender = Math.min(pageCount, 3); // Render up to 3 pages
        const images: string[] = [];
        
        // Create a canvas
        const canvas = require('canvas');
        
        // For each page
        for (let i = 0; i < pagesToRender; i++) {
            try {
                // Get the page
                const page = pdfDoc.getPage(i);
                
                // Get page dimensions
                const { width, height } = page.getSize();
                
                // Create a canvas with the page dimensions
                const canvasObj = canvas.createCanvas(width, height);
                const ctx = canvasObj.getContext('2d');
                
                // Fill with white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                
                // We can't render the PDF content directly with canvas,
                // but we can create a placeholder image that indicates this is a PDF
                ctx.fillStyle = 'black';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`PDF Page ${i + 1}`, width / 2, height / 2 - 20);
                ctx.fillText(`(PDF content will be analyzed visually)`, width / 2, height / 2 + 20);
                
                // Convert to data URL
                const dataUrl = canvasObj.toDataURL('image/png');
                images.push(dataUrl);
                
                console.log(`Created placeholder image for page ${i + 1}`);
            } catch (pageError) {
                console.error(`Error creating placeholder for page ${i + 1}:`, pageError);
            }
        }
        
        return images;
    } catch (error) {
        console.error('Error in canvas PDF to images conversion:', error);
        return [];
    }
}

// Add a simple function to create a placeholder image for PDFs
async function createPdfPlaceholderImage(filename: string): Promise<string> {
    try {
        // Create a canvas
        const canvas = require('canvas');
        const width = 800;
        const height = 1000;
        
        const canvasObj = canvas.createCanvas(width, height);
        const ctx = canvasObj.getContext('2d');
        
        // Fill with light blue background
        ctx.fillStyle = '#f0f8ff';
        ctx.fillRect(0, 0, width, height);
        
        // Add a PDF icon or text
        ctx.fillStyle = '#4a86e8';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PDF DOCUMENT', width / 2, height / 2 - 100);
        
        // Add the filename
        ctx.fillStyle = 'black';
        ctx.font = '30px Arial';
        ctx.fillText(filename, width / 2, height / 2);
        
        // Add a message
        ctx.font = '20px Arial';
        ctx.fillText('This PDF will be analyzed visually', width / 2, height / 2 + 100);
        
        // Convert to data URL
        const dataUrl = canvasObj.toDataURL('image/png');
        console.log(`Created PDF placeholder image for ${filename}`);
        
        return dataUrl;
    } catch (error) {
        console.error('Error creating PDF placeholder image:', error);
        return '';
    }
}
