import {
    getGeminiModel,
    GEMINI_MODELS,
    getGeminiModelWithCodeExecution,
} from "@/app/lib/gemini";
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from "@google/generative-ai";

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
    modelName = GEMINI_MODELS.GEMINI_FLASH
): Promise<CodeResult> {
    // Get a model instance with code execution capabilities
    const model = getGeminiModelWithCodeExecution(modelName);

    console.log(`Using model for code execution: ${modelName}`);

    // Format the system context to tell Gemini how to handle code execution
    const systemContext = `
You are an AI that can execute code and perform file operations based on user requests.
When the user asks you to create files, analyze code, or perform similar tasks:

1. IMPORTANT: Always execute any code that you generate. Do not just show code - you must run it and show both the code and its output.

2. When executing code, follow these steps:
   - Explain what you're going to do in plain text
   - Write the appropriate code to solve the problem
   - Execute the code using the code execution tool
   - Show the output of the execution
   - Explain the results if needed

3. For file creation tasks, place each file in a code block with the filename as the language:
   \`\`\`filename.js
   // File contents here
   \`\`\`

4. For calculations, data analysis, algorithms, or any computational task, generate the code AND execute it to provide actual results.

5. Your responses should include:
   - Your code
   - The output from executing that code
   - Brief explanations of what you did

Remember to actively use the code execution tool whenever you need to run code.
`;

    // Build the prompt including the code snippet if provided
    const fullPrompt = codeSnippet
        ? `${prompt}\n\nHere's the code to analyze:\n\`\`\`\n${codeSnippet}\n\`\`\``
        : prompt;

    try {
        // Execute the code using Gemini with code execution tool
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
        
        // Provide more specific error messages for authentication issues
        let errorMessage = "An error occurred while executing the code.";
        
        if (error instanceof Error) {
            if (error.message.includes("403") || 
                error.message.includes("unregistered callers") ||
                error.message.includes("identity")) {
                errorMessage = "Authentication error: Please check that your Gemini API key is valid and has access to the gemini-2.0-flash model with code execution capability. Make sure your API key is correctly set in the environment variables.";
            } else {
                errorMessage = error.message;
            }
        }
        
        return {
            outputText: errorMessage,
            error: errorMessage,
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
        // Additional keywords for actual code execution
        "run this code",
        "execute this code",
        "run the code",
        "execute the code",
        "calculate",
        "compute",
        "calculate prime numbers",
        "solve using code",
        "execute a function",
        "run a function",
        "run a script",
        "generate and run",
        "execute and show",
        "calculate using code",
        "run python",
        "execute python",
        "run javascript",
        "execute javascript",
        "run js",
        "execute js",
        "generate and execute",
    ];

    const lowercasePrompt = prompt.toLowerCase();

    // Check if any of the keywords are present in the prompt
    return codeExecutionKeywords.some((keyword) =>
        lowercasePrompt.includes(keyword)
    );
}
