import OpenAI from "openai";

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const DEFAULT_SYSTEM_MESSAGE = "You are Lumos AI, a helpful assistant.";

