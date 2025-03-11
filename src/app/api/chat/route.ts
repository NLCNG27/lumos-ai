import { openai, DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/openai";
import { NextResponse } from "next/server";
// Add child_process for advanced PDF extraction fallback
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";

const execPromise = promisify(exec);

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

                // Add each image, making sure the URL is valid
                for (const img of imageUrls) {
                    if (img.url && img.url.startsWith("data:")) {
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
                const fallbackResponse = await openai.chat.completions.create({
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

                // Validate the data URL format
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
                    // Only import pdf-parse when we actually have a PDF to process
                    const pdfParse = await import("pdf-parse").then(
                        (mod) => mod.default
                    );

                    // Track PDF metrics
                    pdfStats.total++;

                    // Extract text from PDF
                    if (!file.content.includes(",")) {
                        throw new Error("Invalid data URL format for PDF");
                    }

                    const base64Content = file.content.split(",")[1];
                    const pdfBuffer = Buffer.from(base64Content, "base64");

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
                                const textMatch =
                                    bufferText.match(/\w+\s+\w+\s+\w+/g);

                                if (textMatch && textMatch.length > 5) {
                                    // We found what looks like text content
                                    const extractedText = textMatch.join(" ");
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

                    // Add it as an image if possible as fallback - some PDFs can be rendered visually
                    if (file.content && file.content.startsWith("data:")) {
                        hasImageFiles = true;
                        imageUrls.push({ url: file.content, name: file.name });
                        fileContents += `[Additionally, attempting to process this PDF as an image for visual analysis.]\n\n`;
                        pdfStats.methodsUsed.push("visual-fallback");
                    }
                }
            } else {
                // For other file types, just mention they are binary
                fileContents += `--- File: ${file.name} (${(
                    file.size / 1024
                ).toFixed(1)} KB) ---\n`;
                fileContents += `This is a binary file of type ${file.type} that cannot be directly processed.\n\n`;
                hasUnprocessableFiles = true;
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
