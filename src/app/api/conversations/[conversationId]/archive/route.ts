import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { archiveConversation } from "@/app/lib/conversation-service";

// Archive a conversation
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
        const conversation = await archiveConversation(params.conversationId);
        return NextResponse.json({ 
            message: "Conversation archived successfully",
            conversation 
        });
    } catch (error: any) {
        console.error("Error archiving conversation:", error);
        return NextResponse.json(
            { error: error.message || "Failed to archive conversation" },
            { status: 500 }
        );
    }
} 