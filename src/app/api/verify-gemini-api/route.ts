import { NextRequest, NextResponse } from "next/server";
import { verifyGeminiApiKey, GEMINI_MODELS } from "@/app/lib/gemini";

export async function GET(req: NextRequest) {
    try {
        // Check if the API key environment variable is set
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: "GEMINI_API_KEY is not set in environment variables",
                },
                { status: 500 }
            );
        }

        // Verify the API key with the basic model
        const basicVerification = await verifyGeminiApiKey(
            GEMINI_MODELS.GEMINI_FLASH
        );

        // If the basic verification fails, return immediately
        if (!basicVerification.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: `API key verification failed: ${basicVerification.error}`,
                    apiKeyFirstChars:
                        apiKey.substring(0, 4) +
                        "..." +
                        apiKey.substring(apiKey.length - 4),
                    apiKeyLength: apiKey.length,
                },
                { status: 401 }
            );
        }

        // Verify with code execution (which might have different permissions)
        const result = {
            success: basicVerification.valid,
            apiKeyPresent: !!apiKey,
            apiKeyFirstChars:
                apiKey.substring(0, 4) +
                "..." +
                apiKey.substring(apiKey.length - 4),
            apiKeyLength: apiKey.length,
            models: {
                [GEMINI_MODELS.GEMINI_FLASH]: basicVerification,
            },
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error verifying Gemini API key:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
