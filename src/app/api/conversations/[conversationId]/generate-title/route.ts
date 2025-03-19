import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";
import { openai } from "@/app/lib/openai";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    const conversationId = (await params).conversationId;
    const auth_obj = await auth();
    const userId = auth_obj.userId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const supabase = createServerSupabaseClient();

        // First, find the user by clerk_id to get our internal UUID
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("clerk_id", userId)
            .single();

        if (userError) {
            console.error("Error finding user:", userError);
            return NextResponse.json(
                { error: "User not found in database" },
                { status: 404 }
            );
        }

        // Verify ownership of the conversation
        const { data: conversation, error: convError } = await supabase
            .from("conversations")
            .select("user_id")
            .eq("id", conversationId)
            .single();

        if (convError || !conversation) {
            return NextResponse.json(
                { error: "Conversation not found" },
                { status: 404 }
            );
        }

        if (conversation.user_id !== user.id) {
            return NextResponse.json(
                { error: "Unauthorized access to conversation" },
                { status: 403 }
            );
        }

        // Get the conversation messages to generate a title
        const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .limit(5); // Get the first few messages for context

        if (messagesError) {
            console.error("Error fetching messages:", messagesError);
            return NextResponse.json(
                { error: "Failed to fetch messages" },
                { status: 500 }
            );
        }

        // If no messages, return generic title
        if (!messages || messages.length === 0) {
            return NextResponse.json({ title: "New Conversation" });
        }

        // Extract user messages content
        const userMessages = messages
            .filter((msg) => msg.role === "user")
            .map((msg) => msg.content);

        if (userMessages.length === 0) {
            return NextResponse.json({ title: "New Conversation" });
        }

        // Use OpenAI to generate a concise title
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant that generates concise, descriptive titles for chat conversations. " +
                        "Generate a short, descriptive title (maximum 6 words) based on the user's messages. " +
                        "The title should capture the main topic or question. Be specific and informative.",
                },
                {
                    role: "user",
                    content: `Generate a short title for this conversation based on these user messages: ${userMessages.join(
                        " | "
                    )}`,
                },
            ],
            max_tokens: 20,
            temperature: 0.7,
        });

        const generatedTitle =
            completion.choices[0]?.message?.content?.trim() ||
            "New Conversation";

        // Clean up the title (remove quotes if present)
        const cleanTitle = generatedTitle.replace(/^["']|["']$/g, "");

        // Update the conversation title in the database
        const { data: updatedConv, error: updateError } = await supabase
            .from("conversations")
            .update({
                title: cleanTitle,
                updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId)
            .select()
            .single();

        if (updateError) {
            console.error("Error updating conversation title:", updateError);
            return NextResponse.json(
                { error: "Failed to update conversation title" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            title: cleanTitle,
            conversation: updatedConv,
        });
    } catch (error: any) {
        console.error("Error generating title:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate title" },
            { status: 500 }
        );
    }
}
