import { NextRequest, NextResponse } from "next/server";
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from "@google/generative-ai";
import mime from "mime-types";

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json(
                { error: "Prompt is required" },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not configured" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            tools: [{ codeExecution: {} }],
        });

        const generationConfig = {
            temperature: 1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
        };

        const chatSession = model.startChat({
            generationConfig,
            history: [],
        });

        const result = await chatSession.sendMessage(prompt);

        // Process the response
        const textResponse = result.response.text();
        const candidates = result.response.candidates;

        // Process any inline data (images, etc.)
        const inlineData = [];

        if (candidates) {
            for (
                let candidateIndex = 0;
                candidateIndex < candidates.length;
                candidateIndex++
            ) {
                for (
                    let partIndex = 0;
                    partIndex < candidates[candidateIndex].content.parts.length;
                    partIndex++
                ) {
                    const part =
                        candidates[candidateIndex].content.parts[partIndex];
                    if (part.inlineData) {
                        inlineData.push({
                            mimeType: part.inlineData.mimeType,
                            data: part.inlineData.data,
                            index: `${candidateIndex}_${partIndex}`,
                            extension: mime.extension(part.inlineData.mimeType),
                        });
                    }
                }
            }
        }

        return NextResponse.json({
            text: textResponse,
            inlineData,
        });
    } catch (error) {
        console.error("Error in Gemini code execution:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "An unknown error occurred",
            },
            { status: 500 }
        );
    }
}
