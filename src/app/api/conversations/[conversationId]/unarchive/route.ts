import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { unarchiveConversation } from "@/app/lib/conversation-service";

// Unarchive a conversation
export async function POST(
    req: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    const auth_obj = await auth();
    const userId = auth_obj.userId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const conversation = await unarchiveConversation(params.conversationId);
        return NextResponse.json({ 
            message: "Conversation unarchived successfully",
            conversation 
        });
    } catch (error: any) {
        console.error("Error unarchiving conversation:", error);
        return NextResponse.json(
            { error: error.message || "Failed to unarchive conversation" },
            { status: 500 }
        );
    }
} 