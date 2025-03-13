import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { 
  createConversationForUser, 
  getUserConversations 
} from "@/app/lib/conversation-service";

// Get all conversations for the authenticated user
export async function GET(req: NextRequest) {
  const auth_obj = await auth();
  const userId = auth_obj.userId;
  
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  try {
    const conversations = await getUserConversations();
    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// Create a new conversation
export async function POST(req: NextRequest) {
  const auth_obj = await auth();
  const userId = auth_obj.userId;
  
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  try {
    const { title } = await req.json();
    const conversation = await createConversationForUser(userId, title);
    return NextResponse.json({ conversation });
  } catch (error: any) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create conversation" },
      { status: 500 }
    );
  }
} 