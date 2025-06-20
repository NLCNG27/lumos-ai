import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
    getConversationMessages,
    saveMessageToConversation,
} from "@/app/lib/conversation-service";

// Get all messages for a conversation
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    const conversationId = (await params).conversationId;
    const auth_obj = await auth();
    const userId = auth_obj.userId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const messages = await getConversationMessages(conversationId);
        return NextResponse.json({ messages });
    } catch (error: any) {
        console.error("Error fetching messages:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch messages" },
            { status: 500 }
        );
    }
}

// Add a new message to a conversation
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    const conversationId = (await params).conversationId;
    const auth_obj = await auth();
    const userId = auth_obj.userId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const messageData = await request.json();

        // Validate required fields
        if (!messageData.content || !messageData.role) {
            return NextResponse.json(
                { error: "Message content and role are required" },
                { status: 400 }
            );
        }

        const message = await saveMessageToConversation(
            conversationId,
            messageData
        );

        return NextResponse.json({ message });
    } catch (error: any) {
        console.error("Error saving message:", error);
        return NextResponse.json(
            { error: error.message || "Failed to save message" },
            { status: 500 }
        );
    }
}
