import { NextRequest, NextResponse } from "next/server";
import { generateGeminiResponse, GEMINI_MODELS } from "@/app/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, title, text } = body;

        if (!url && !text) {
            return NextResponse.json(
                { error: "Either URL or text content is required" },
                { status: 400 }
            );
        }

        // construct the prompt for Gemini
        const prompt = `${text ? `Article text: ${text}` : ""}
        ${title ? `Title: ${title}` : ""}
        ${url ? `Source URL: ${url}` : ""}
        
        Task: Generate a concise max of 10 sentence summary of this article that captures the main points.
        `;

        // Call Gemini for summarization
        const response = await generateGeminiResponse(
            [{ role: "user", content: prompt }],
            GEMINI_MODELS.GEMINI_FLASH,
            0.3, // Lower temperature for more concise, focused summaries
            300 // Limit token output for summaries
        );

        return NextResponse.json({
            summary: response.choices[0].message.content,
        });
    } catch (error) {
        console.error("Error generating summary:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to generate summary",
            },
            { status: 500 }
        );
    }
}
