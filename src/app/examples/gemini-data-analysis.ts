/**
 * Gemini 2.0 Flash Data Analysis Example
 * 
 * This example demonstrates how to use the code execution capability of Gemini 2.0 Flash
 * for a more realistic use case: analyzing a small dataset.
 * 
 * To run this example:
 * 1. Make sure your GEMINI_API_KEY is set in your environment variables
 * 2. Run with: npx tsx src/app/examples/gemini-data-analysis.ts
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

  // Sample data - a small dataset of product sales
  const sampleData = `
Product,Category,Price,QuantitySold,Date
Laptop,Electronics,1200,5,2023-01-15
Smartphone,Electronics,800,12,2023-01-20
Headphones,Electronics,150,25,2023-01-22
T-shirt,Clothing,30,50,2023-01-25
Jeans,Clothing,80,20,2023-01-30
Sneakers,Footwear,120,15,2023-02-05
Boots,Footwear,180,8,2023-02-10
Tablet,Electronics,600,7,2023-02-15
Dress,Clothing,90,18,2023-02-20
Watch,Accessories,250,10,2023-02-25
`;

  try {
    // The prompt that includes a data analysis task
    const prompt = `
Here's a CSV dataset of product sales:

${sampleData}

Please analyze this data using Python and provide:
1. Total revenue by product category
2. The best-selling product by quantity
3. A visualization of revenue by category
4. Any interesting patterns or insights you notice

Please execute the code and show both your code and its output.
`;

    console.log("Sending data analysis request to Gemini...");
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
  } catch (error) {
    console.error("Error executing data analysis with Gemini:", error);
  }
}

// Run the example
main().catch(console.error); 