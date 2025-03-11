import { openai, DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/openai";
import { NextResponse } from "next/server";

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

        if (files && files.length > 0) {
            try {
                const result = await processFiles(files);
                fileContents = result.contents;
                hasUnprocessableFiles = result.hasUnprocessableFiles;
                hasImageFiles = result.hasImageFiles;
                imageUrls = result.imageUrls;
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

                // Fall back to regular model if vision fails
                const fallbackResponse = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: fallbackMessages as any,
                    temperature: 0.7,
                    max_tokens: 1500,
                });

                return NextResponse.json(fallbackResponse.choices[0].message);
            }
        } else {
            // Standard text processing
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: formattedMessages as any,
                temperature: 0.7,
                max_tokens: 1500,
            });

            return NextResponse.json(response.choices[0].message);
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
}> {
    let fileContents = "";
    let hasUnprocessableFiles = false;
    let hasImageFiles = false;
    let imageUrls: { url: string; name: string }[] = [];

    if (!files || !Array.isArray(files)) {
        return {
            contents: "",
            hasUnprocessableFiles: true,
            hasImageFiles: false,
            imageUrls: [],
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

                    // Extract text from PDF
                    if (!file.content.includes(",")) {
                        throw new Error("Invalid data URL format for PDF");
                    }

                    const base64Content = file.content.split(",")[1];
                    const pdfBuffer = Buffer.from(base64Content, "base64");

                    // Use pdf-parse to extract text
                    const pdfData = await pdfParse(pdfBuffer);

                    // Add to file contents
                    fileContents += `--- PDF Document: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
                    fileContents += `${pdfData.text}\n\n`;
                } catch (error) {
                    console.error("Error parsing PDF:", error);
                    fileContents += `--- PDF Document: ${file.name} (${(
                        file.size / 1024
                    ).toFixed(1)} KB) ---\n`;
                    fileContents += `[The system attempted to extract text from this PDF but encountered an error.]\n\n`;
                    hasUnprocessableFiles = true;
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
    };
}
