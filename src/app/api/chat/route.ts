import { openai, DEFAULT_SYSTEM_MESSAGE } from "@/app/lib/openai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        const formattedMessages = [
            { role: 'system', content: DEFAULT_SYSTEM_MESSAGE },
            ...messages
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: formattedMessages,
            temperature: 0.7,
            max_tokens: 1500,
        });

        return NextResponse.json(response.choices[0].message);
    } catch (error) {
        console.error("Error calling OpenAI:", error);
        return NextResponse.json({ error: "Failed to communicated with AI" }, { status: 500 });
    }
}
