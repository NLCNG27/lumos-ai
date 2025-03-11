import { openai, DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/openai";
import { NextResponse } from "next/server";

type FileData = {
    id: string;
    name: string;
    type: string;
    size: number;
    content: string;
};

export async function POST(req: Request) {
    try {
        const { messages, files } = await req.json();
        
        // Process files if they exist
        let fileContents = "";
        let hasUnprocessableFiles = false;
        let hasImageFiles = false;
        
        if (files && files.length > 0) {
            const result = await processFiles(files);
            fileContents = result.contents;
            hasUnprocessableFiles = result.hasUnprocessableFiles;
            hasImageFiles = result.hasImageFiles;
        }

        // Create a system message that includes file content information
        let systemMessage = DEFAULT_SYSTEM_MESSAGE;
        
        if (files && files.length > 0) {
            if (hasUnprocessableFiles) {
                systemMessage += `\n\nThe user has uploaded files including some that require special processing (like PDFs). 
For PDFs and other binary files, explain to the user that while you can see they've uploaded these files,
you currently can't analyze their contents directly without additional processing tools.
Suggest that they could share what specific information they're looking for, or provide excerpts from the document that they'd like you to analyze.`;
            }
            
            if (fileContents) {
                systemMessage += `\n\nThe user has uploaded the following files. Here's the content of these files: \n${fileContents}\n\nPlease help the user analyze and understand these files. Answer their questions based on the content.`;
            }
        }

        // Format messages for API
        const formattedMessages = [
            { role: 'system', content: systemMessage },
            ...messages
        ];

        // Handle the case where there are image files
        if (hasImageFiles) {
            // Transform messages to include image URLs for vision model
            const visionMessages = formattedMessages.map(msg => {
                if (msg.role !== 'user') return msg;
                return { ...msg };
            });

            // Add file information to the prompt
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',  // Using a model capable of processing images
                messages: formattedMessages,
                temperature: 0.7,
                max_tokens: 1500,
            });
            
            return NextResponse.json(response.choices[0].message);
        } else {
            // Standard text processing
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: formattedMessages,
                temperature: 0.7,
                max_tokens: 1500,
            });

            return NextResponse.json(response.choices[0].message);
        }
    } catch (error) {
        console.error("Error calling OpenAI:", error);
        return NextResponse.json({ error: "Failed to communicate with AI" }, { status: 500 });
    }
}

// Process files and extract their content
async function processFiles(files: FileData[]): Promise<{ 
    contents: string, 
    hasUnprocessableFiles: boolean,
    hasImageFiles: boolean
}> {
    let fileContents = "";
    let hasUnprocessableFiles = false;
    let hasImageFiles = false;

    for (const file of files) {
        // Handle different file types
        if (file.type.startsWith("text/") || 
            file.type === "application/json" || 
            file.type === "application/csv" || 
            file.name.endsWith(".txt") || 
            file.name.endsWith(".csv") || 
            file.name.endsWith(".json")) {
            // For text files, just extract the content
            const base64Content = file.content.split(",")[1];
            const textContent = Buffer.from(base64Content, "base64").toString("utf-8");
            
            fileContents += `--- File: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n${textContent}\n\n`;
        } else if (file.type.startsWith("image/")) {
            // For images, note that we have images
            fileContents += `--- Image: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
            fileContents += `This is an image file of type ${file.type}.\n\n`;
            hasUnprocessableFiles = true;
            hasImageFiles = true;
        } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
            // For PDFs, mark that we have unprocessable files
            fileContents += `--- PDF Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
            fileContents += `This is a PDF document that requires special processing to extract text content.\n\n`;
            hasUnprocessableFiles = true;
        } else {
            // For other file types, just mention they are binary
            fileContents += `--- File: ${file.name} (${(file.size / 1024).toFixed(1)} KB) ---\n`;
            fileContents += `This is a binary file of type ${file.type} that cannot be directly processed.\n\n`;
            hasUnprocessableFiles = true;
        }
    }

    return { 
        contents: fileContents, 
        hasUnprocessableFiles,
        hasImageFiles
    };
}
