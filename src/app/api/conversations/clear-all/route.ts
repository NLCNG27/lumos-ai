import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function DELETE(req: NextRequest) {
  try {
    // Get the user ID from Clerk
    const auth_obj = await auth();
    const userId = auth_obj.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Find all conversations for this user
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id);

    if (conversationsError) {
      console.error("Error finding conversations:", conversationsError);
      return NextResponse.json(
        { error: "Failed to find conversations" },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ 
        message: "No conversations to delete" 
      });
    }

    const conversationIds = conversations.map(conv => conv.id);

    // Find all messages in these conversations
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id")
      .in("conversation_id", conversationIds);

    if (messagesError) {
      console.error("Error finding messages:", messagesError);
      return NextResponse.json(
        { error: "Failed to find messages" },
        { status: 500 }
      );
    }

    // If there are messages, find and delete associated files
    if (messages && messages.length > 0) {
      const messageIds = messages.map(message => message.id);
      
      // Find all files associated with these messages
      const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, storage_path")
        .in("message_id", messageIds);

      if (filesError) {
        console.error("Error finding files:", filesError);
        // Continue with deletion even if we can't find files
      }

      // Delete files from storage
      if (files && files.length > 0) {
        // Delete files from storage bucket
        for (const file of files) {
          if (file.storage_path) {
            const { error: storageError } = await supabase
              .storage
              .from('files')
              .remove([file.storage_path]);
            
            if (storageError) {
              console.error(`Error deleting file from storage: ${file.storage_path}`, storageError);
              // Continue with other deletions
            }
          }
        }

        // Delete file records from database
        const { error: deleteFilesError } = await supabase
          .from("files")
          .delete()
          .in("message_id", messageIds);

        if (deleteFilesError) {
          console.error("Error deleting file records:", deleteFilesError);
          // Continue with deletion even if file record deletion fails
        }
      }

      // Delete all messages in the conversations
      const { error: deleteMessagesError } = await supabase
        .from("messages")
        .delete()
        .in("conversation_id", conversationIds);

      if (deleteMessagesError) {
        console.error("Error deleting messages:", deleteMessagesError);
        return NextResponse.json(
          { error: "Failed to delete messages" },
          { status: 500 }
        );
      }
    }

    // Finally delete all conversations
    const { error } = await supabase
      .from("conversations")
      .delete()
      .in("id", conversationIds);

    if (error) {
      console.error("Error deleting conversations:", error);
      return NextResponse.json(
        { error: "Failed to delete conversations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: "All conversations deleted successfully",
      count: conversations.length
    });
  } catch (error: any) {
    console.error("Error in clear-all conversations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete all conversations" },
      { status: 500 }
    );
  }
} 