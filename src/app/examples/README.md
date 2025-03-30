# Gemini 2.0 Flash Code Execution Examples

This directory contains examples demonstrating how to use Gemini 2.0 Flash's code execution capabilities in your applications.

## Prerequisites

- Node.js 18 or higher
- A valid Google Gemini API key

## Setup

1. Make sure you have the Google Generative AI package installed:
   ```bash
   npm install @google/generative-ai
   ```

2. Set your Gemini API key as an environment variable:
   ```bash
   # For Linux/macOS:
   export GEMINI_API_KEY="your-api-key-here"
   
   # For Windows (Command Prompt):
   set GEMINI_API_KEY=your-api-key-here
   
   # For Windows (PowerShell):
   $env:GEMINI_API_KEY="your-api-key-here"
   ```

3. Install the TypeScript execution package if you don't have it:
   ```bash
   npm install -g tsx
   ```

## Examples

### Basic Code Execution

The `gemini-code-execution.ts` file demonstrates basic code execution using Gemini 2.0 Flash.

To run this example:
```bash
npx tsx src/app/examples/gemini-code-execution.ts
```

This example calculates the sum of the first 50 prime numbers by generating and executing code.

### Data Analysis Example

The `gemini-data-analysis.ts` file shows how to use code execution to analyze a small dataset.

To run this example:
```bash
npx tsx src/app/examples/gemini-data-analysis.ts
```

This example:
1. Provides a small CSV dataset of product sales
2. Asks Gemini to analyze the data, generate visualizations, and provide insights
3. Executes the Python code required for the analysis

## How Code Execution Works

Gemini 2.0 Flash's code execution feature allows the model to:

1. Generate code based on your prompt
2. Execute that code in a secure sandbox environment
3. Return both the code and its output

This is particularly useful for:
- Data analysis and visualization
- Algorithm demonstrations
- Mathematical computations
- Quick prototyping

## Integration into Your Application

To integrate code execution into your own application:

1. Import the necessary modules:
   ```typescript
   import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
   ```

2. Create a model instance with the code execution tool:
   ```typescript
   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
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
       // Add other safety settings as needed
     ]
   });
   ```

3. Generate content with your prompt:
   ```typescript
   const result = await model.generateContent({
     contents: [
       { 
         role: "user", 
         parts: [{ text: "Your prompt here" }] 
       },
     ],
     generationConfig: {
       temperature: 0.2,
       maxOutputTokens: 4000,
     },
   });
   ```

4. Process the response:
   ```typescript
   const responseText = result.response.text();
   console.log(responseText);
   ```

## Limitations

- The code execution environment is ephemeral and doesn't persist state between calls
- File operations are restricted to the sandbox environment
- Network access is limited
- Execution times are limited
- The model cannot install external packages that aren't pre-installed

## Security Considerations

- Always validate and review any code before displaying it to users
- Be cautious with user-provided prompts that might attempt to generate malicious code
- Consider implementing additional safeguards for production applications

## Additional Resources

- [Google Generative AI SDK Documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini Model Capabilities](https://ai.google.dev/gemini-api/docs/models) 