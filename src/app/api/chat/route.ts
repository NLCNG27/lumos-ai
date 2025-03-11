import { openai, DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/openai";
import { NextResponse } from "next/server";
// Add child_process for advanced PDF extraction fallback
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir, access } from "fs/promises";
import path from "path";
import fs from "fs";

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
            total: 0,
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
                        img.url.startsWith("data:") &&
                        (img.url.startsWith("data:image/") ||
                            img.url.includes("image/jpeg") ||
                            img.url.includes("image/png") ||
                            img.url.includes("image/gif") ||
                            img.url.includes("image/webp"))
                    ) {
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

            // Only use the vision model if we actually have real images
            const validImageCount = imageUrls.filter(
                (img) => img.url && img.url.startsWith("data:image/")
            ).length;

            if (validImageCount > 0) {
                // Use a vision-capable model
                try {
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
                        pdfStats.total > 0
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
                pdfStats.total > 0
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
        total: number;
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
        total: 0,
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
                try {
                    // Track PDF metrics
                    pdfStats.total++;

                    // Extract text from PDF
                    if (!file.content.includes(",")) {
                        throw new Error("Invalid data URL format for PDF");
                    }

                    const base64Content = file.content.split(",")[1];
                    const pdfBuffer = Buffer.from(base64Content, "base64");

                    // Use a try-catch block for pdf-parse to handle the error if the module can't be loaded
                    let pdfParse;
                    try {
                        // Try to load pdf-parse with special handling for its test file dependency
                        // Create a temporary directory to satisfy pdf-parse's test file dependency
                        const tempTestDir = path.join(
                            process.cwd(),
                            "test",
                            "data"
                        );

                        // Create the directory path if it doesn't exist (using async operations)
                        const testDirPath = path.join(process.cwd(), "test");
                        if (!(await pathExists(testDirPath))) {
                            await mkdir(testDirPath);
                        }
                        if (!(await pathExists(tempTestDir))) {
                            await mkdir(tempTestDir);
                        }

                        // Create an empty placeholder file that pdf-parse looks for
                        const testFilePath = path.join(
                            tempTestDir,
                            "05-versions-space.pdf"
                        );
                        if (!(await pathExists(testFilePath))) {
                            await writeFile(testFilePath, Buffer.from([0])); // Write a tiny placeholder file
                        }

                        // Now try to import pdf-parse
                        pdfParse = await import("pdf-parse").then(
                            (mod) => mod.default
                        );
                    } catch (importError) {
                        console.error(
                            "Error importing pdf-parse:",
                            importError
                        );
                        // Fall back to our mock implementation
                        pdfParse = createPdfParseMock();
                        // Immediately try alternative methods
                        throw new Error(
                            "PDF parsing module failed to initialize"
                        );
                    }

                    // Use pdf-parse with comprehensive options and error handling
                    try {
                        // First attempt with default options
                        const pdfData = await pdfParse(pdfBuffer, {
                            // Use more aggressive parsing
                            pagerender: function (pageData) {
                                return pageData.getTextContent();
                            },
                        });

                        // Add to file contents
                        fileContents += `--- PDF Document: ${file.name} (${(
                            file.size / 1024
                        ).toFixed(1)} KB) ---\n`;

                        // Check if we actually got text content
                        if (pdfData.text && pdfData.text.trim().length > 0) {
                            fileContents += `${pdfData.text}\n\n`;
                            pdfStats.successCount++;
                            pdfStats.methodsUsed.push("primary-pdf-parse");
                        } else {
                            throw new Error(
                                "PDF parsed but no text content was extracted"
                            );
                        }
                    } catch (pdfError) {
                        console.error(
                            "Initial PDF parsing failed, trying alternative method:",
                            pdfError
                        );
                        pdfStats.errors.push(
                            `Primary method error: ${
                                pdfError instanceof Error
                                    ? pdfError.message
                                    : "Unknown error"
                            }`
                        );

                        try {
                            // Fallback approach - try with different options
                            const fallbackData = await pdfParse(pdfBuffer, {
                                max: 0, // Process all pages
                                version: "v2.0.550",
                            });

                            if (
                                fallbackData.text &&
                                fallbackData.text.trim().length > 0
                            ) {
                                fileContents += `${fallbackData.text}\n\n`;
                                pdfStats.successCount++;
                                pdfStats.methodsUsed.push(
                                    "secondary-pdf-parse"
                                );
                            } else {
                                throw new Error(
                                    "Fallback PDF parsing yielded no text"
                                );
                            }
                        } catch (fallbackError) {
                            console.error(
                                "Both PDF parsing methods failed:",
                                fallbackError
                            );
                            pdfStats.errors.push(
                                `Secondary method error: ${
                                    fallbackError instanceof Error
                                        ? fallbackError.message
                                        : "Unknown error"
                                }`
                            );

                            // Last resort: try to extract text directly from buffer
                            try {
                                // Simple text extraction from buffer - might catch some plain text in the PDF
                                const bufferText = pdfBuffer.toString("utf-8");

                                // Look for meaningful text using more sophisticated patterns
                                // First try to find standard text
                                let extractedText = "";

                                // Find text between BT and ET tags (Basic Text objects in PDF)
                                const textBlocks =
                                    bufferText.match(/BT[\s\S]+?ET/g) || [];
                                if (textBlocks.length > 0) {
                                    const extractedBlocks = textBlocks
                                        .map((block) => {
                                            // Extract text that appears inside parentheses or bracket notation
                                            const textFragments =
                                                block.match(
                                                    /\((.*?)\)|<([0-9A-Fa-f]+)>/g
                                                ) || [];
                                            return textFragments
                                                .map((fragment) => {
                                                    if (
                                                        fragment.startsWith("(")
                                                    ) {
                                                        // Text inside parentheses
                                                        return fragment.substring(
                                                            1,
                                                            fragment.length - 1
                                                        );
                                                    } else {
                                                        // Hex-encoded text inside brackets
                                                        try {
                                                            const hex =
                                                                fragment.substring(
                                                                    1,
                                                                    fragment.length -
                                                                        1
                                                                );
                                                            return Buffer.from(
                                                                hex,
                                                                "hex"
                                                            ).toString("utf-8");
                                                        } catch (e) {
                                                            return "";
                                                        }
                                                    }
                                                })
                                                .join(" ");
                                        })
                                        .join("\n");

                                    if (extractedBlocks.trim().length > 0) {
                                        extractedText +=
                                            extractedBlocks + "\n\n";
                                    }
                                }

                                // Additionally, look for word sequences
                                const textMatch =
                                    bufferText.match(/\w+(\s+\w+){2,}/g);
                                if (textMatch && textMatch.length > 0) {
                                    const wordBasedText = textMatch
                                        .filter((match) => match.length > 10) // Only use longer matches
                                        .join(" ");

                                    if (wordBasedText.trim().length > 0) {
                                        extractedText += wordBasedText;
                                    }
                                }

                                if (extractedText.trim().length > 0) {
                                    // We found what looks like text content
                                    fileContents += `[Extracted using emergency fallback method - text quality may be reduced]\n${extractedText}\n\n`;
                                    pdfStats.successCount++;
                                    pdfStats.methodsUsed.push(
                                        "buffer-extraction"
                                    );
                                } else {
                                    throw new Error(
                                        "No readable text found in buffer"
                                    );
                                }
                            } catch (bufferError) {
                                pdfStats.errors.push(
                                    `Buffer extraction error: ${
                                        bufferError instanceof Error
                                            ? bufferError.message
                                            : "Unknown error"
                                    }`
                                );

                                // Final attempt: Try using system-level tools if available (pdftotext from poppler-utils)
                                try {
                                    // Create a temporary file
                                    const tmpDir =
                                        process.env.TEMP ||
                                        process.env.TMP ||
                                        "/tmp";
                                    const tmpPdfPath = path.join(
                                        tmpDir,
                                        `tmp-${Date.now()}.pdf`
                                    );
                                    const tmpTxtPath = path.join(
                                        tmpDir,
                                        `tmp-${Date.now()}.txt`
                                    );

                                    // Write the buffer to a temporary file
                                    await writeFile(tmpPdfPath, pdfBuffer);

                                    // Try to use pdftotext (from poppler-utils)
                                    try {
                                        await execPromise(
                                            `pdftotext -layout "${tmpPdfPath}" "${tmpTxtPath}"`
                                        );
                                        // Read the text output
                                        const { readFile } = await import(
                                            "fs/promises"
                                        );
                                        const popplerText = await readFile(
                                            tmpTxtPath,
                                            "utf-8"
                                        );

                                        if (
                                            popplerText &&
                                            popplerText.trim().length > 0
                                        ) {
                                            fileContents += `[Extracted using system pdftotext tool]\n${popplerText}\n\n`;
                                            pdfStats.successCount++;
                                            pdfStats.methodsUsed.push(
                                                "poppler-utils"
                                            );
                                        } else {
                                            throw new Error(
                                                "pdftotext produced empty output"
                                            );
                                        }
                                    } catch (popplerError) {
                                        // pdftotext failed or isn't available
                                        pdfStats.errors.push(
                                            `Poppler error: ${
                                                popplerError instanceof Error
                                                    ? popplerError.message
                                                    : "Tool not available"
                                            }`
                                        );
                                        throw new Error(
                                            "System-level PDF extraction failed or not available"
                                        );
                                    } finally {
                                        // Clean up temporary files
                                        try {
                                            await unlink(tmpPdfPath);
                                            await unlink(tmpTxtPath);
                                        } catch (cleanupError) {
                                            console.error(
                                                "Error cleaning up temp files:",
                                                cleanupError
                                            );
                                        }
                                    }
                                } catch (systemToolError) {
                                    pdfStats.failureCount++;
                                    pdfStats.errors.push(
                                        `All methods failed for ${file.name}`
                                    );
                                    throw new Error(
                                        "All PDF extraction methods failed"
                                    );
                                }
                            }
                        }
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
                    fileContents += `[The system attempted to extract text from this PDF but encountered an error: ${
                        error instanceof Error ? error.message : "Unknown error"
                    }]\n\n`;
                    fileContents += `[If you're able to describe the content of this PDF, I'll do my best to help based on your description.]\n\n`;
                    hasUnprocessableFiles = true;
                    pdfStats.failureCount++;

                    // Remove the code that attempts to add PDFs as images - it's not supported
                    // Add it as an image if possible as fallback - some PDFs can be rendered visually
                    if (file.content && file.content.startsWith("data:")) {
                        // PDFs cannot be added as images to the vision model
                        // Instead, let's just note this in the file contents
                        fileContents += `[Note: This PDF cannot be processed visually by the AI model due to format constraints.]\n\n`;
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
