import { openai } from "@/app/lib/openai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Create a custom system message for the code interpreter
    const systemMessage = `You are a helpful assistant that specializes in writing and executing code to solve problems. 
When asked a question, follow these steps:
1. Plan your approach to solving the problem
2. Write the code needed to solve the problem
3. Provide a clear explanation of how the code works
4. Analyze the results and present them in a clear, understandable way

When using mathematical expressions, follow these strict guidelines:
- Use $...$ for inline math and $$...$$ for display/block math
- For special functions like inverse trigonometric functions, always use \\text{} to properly format function names:
  - \\text{arcsec}(x) instead of arcsec(x)
  - \\text{arccsc}(x) instead of arccsc(x)
  - \\text{arccot}(x) instead of arccot(x)
  - \\text{sin}(x) instead of sin(x)
  - \\text{cos}(x) instead of cos(x)
  - \\text{tan}(x) instead of tan(x)
  - \\text{sec}(x) instead of sec(x)
  - \\text{csc}(x) instead of csc(x)
  - \\text{cot}(x) instead of cot(x)

- For trigonometric function definitions, always use inline math with $ symbols:
  Example: Cosecant (csc) is the reciprocal of sine: $\\text{csc}(\\theta) = \\frac{1}{\\sin(\\theta)}$

- For tables and arrays, use the following format:
  - $$\\begin{array}{|c|c|c|} \\hline ... content ... \\hline \\end{array}$$
  - Ensure all rows have the same number of columns
  - Use & to separate columns and \\\\ to separate rows
- For LaTeX line/newline commands, use \\\\line or \\\\newline (double backslashes)
- For fractions, always use \\frac{numerator}{denominator}
- For subscripts and superscripts, use _ and ^ respectively with proper grouping using {}

When creating a trigonometric table, structure it with plain text and simple math expressions rather than complex LaTeX arrays. For example:

| Angle | sin(θ) | cos(θ) | tan(θ) |
|-------|--------|--------|--------|
| 0°    | $0$    | $1$    | $0$    |
| 30°   | $1/2$  | $\\sqrt{3}/2$ | $1/\\sqrt{3}$ |

Use Python when code is needed. For data visualization, use matplotlib, seaborn, or other appropriate libraries.
When presenting mathematical concepts, use clear explanations accompanied by code demonstrations.
Always show your work step by step.`;

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add the user question to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    // Run the assistant on the thread with code interpreter enabled
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_CODE_INTERPRETER_ASSISTANT_ID || "",
      tools: [{ type: "code_interpreter" }],
      instructions: systemMessage,
    });

    // Poll for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    // Wait for the run to complete (with a timeout)
    const startTime = Date.now();
    const TIMEOUT_MS = 60000; // 1 minute timeout
    
    while (runStatus.status !== "completed" && 
           runStatus.status !== "failed" && 
           runStatus.status !== "cancelled" && 
           Date.now() - startTime < TIMEOUT_MS) {
      // Wait for a moment before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // If the run did not complete successfully
    if (runStatus.status !== "completed") {
      return NextResponse.json(
        { 
          content: `The operation ${runStatus.status}. Please try again with a simpler question.`,
        },
        { status: 500 }
      );
    }

    // Get the messages from the thread
    const messages = await openai.beta.threads.messages.list(thread.id);

    // Get the latest assistant message
    const assistantMessages = messages.data.filter(
      (message) => message.role === "assistant"
    );
    
    if (assistantMessages.length === 0) {
      return NextResponse.json(
        { content: "No response was generated. Please try again." },
        { status: 500 }
      );
    }

    // Get the content from the latest assistant message
    const latestMessage = assistantMessages[0];
    let fullContent = "";
    const images = [];

    for (const contentPart of latestMessage.content) {
      if (contentPart.type === "text") {
        fullContent += contentPart.text.value + "\n\n";
      } else if (contentPart.type === "image_file") {
        // Get the file ID from the content
        const fileId = contentPart.image_file.file_id;
        
        try {
          // Retrieve the file content
          const fileContent = await openai.files.content(fileId);
          
          // Convert the file content to base64
          const fileBuffer = await fileContent.arrayBuffer();
          const base64Data = Buffer.from(fileBuffer).toString('base64');
          
          // Create a data URL for the image
          const mimeType = 'image/png'; // Assuming PNG for visualization
          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          
          // Add image to the array
          images.push(dataUrl);
          
          // Add a placeholder in the content that will be replaced on client side
          fullContent += `[IMAGE_PLACEHOLDER_${images.length - 1}]\n\n`;
        } catch (error) {
          console.error("Error retrieving image file:", error);
          fullContent += "[Error loading image - please try again]\n\n";
        }
      }
    }

    return NextResponse.json({ 
      content: fullContent.trim(),
      images: images
    });
  } catch (error) {
    console.error("Error processing code interpreter request:", error);
    return NextResponse.json(
      { content: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
} 