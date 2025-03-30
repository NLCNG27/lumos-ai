import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold, Content, Part, InlineDataPart } from "@google/generative-ai";

// Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// Only initialize if we have a key to avoid errors during initial page load
let geminiAI: GoogleGenerativeAI;
try {
  geminiAI = new GoogleGenerativeAI(apiKey);
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in the environment variables");
  }
} catch (error) {
  console.error("Failed to initialize Gemini AI:", error);
  // Create a dummy instance that will be replaced once API key is available
  geminiAI = new GoogleGenerativeAI('placeholder');
}

export { geminiAI };

// Available Gemini models
export const GEMINI_MODELS = {
  GEMINI_PRO: "gemini-2.0-pro-exp-02-05",
  GEMINI_FLASH: "gemini-2.0-flash", // This is the target model for both text and vision
  GEMINI_VISION: "gemini-2.0-flash", // Using the same flash model for vision capabilities
};

// Define a default system message for Gemini
export const DEFAULT_SYSTEM_MESSAGE = `You are Lumos, a helpful AI assistant that can analyze assist with a wide range of tasks.

When users upload files, you can:
- Understand the content of Word, PDF, PowerPoint, Excel, images, and code files
- Answer specific questions about the file content
- Extract key information from documents
- Analyze data in spreadsheets and tables
- Describe images and visual content
- Understand and explain code in various programming languages 
- Provide insights about technical files and configurations

For code files, you can:
- Explain what the code does
- Identify potential bugs or issues
- Suggest improvements or optimizations
- Answer questions about specific functions or sections
- Help with debugging problems
- Provide context about libraries or frameworks used

When providing mathematical expressions, use LaTeX notation:
- Use $ symbols for inline math expressions: $\\frac{x^2 + 1}{2}$
- Use $$ symbols for block/display math expressions: $$\\int_{a}^{b} f(x) dx$$
- Format complex equations with proper LaTeX syntax for fractions, integrals, summations, etc.
- Ensure all special characters are properly escaped with backslashes

You can also help with general questions and tasks.

Be conversational but focused in your responses. Provide accurate information based on the file content, and if you're unsure about something, acknowledge the limitations.`;

// Create model instances with safety settings
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Helper function to get a model instance
export function getGeminiModel(modelName = GEMINI_MODELS.GEMINI_FLASH, enableGoogleSearch = false) {
  // Use GEMINI_FLASH as the default model
  const finalModel = Object.values(GEMINI_MODELS).includes(modelName as string) 
    ? modelName 
    : GEMINI_MODELS.GEMINI_FLASH;
    
  const modelConfig: any = {
    model: finalModel,
    safetySettings,
  };

  // Add Google Search tool if enabled
  if (enableGoogleSearch && finalModel.includes('gemini-2.0')) {
    modelConfig.tools = [
      {
        googleSearch: {}
      }
    ];
  }
  
  const model = geminiAI.getGenerativeModel(modelConfig);
  return model;
}

/**
 * Creates a Gemini model with code execution capability
 * This allows the model to generate and run code in a secure sandbox
 */
export function getGeminiModelWithCodeExecution(modelName = GEMINI_MODELS.GEMINI_FLASH) {
  // Ensure we're using a valid model
  const finalModel = Object.values(GEMINI_MODELS).includes(modelName as string) 
    ? modelName 
    : GEMINI_MODELS.GEMINI_FLASH;
  
  console.log(`Creating Gemini model with code execution capability: ${finalModel}`);
  
  // For gemini-2.0-flash, we need to ensure we're using the right API version
  // and properly configuring the code execution tool
  try {
    // Create model configuration with code execution tool
    const modelConfig = {
      model: finalModel,
      safetySettings,
      tools: [
        {
          codeExecution: {},
        },
      ],
      apiVersion: "v1beta", // Explicitly set the API version
    };
    
    return geminiAI.getGenerativeModel(modelConfig);
  } catch (error) {
    console.error(`Failed to create Gemini model with code execution: ${error}`);
    throw error;
  }
}

// Convert message format to Gemini content format
export function convertToGeminiFormat(messages: any[]): Content[] {
  const formattedContents: Content[] = [];
  
  for (const message of messages) {
    if (!message.role || !message.content) continue;

    // Handle system message as user message with a special prefix
    if (message.role === 'system') {
      formattedContents.push({
        role: 'user',
        parts: [{ text: `[System Instruction] ${message.content}` }],
      });
      continue;
    }

    // Map roles to Gemini roles
    // Gemini only supports 'user' and 'model' roles
    const role = message.role === 'assistant' ? 'model' : 'user';
    
    // Handle text-only content
    if (typeof message.content === 'string') {
      formattedContents.push({
        role,
        parts: [{ text: message.content }],
      });
    } 
    // Handle mixed content (text and images)
    else if (Array.isArray(message.content)) {
      const parts: Part[] = [];
      
      for (const item of message.content) {
        if (item.type === 'text') {
          parts.push({ text: item.text });
        } 
        else if (item.type === 'image_url' && item.image_url?.url) {
          // Convert base64 URLs to inline data
          if (item.image_url.url.startsWith('data:')) {
            // Extract MIME type and base64 data
            const matches = item.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
            
            if (matches && matches.length === 3) {
              const [, mimeType, base64Data] = matches;
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType,
                }
              } as InlineDataPart);
            }
          }
        }
      }
      
      if (parts.length > 0) {
        formattedContents.push({ role, parts });
      }
    }
  }
  
  return formattedContents;
}

