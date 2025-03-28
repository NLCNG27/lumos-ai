import { getGeminiModel, GEMINI_MODELS } from "@/app/lib/gemini";

interface CodeResult {
    outputText: string;
    generatedFiles?: {
        filename: string;
        content: string;
    }[];
    error?: string;
}

/**
 * Executes code using Gemini and returns the result
 * This function handles code execution requests for file creation and analysis
 */
export async function executeCodeWithGemini(
    prompt: string,
    codeSnippet?: string,
    modelName = GEMINI_MODELS.GEMINI_PRO
): Promise<CodeResult> {
    const model = getGeminiModel(modelName);

    // Format the system context to tell Gemini how to handle code execution
    const systemContext = `
You are an AI that can execute code and perform file operations based on user requests.
When the user asks you to create files, analyze code, or perform similar tasks:

1. You will generate a response in a specific format with separate sections:
   - Plain text explanation of what you're doing
   - Generated code or results of the analysis
   - List of files you would create with their contents

2. For file creation, place each file in a code block with the filename as the language:
   \`\`\`filename.js
   // File contents here
   \`\`\`

3. Always include both the code execution output and any files you'd generate.

4. Remember that you should NOT actually create or modify files on the user's system,
   just return what you would create in the specified format.
`;

    // Build the prompt including the code snippet if provided
    const fullPrompt = codeSnippet
        ? `${prompt}\n\nHere's the code to analyze:\n\`\`\`\n${codeSnippet}\n\`\`\``
        : prompt;

    try {
        // Execute the code using Gemini
        const result = await model.generateContent({
            contents: [
                { role: "user", parts: [{ text: systemContext }] },
                { role: "user", parts: [{ text: fullPrompt }] },
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
            },
        });

        const responseText = result.response.text();

        // Parse the response to extract generated files
        const generatedFiles = extractFilesFromResponse(responseText);

        // Return the structured result
        return {
            outputText: responseText,
            generatedFiles:
                generatedFiles.length > 0 ? generatedFiles : undefined,
        };
    } catch (error) {
        console.error("Error executing code with Gemini:", error);
        return {
            outputText: "An error occurred while executing the code.",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Extract file details from the Gemini response
 * Parses code blocks that have a filename as the language specifier
 */
function extractFilesFromResponse(
    response: string
): { filename: string; content: string }[] {
    const files: { filename: string; content: string }[] = [];

    // Look for code blocks with filename.ext format as the language specifier
    const codeBlockRegex = /```(\S+)[\r\n]+([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
        const [_, filename, content] = match;

        // Only consider code blocks that look like filenames (contain a dot)
        if (filename.includes(".")) {
            files.push({
                filename,
                content: content.trim(),
            });
        }
    }

    return files;
}

/**
 * Determines if a prompt is likely requesting code execution
 * This helps decide when to use the Gemini code execution feature
 */
export function shouldUseCodeExecution(prompt: string): boolean {
    // Common keywords and phrases that indicate code execution might be needed
    const codeExecutionKeywords = [
        "create a file",
        "generate a file",
        "write a file",
        "make a file",
        "create file",
        "generate file",
        "analyze this code",
        "analyze the code",
        "debug this",
        "fix this code",
        "analyze this",
        "create a project",
        "generate a project",
        "scaffold",
        "boilerplate",
        "starter code",
        "generate code",
        "create code",
        "implement",
    ];

    const lowercasePrompt = prompt.toLowerCase();

    // Check if any of the keywords are present in the prompt
    return codeExecutionKeywords.some((keyword) =>
        lowercasePrompt.includes(keyword)
    );
}
