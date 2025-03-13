import { openai, DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/openai";
import { NextResponse } from "next/server";
// Add child_process for advanced PDF extraction fallback
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir, access } from "fs/promises";
import path from "path";
import fs from "fs";
// After the imports, add this for PDF.js
import * as pdfjs from "pdfjs-dist";

// Add this import for PDF metadata extraction
import { PDFDocument } from "pdf-lib";

// Add imports for RAG functionality
import { addDocument, queryDocument } from "@/app/lib/documentManager";
import { createDocumentSummary } from "@/app/lib/documentProcessor";
// Import our new simple PDF extractor
import { extractPdfText, extractPdfMetadata as simplePdfMetadata, extractPdfStructure } from "@/app/lib/simplePdfExtractor";

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
    // Handle different office document types
    if (
        fileType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".docx")
    ) {
        try {
            // Use mammoth.js for Word documents
            const mammoth = await import("mammoth");

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
                        .replace(/<[^>]+>/g, " ") // Replace HTML tags with spaces
                        .replace(/\s+/g, " ") // Replace multiple spaces with single space
                        .trim(); // Trim leading/trailing whitespace
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
    } else if (
        fileType ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        fileName.endsWith(".xlsx")
    ) {
        try {
            // Use xlsx for Excel files
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(buffer, { type: "buffer" });

            // Extract text from all sheets
            let text = "";
            workbook.SheetNames.forEach((sheetName) => {
                const sheet = workbook.Sheets[sheetName];
                text += `--- Sheet: ${sheetName} ---\n`;
                text += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
            });
            return text;
        } catch (error) {
            console.error("Error extracting text from Excel file:", error);
            throw new Error("Failed to extract text from Excel file");
        }
    } else if (
        fileType ===
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        fileName.endsWith(".pptx")
    ) {
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
            throw new Error(
                `Failed to extract text from unknown office format: ${fileType}`
            );
        }
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
                    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
                        try {
                            const base64Data = file.content.split(",")[1]; // Remove data URL prefix
                            const buffer = Buffer.from(base64Data, "base64");
                            
                            // Use our new simple extractor
                            const pdfText = await extractPdfText(buffer);
                            
                            if (pdfText && pdfText.trim()) {
                                // Process the document (chunk and store in vector db)
                                const docInfo = await addDocument(pdfText, file.name);
                                processedDocsInfo.push(docInfo);
                            }
                        } catch (fileError) {
                            console.error(`Error processing file ${file.name}:`, fileError);
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
        const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").pop();
            
        // If we have processed documents and a user query, perform retrieval
        if (processedDocsInfo.length > 0 && lastUserMessage) {
            // For each processed document, get relevant chunks
            for (const docInfo of processedDocsInfo) {
                try {
                    const relevantChunks = await queryDocument(docInfo.id, lastUserMessage.content, 3);
                    
                    if (relevantChunks.length > 0) {
                        // Create context from relevant chunks
                        const contextFromDoc = relevantChunks
                            .map(chunk => `--- From document "${docInfo.fileName}" ---\n${chunk.pageContent}\n`)
                            .join("\n");
                        
                        documentContext += contextFromDoc + "\n\n";
                    }
                } catch (queryError) {
                    console.error(`Error querying document ${docInfo.id}:`, queryError);
                }
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

            // Add RAG retrieved content if available
            if (documentContext) {
                systemMessage += `\n\nThe following specific information is retrieved from the user's documents based on their query:\n\n${documentContext}\n\nYour answer should prioritize this retrieved information.`;
            }

            // Log the first 500 characters of the system message to check if file contents are included
            console.log(
                "System message preview (first 500 chars):",
                systemMessage.substring(0, 500)
            );
            console.log("System message length:", systemMessage.length);

            // Check if the system message contains Java code markers
            const containsJavaCode = systemMessage.includes("```java");
            console.log(
                "System message contains Java code blocks:",
                containsJavaCode
            );

            // Add specific instructions for Java files
            if (containsJavaCode) {
                systemMessage += `\n\nIMPORTANT: The uploaded files include Java code. You should analyze this code by explaining:
1. The classes and their relationships
2. The methods and their purposes
3. The functionality of the code
4. Any design patterns or notable features in the implementation`;
            }

            // Check if the system message contains C++ code markers
            const containsCppCode =
                systemMessage.includes("```cpp") ||
                systemMessage.includes("```c") ||
                systemMessage.includes("```h") ||
                systemMessage.includes("```hpp");
            console.log(
                "System message contains C++ code blocks:",
                containsCppCode
            );

            // Add specific instructions for C++ files
            if (containsCppCode) {
                systemMessage += `\n\nIMPORTANT: The uploaded files include C++ code. You should analyze this code by explaining:
1. The functions, classes, and their relationships
2. The purpose of each component
3. The overall functionality of the code
4. Memory management and pointer usage
5. Any algorithms or data structures used
6. Potential optimization opportunities or issues`;
            }

            // Check if the system message contains Python code markers
            const containsPythonCode =
                systemMessage.includes("```python") ||
                systemMessage.includes("```py");
            console.log(
                "System message contains Python code blocks:",
                containsPythonCode
            );

            // Add specific instructions for Python files
            if (containsPythonCode) {
                systemMessage += `\n\nIMPORTANT: The uploaded files include Python code. You should analyze this code by explaining:
1. The functions, classes, and their relationships
2. The purpose of each component
3. The overall functionality of the code
4. Any libraries or frameworks used
5. Potential optimizations or Pythonic improvements`;
            }

            // Check if the system message contains JavaScript/TypeScript code markers
            const containsJsCode =
                systemMessage.includes("```js") ||
                systemMessage.includes("```jsx") ||
                systemMessage.includes("```ts") ||
                systemMessage.includes("```tsx");
            console.log(
                "System message contains JavaScript/TypeScript code blocks:",
                containsJsCode
            );

            // Add specific instructions for JavaScript/TypeScript files
            if (containsJsCode) {
                systemMessage += `\n\nIMPORTANT: The uploaded files include JavaScript/TypeScript code. You should analyze this code by explaining:
1. The functions, objects, and their relationships
2. Any frameworks or libraries being used
3. The overall functionality of the code
4. Async patterns and error handling
5. Type definitions (for TypeScript)
6. Potential optimizations or best practices`;
            }

            // Check for other programming languages using regex
            const codeBlockRegex = /```([a-zA-Z0-9]+)\n/g;
            const matches = [...systemMessage.matchAll(codeBlockRegex)];
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

                systemMessage += `\n\nIMPORTANT: The uploaded files include code in the following languages: ${friendlyNames.join(
                    ", "
                )}. For each language, please:
1. Identify the main components and their relationships
2. Explain the functionality and purpose of the code
3. Analyze any language-specific patterns or features
4. Point out any notable algorithms or data structures
5. Suggest improvements or optimizations where appropriate`;
            }

            // Check if the system message is too long
            if (systemMessage.length > 100000) {
                console.log(
                    "Warning: System message is very long:",
                    systemMessage.length,
                    "characters"
                );
            }
        }

        // Format messages for API
        const formattedMessages: Message[] = [
            { role: "system", content: systemMessage },
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
                            img.name.includes("PDF document") ||
                            (img.name &&
                                img.name.toLowerCase().includes("pdf"));

                        // Add a special message if it's a PDF being treated as an image
                        if (isPdf) {
                            // Add text explaining this is a PDF
                            contentArray.push({
                                type: "text",
                                text: `I've attached a PDF document named "${img.name}". This is a visual representation of the PDF content. Please analyze what you can see in this document, including text content, form fields, headers, logos, tables, and any other visual elements. Describe the document's purpose, structure, and key information based on what you can see.`,
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
                    console.log(
                        "Using vision-capable model for processing images/PDFs"
                    );
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

                // Log information about the messages sent to OpenAI
                console.log(
                    "Messages sent to OpenAI:",
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

            // Log information about the messages sent to OpenAI
            console.log(
                "Messages sent to OpenAI:",
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
                                        modelUsed: "gpt-4o-mini",
                                    }
                                  : undefined,
                      }
                    : response.choices[0].message
            );
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

        // Modify the existing function to incorporate document understanding
        // Find where the API routes processes the user message and modify it
        
        // Inside the route.ts file, find the section that handles user messages and insert this:
        
        try {
            const { messages, files } = await req.json();
            
            // Process files if present
            const processedDocsInfo = [];
            let documentContext = "";
            
            if (files && files.length > 0) {
                for (const file of files) {
                    // Only process PDFs for document understanding
                    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
                        try {
                            const base64Data = file.content.split(",")[1]; // Remove data URL prefix
                            const buffer = Buffer.from(base64Data, "base64");
                            
                            // Use our new simple extractor
                            const pdfText = await extractPdfText(buffer);
                            
                            if (pdfText && pdfText.trim()) {
                                // Process the document (chunk and store in vector db)
                                const docInfo = await addDocument(pdfText, file.name);
                                processedDocsInfo.push(docInfo);
                            }
                        } catch (fileError) {
                            console.error(`Error processing file ${file.name}:`, fileError);
                        }
                    }
                }
            }
            
            // Get the last user message
            const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").pop();
            
            // If we have processed documents and a user query, perform retrieval
            if (processedDocsInfo.length > 0 && lastUserMessage) {
                // For each processed document, get relevant chunks
                for (const docInfo of processedDocsInfo) {
                    try {
                        const relevantChunks = await queryDocument(docInfo.id, lastUserMessage.content, 3);
                        
                        if (relevantChunks.length > 0) {
                            // Create context from relevant chunks
                            const contextFromDoc = relevantChunks
                                .map(chunk => `--- From document "${docInfo.fileName}" ---\n${chunk.pageContent}\n`)
                                .join("\n");
                            
                            documentContext += contextFromDoc + "\n\n";
                        }
                    } catch (queryError) {
                        console.error(`Error querying document ${docInfo.id}:`, queryError);
                    }
                }
            }
            
            // Create messages array for API
            let apiMessages = [];
            
            // Add system message
            apiMessages.push({
                role: "system",
                content: DEFAULT_SYSTEM_MESSAGE,
            });
            
            // If we have document context, add it to the system message
            if (documentContext) {
                apiMessages.push({
                    role: "system",
                    content: `The following information is extracted from the user's uploaded documents. Use this information to answer their questions:\n\n${documentContext}`,
                });
            }
            
            // Add conversation history
            apiMessages = apiMessages.concat(messages);
            
            // Call the API
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: apiMessages,
                temperature: 0.7,
            });
            
            return new NextResponse(JSON.stringify({
                content: response.choices[0].message.content,
            }));
        } catch (error) {
            console.error("Error in chat route:", error);
            return new NextResponse(
                JSON.stringify({ error: "Error processing your request" }),
                { status: 500 }
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
            } else if (
                // Code files - handle common programming languages
                file.type === "text/x-python" ||
                file.name.endsWith(".py") ||
                file.name.endsWith(".pyw") ||
                file.type === "application/javascript" ||
                file.name.endsWith(".js") ||
                file.name.endsWith(".jsx") ||
                file.type === "text/typescript" ||
                file.name.endsWith(".ts") ||
                file.name.endsWith(".tsx") ||
                file.type === "text/x-java" ||
                file.name.endsWith(".java") ||
                file.name.endsWith(".kt") ||
                file.type === "text/x-c" ||
                file.name.endsWith(".c") ||
                file.name.endsWith(".cpp") ||
                file.name.endsWith(".h") ||
                file.name.endsWith(".hpp") ||
                file.type === "text/x-csharp" ||
                file.name.endsWith(".cs") ||
                file.type === "text/x-go" ||
                file.name.endsWith(".go") ||
                file.type === "text/x-rust" ||
                file.name.endsWith(".rs") ||
                file.type === "text/x-ruby" ||
                file.name.endsWith(".rb") ||
                file.type === "text/x-php" ||
                file.name.endsWith(".php") ||
                file.type === "text/x-swift" ||
                file.name.endsWith(".swift") ||
                file.type === "text/x-scala" ||
                file.name.endsWith(".scala") ||
                file.type === "text/x-kotlin" ||
                file.name.endsWith(".kt") ||
                file.type === "text/html" ||
                file.name.endsWith(".html") ||
                file.name.endsWith(".htm") ||
                file.type === "text/css" ||
                file.name.endsWith(".css") ||
                file.type === "text/x-sql" ||
                file.name.endsWith(".sql") ||
                file.type === "text/x-yaml" ||
                file.name.endsWith(".yaml") ||
                file.name.endsWith(".yml") ||
                file.type === "text/x-toml" ||
                file.name.endsWith(".toml") ||
                file.name.endsWith(".xml") ||
                file.name.endsWith(".xsl") ||
                file.name.endsWith(".sh") ||
                file.name.endsWith(".bash") ||
                file.name.endsWith(".ps1") ||
                file.name.endsWith(".psm1") ||
                file.name.endsWith(".r") ||
                file.name.endsWith(".dart") ||
                file.name.endsWith(".lua") ||
                file.name.endsWith(".pl") ||
                file.name.endsWith(".pm") ||
                file.name.endsWith(".dockerfile") ||
                file.name.endsWith(".tf") ||
                file.name.endsWith(".hcl") ||
                file.name.endsWith(".vue") ||
                file.name.endsWith(".svelte") ||
                file.name.endsWith(".md") ||
                file.name.endsWith(".markdown") ||
                file.name.endsWith(".gitignore") ||
                file.name.endsWith(".env") ||
                file.name.endsWith(".config") ||
                file.name.endsWith(".conf")
            ) {
                // For code files, extract the content with special formatting
                try {
                    console.log(
                        `Processing code file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`
                    );

                    // Log the content format
                    console.log(
                        `Content format check: ${file.content.substring(
                            0,
                            50
                        )}...`
                    );

                    const base64Content = file.content.split(",")[1];
                    console.log(
                        `Base64 content length: ${base64Content?.length || 0}`
                    );

                    const codeContent = Buffer.from(
                        base64Content,
                        "base64"
                    ).toString("utf-8");

                    console.log(
                        `Decoded content length: ${
                            codeContent.length
                        }, first 100 chars: ${codeContent.substring(0, 100)}`
                    );

                    // Get the file extension for language detection
                    const fileExt =
                        file.name.split(".").pop()?.toLowerCase() || "";
                    console.log(
                        `File extension: ${fileExt}, detected language: ${getLanguageFromExtension(
                            fileExt
                        )}`
                    );

                    // Prepare formatting for code files
                    const codeFormatting = `--- Code File: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
                    const languageInfo = `Language: ${getLanguageFromExtension(
                        fileExt
                    )}\n`;

                    // Special handling for Java files to ensure they're processed correctly
                    if (fileExt === "java") {
                        console.log(
                            "Processing Java file specifically:",
                            file.name
                        );
                        console.log(
                            "Java content sample:",
                            codeContent.substring(0, 200)
                        );

                        // Create a dedicated section for Java files that's more explicit
                        fileContents +=
                            "\n==== JAVA CODE FILE: " + file.name + " ====\n";
                        fileContents += "```java\n";
                        fileContents += codeContent;
                        fileContents += "\n```\n\n";

                        console.log("Java file added with explicit formatting");

                        // Skip the standard code file formatting for Java files
                        continue;
                    }

                    // Special handling for C++ files
                    if (
                        fileExt === "cpp" ||
                        fileExt === "cxx" ||
                        fileExt === "cc" ||
                        fileExt === "c" ||
                        fileExt === "h" ||
                        fileExt === "hpp"
                    ) {
                        console.log(
                            "Processing C++ file specifically:",
                            file.name
                        );
                        console.log(
                            "C++ content sample:",
                            codeContent.substring(0, 200)
                        );

                        // Create a dedicated section for C++ files that's more explicit
                        fileContents +=
                            "\n==== C++ CODE FILE: " + file.name + " ====\n";
                        fileContents += "```cpp\n";
                        fileContents += codeContent;
                        fileContents += "\n```\n\n";

                        console.log("C++ file added with explicit formatting");

                        // Skip the standard code file formatting for C++ files
                        continue;
                    }

                    // Special handling for Python files
                    if (fileExt === "py" || fileExt === "pyw") {
                        console.log(
                            "Processing Python file specifically:",
                            file.name
                        );

                        // Create a dedicated section for Python files that's more explicit
                        fileContents +=
                            "\n==== PYTHON CODE FILE: " + file.name + " ====\n";
                        fileContents += "```python\n";
                        fileContents += codeContent;
                        fileContents += "\n```\n\n";

                        console.log(
                            "Python file added with explicit formatting"
                        );

                        // Skip the standard code file formatting for Python files
                        continue;
                    }

                    // Special handling for JavaScript/TypeScript files
                    if (
                        fileExt === "js" ||
                        fileExt === "jsx" ||
                        fileExt === "ts" ||
                        fileExt === "tsx"
                    ) {
                        console.log(
                            "Processing JS/TS file specifically:",
                            file.name
                        );

                        // Create a dedicated section for JS/TS files that's more explicit
                        fileContents +=
                            "\n==== " +
                            getLanguageFromExtension(fileExt).toUpperCase() +
                            " CODE FILE: " +
                            file.name +
                            " ====\n";
                        fileContents += "```" + fileExt + "\n";
                        fileContents += codeContent;
                        fileContents += "\n```\n\n";

                        console.log(
                            "JS/TS file added with explicit formatting"
                        );

                        // Skip the standard code file formatting for JS/TS files
                        continue;
                    }

                    // Enhanced formatting for all other code files - use a more explicit format
                    // This ensures all code files get similar treatment even if not specifically handled above
                    const language = getLanguageFromExtension(fileExt);
                    if (language !== "Unknown") {
                        console.log(
                            `Processing ${language} file specifically:`,
                            file.name
                        );

                        // Create a dedicated section for this language file that's more explicit
                        fileContents += `\n==== ${language.toUpperCase()} CODE FILE: ${
                            file.name
                        } ====\n`;
                        fileContents += "```" + fileExt + "\n";
                        fileContents += codeContent;
                        fileContents += "\n```\n\n";

                        console.log(
                            `${language} file added with explicit formatting`
                        );

                        // Skip the standard code file formatting for this file
                        continue;
                    }

                    // Add special formatting for code files
                    fileContents += codeFormatting;
                    fileContents += languageInfo;
                    fileContents += "```" + fileExt + "\n";
                    fileContents += codeContent;
                    fileContents += "\n```\n\n";

                    console.log(
                        `Successfully processed code file: ${file.name}`
                    );
                } catch (error) {
                    console.error("Error extracting code content:", error);
                    console.error(`Error details for ${file.name}:`, {
                        errorName: (error as Error).name,
                        errorMessage: (error as Error).message,
                        stack: (error as Error).stack,
                    });
                    fileContents += `--- Code File: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n[Error extracting code content]\n\n`;
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
                if (file.content && file.content.includes(",")) {
                    // Create a more descriptive name
                    const descriptiveName = `PDF_Document_${file.name.replace(
                        /\.[^/.]+$/,
                        ""
                    )}`;

                    try {
                        // Create a simple image with the PDF name
                        const canvas = require("canvas");
                        const width = 800;
                        const height = 600;
                        const canvasObj = canvas.createCanvas(width, height);
                        const ctx = canvasObj.getContext("2d");

                        // Fill with white background
                        ctx.fillStyle = "white";
                        ctx.fillRect(0, 0, width, height);

                        // Add text
                        ctx.fillStyle = "black";
                        ctx.font = "30px Arial";
                        ctx.textAlign = "center";
                        ctx.fillText(
                            `PDF Document: ${file.name}`,
                            width / 2,
                            height / 2 - 50
                        );
                        ctx.font = "20px Arial";
                        ctx.fillText(
                            "PDF content is being processed as text",
                            width / 2,
                            height / 2 + 50
                        );

                        // Convert to data URL
                        const dataUrl = canvasObj.toDataURL("image/png");

                        // Add it as image content
                        imageUrls.push({
                            url: dataUrl,
                            name: `📄 ${descriptiveName} (PDF document)`,
                        });

                        hasImageFiles = true;
                        console.log(`Added image for PDF: ${descriptiveName}`);
                    } catch (renderError) {
                        console.error(`PDF rendering failed: ${renderError}`);
                    }
                }

                // Extract PDF content using our improved approach
                try {
                    // Extract PDF metadata
                    let metadata = {};
                    try {
                        metadata = await simplePdfMetadata(pdfBuffer);
                        console.log("Extracted PDF metadata:", metadata);
                    } catch (metadataError) {
                        console.error("Failed to extract PDF metadata:", metadataError);
                    }

                    // Extract text using our improved extractor
                    try {
                        console.log(
                            `Processing PDF file ${file.name} (${(
                                file.size / 1024
                            ).toFixed(1)} KB)`
                        );

                        // Add diagnostic info
                        console.log(
                            `PDF buffer size: ${pdfBuffer.length} bytes`
                        );
                        console.log(`PDF file type reported: ${file.type}`);

                        // Extract text using our improved method
                        const pdfText = await extractPdfText(pdfBuffer);
                        
                        // Also extract document structure for better understanding
                        const pdfStructure = await extractPdfStructure(pdfBuffer);
                        
                        // Check if we actually got text content
                        if (pdfText && pdfText.trim().length > 0) {
                            fileContents += `--- PDF Document: ${file.name} (${(
                                file.size / 1024
                            ).toFixed(1)} KB) ---\n`;
                            
                            // Add the content with better formatting
                            fileContents += pdfText + "\n\n";
                            
                            // Add structure information
                            if (pdfStructure && pdfStructure.trim().length > 0) {
                                fileContents += pdfStructure + "\n\n";
                            }
                            
                            pdfStats.successCount++;
                            pdfStats.methodsUsed.push("pdfjs-extraction");
                            console.log(
                                `Successfully extracted text and structure from PDF`
                            );
                        } else {
                            throw new Error(
                                "PDF parsed but no content was extracted"
                            );
                        }
                    } catch (pdfError) {
                        console.error(
                            `PDF extraction failed for ${file.name}:`,
                            pdfError
                        );
                        pdfStats.errors.push(
                            `PDF extraction error: ${
                                pdfError instanceof Error
                                    ? pdfError.message
                                    : "Unknown error"
                            }`
                        );
                        pdfStats.failureCount++;
                            
                        // If text extraction failed, provide a simple fallback
                        fileContents += `--- PDF Document: ${file.name} (${(
                            file.size / 1024
                        ).toFixed(1)} KB) ---\n`;
                        
                        // Still add metadata if available
                        if (metadata && typeof metadata === 'object') {
                            fileContents += "--- Document Information ---\n";
                            for (const [key, value] of Object.entries(metadata)) {
                                fileContents += `${key}: ${value}\n`;
                            }
                            fileContents += "\n";
                        }
                        
                        fileContents += `[The system attempted to extract text from this PDF but encountered technical issues. `;
                        fileContents += `The PDF will be analyzed visually instead.]\n\n`;
                    }
                } catch (error) {
                    console.error(`General error processing PDF ${file.name}:`, error);
                    pdfStats.failureCount++;
                    pdfStats.errors.push(`General PDF processing error: ${error instanceof Error ? error.message : "Unknown error"}`);
                    
                    fileContents += `--- PDF Document: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
                    fileContents += `[Could not process this PDF due to technical issues.]\n\n`;
                }
            } else if (
                // Microsoft Office formats
                file.type ===
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                file.name.endsWith(".docx") ||
                file.type ===
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                file.name.endsWith(".xlsx") ||
                file.type ===
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
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
                file.type ===
                    "application/vnd.oasis.opendocument.spreadsheet" ||
                file.name.endsWith(".ods") ||
                file.type ===
                    "application/vnd.oasis.opendocument.presentation" ||
                file.name.endsWith(".odp")
            ) {
                // Extract text from Office documents
                try {
                    const base64Content = file.content.split(",")[1];
                    const fileBuffer = Buffer.from(base64Content, "base64");

                    // Use the helper function to extract text from different office formats
                    const extractedText = await extractOfficeText(
                        fileBuffer,
                        file.type,
                        file.name
                    );

                    fileContents += `--- Document: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
                    if (extractedText && extractedText.trim().length > 0) {
                        fileContents += `${extractedText}\n\n`;
                    } else {
                        fileContents += `[No readable text could be extracted from this document.]\n\n`;
                        hasUnprocessableFiles = true;
                    }
                } catch (error) {
                    console.error(
                        `Error extracting text from ${file.name}:`,
                        error
                    );
                    fileContents += `--- Document: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
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
                    let extractedText = "";

                    // Use more intelligent binary text extraction
                    extractedText = extractTextFromBinary(fileBuffer);

                    // Check if it might be a ZIP-based file we can try to extract
                    if (
                        (!extractedText || extractedText.trim().length < 100) &&
                        (effectiveType === "application/zip" ||
                            (fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b))
                    ) {
                        try {
                            const zipText = await extractTextFromZipArchive(
                                fileBuffer
                            );
                            if (zipText && zipText.trim().length > 0) {
                                extractedText = zipText;
                            }
                        } catch (zipError) {
                            console.error(
                                "ZIP extraction attempt failed:",
                                zipError
                            );
                        }
                    }

                    fileContents += `--- File: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
                    if (extractedText && extractedText.trim().length > 50) {
                        fileContents += `[Extracted content using advanced methods - quality may be reduced]\n${extractedText}\n\n`;
                    } else {
                        fileContents += `This file appears to be a binary or complex file of type ${file.type}.\n`;
                        fileContents += `I cannot fully process its contents, but if you describe what you're looking for, I can try to help you understand it.\n\n`;
                        hasUnprocessableFiles = true;
                    }
                } catch (error) {
                    fileContents += `--- File: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
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
async function extractPdfMetadata(pdfBuffer: Buffer): Promise<Record<string, any>> {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        
        const metadata = {
            pageCount: pdfDoc.getPageCount(),
            title: pdfDoc.getTitle() || 'Unknown',
            author: pdfDoc.getAuthor() || 'Unknown',
            subject: pdfDoc.getSubject() || '',
            keywords: pdfDoc.getKeywords() || '',
            creationDate: pdfDoc.getCreationDate()?.toISOString() || 'Unknown',
            modificationDate: pdfDoc.getModificationDate()?.toISOString() || 'Unknown'
        };
        
        return metadata;
    } catch (error) {
        console.error('Error extracting PDF metadata:', error);
        return { error: 'Failed to extract metadata' };
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
