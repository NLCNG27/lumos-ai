/**
 * Gemini 2.0 Flash Code Execution Example
 * 
 * This example demonstrates how to use the code execution capability of Gemini 2.0 Flash.
 * It shows how to set up the model with the code execution tool and run a basic code execution task.
 * 
 * To run this example:
 * 1. Make sure your GEMINI_API_KEY is set in your environment variables
 * 2. Run with: npx tsx src/app/examples/gemini-code-execution.ts
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// This would come from your environment variables in a real app
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function main() {
  if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY is not set in environment variables");
    process.exit(1);
  }

  // Initialize the Gemini API client
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Create model with code execution tool
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [
      {
        codeExecution: {},
      },
    ],
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      }
    ]
  });

  try {
    // The prompt that includes a code execution task
    const prompt = "What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.";

    console.log("Sending request to Gemini with prompt:", prompt);
    console.log("This may take a few moments...");
    
    // Execute the code using Gemini with code execution tool
    const result = await model.generateContent({
      contents: [
        { 
          role: "user", 
          parts: [{ text: prompt }] 
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4000,
      },
    });

    const responseText = result.response.text();
    console.log("\n=== Gemini Response ===\n");
    console.log(responseText);
    
    // You can also access other details from the response if needed
    if (result.response.candidates && result.response.candidates.length > 0) {
      const toolResults = result.response.candidates[0].content?.parts?.filter(
        (part) => part.functionResponse || part.functionCall
      );
      
      if (toolResults && toolResults.length > 0) {
        console.log("\n=== Tool Execution Details ===\n");
        console.log(JSON.stringify(toolResults, null, 2));
      }
    }
  } catch (error) {
    console.error("Error executing code with Gemini:", error);
  }
}

// Run the example
main().catch(console.error); 