// Generate a text response using Gemini
export async function generateGeminiResponse(
  messages: any[],
  modelName = GEMINI_MODELS.GEMINI_FLASH,
  temperature = 0.7,
  maxOutputTokens = 3000,
  enableGoogleSearch = false
) {
  const model = getGeminiModel(modelName, enableGoogleSearch);
  const geminiContents = convertToGeminiFormat(messages);
  
  try {
    const generationConfig: any = {
      temperature,
      maxOutputTokens,
    };

    if (enableGoogleSearch) {
      generationConfig.responseModalities = ["TEXT"];
    }

    const result = await model.generateContent({
      contents: geminiContents,
      generationConfig,
    });
    
    let responseText = result.response.text();
    let groundingMetadata = null;

    // Extract grounding metadata if available
    if (enableGoogleSearch && result.response.candidates?.[0]?.groundingMetadata) {
      groundingMetadata = result.response.candidates[0].groundingMetadata;
    }
    
    // Return in a format compatible with our API routes
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: responseText,
          },
          index: 0,
          finish_reason: "stop",
        }
      ],
      model: modelName,
      groundingMetadata,
    };
  } catch (error) {
    console.error('Error generating Gemini response:', error);
    throw error;
  }
}

// Generate a text response using Gemini with timeout
export async function callGeminiWithTimeout(
  messages: any[],
  modelName = GEMINI_MODELS.GEMINI_FLASH,
  temperature = 0.7,
  maxOutputTokens = 3000,
  enableGoogleSearch = false
) {
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Gemini API call timed out after 60 seconds`));
    }, 60000); // 60 second timeout
  });

  try {
    // Race between the API call and the timeout
    const response = await Promise.race([
      generateGeminiResponse(messages, modelName, temperature, maxOutputTokens, enableGoogleSearch),
      timeoutPromise
    ]);
    
    return response;
  } catch (error) {
    console.error(`Gemini API call failed (model: ${modelName}):`, error);
    
    // If the error is a timeout or rate limit, use shorter token limit but same model
    if (error instanceof Error && 
        (error.message.includes('timeout') || 
         error.message.includes('rate limit') ||
         error.message.includes('429'))) {
      console.log('Falling back with reduced token count but still using gemini-2.0-flash');
      
      // Always use flash model
      return await generateGeminiResponse(
        messages, 
        GEMINI_MODELS.GEMINI_FLASH,
        temperature, 
        500, // Reduced token count
        enableGoogleSearch
      );
    }
    
    throw error; // Re-throw if it's not a timeout
  }
}

// Generate a response with multimodal content (text + images) using Gemini
export async function generateMultimodalResponse(
  messages: any[],
  modelName = GEMINI_MODELS.GEMINI_FLASH,
  temperature = 0.7,
  maxOutputTokens = 3000,
  enableGoogleSearch = false
) {
  // Always use the Flash model for all content types (text and images)
  const model = getGeminiModel(GEMINI_MODELS.GEMINI_FLASH, enableGoogleSearch);
  const geminiContents = convertToGeminiFormat(messages);
  
  try {
    // Check if there are any image parts in the content for logging purposes
    const hasImageParts = geminiContents.some(content => 
      content.parts && content.parts.some(part => 'inlineData' in part)
    );
    
    if (hasImageParts) {
      console.log('Processing request with image content using gemini-2.0-flash');
    }
    
    const generationConfig: any = {
      temperature,
      maxOutputTokens,
    };

    if (enableGoogleSearch) {
      generationConfig.responseModalities = ["TEXT"];
    }

    const result = await model.generateContent({
      contents: geminiContents,
      generationConfig,
    });
    
    let responseText = result.response.text();
    let groundingMetadata = null;

    // Extract grounding metadata if available
    if (enableGoogleSearch && result.response.candidates?.[0]?.groundingMetadata) {
      groundingMetadata = result.response.candidates[0].groundingMetadata;
    }
    
    // Return in a format compatible with our API routes
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: responseText,
          },
          index: 0,
          finish_reason: "stop",
          groundingMetadata,
        }
      ],
      model: modelName,
    };
  } catch (error) {
    console.error('Error generating multimodal Gemini response:', error);
    throw error;
  }
}

/**
 * Verifies that the Gemini API key is valid and has access to the specified model
 * @param modelName The model to verify access for
 * @returns A promise that resolves to a boolean indicating if the API key is valid
 */
export async function verifyGeminiApiKey(modelName = GEMINI_MODELS.GEMINI_FLASH): Promise<{valid: boolean, error?: string}> {
  try {
    // Get a model instance
    const model = getGeminiModel(modelName);
    
    // Send a simple test prompt
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Hello, this is a test message to verify API key access." }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10,
      },
    });
    
    // If we get here, the API key is valid
    return { valid: true };
  } catch (error) {
    console.error(`Failed to verify Gemini API key for model ${modelName}:`, error);
    let errorMessage = "Unknown error verifying API key";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return { 
      valid: false, 
      error: errorMessage
    };
  }
} 