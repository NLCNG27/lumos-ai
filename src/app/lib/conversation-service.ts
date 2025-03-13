import { createServerSupabaseClient, supabase } from "./supabase";
import { getSupabaseToken } from "./user-sync";
import { auth } from "@clerk/nextjs/server";
import { Message, ProcessedFile } from "../types";

// Server-side functions (to be used in API routes)
export async function createConversationForUser(
    clerkUserId: string,
    title?: string
) {
    const supabase = createServerSupabaseClient();

    // First, find the user by clerk_id to get our internal UUID
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", clerkUserId)
        .single();

    if (userError) {
        console.error("Error finding user:", userError);
        throw new Error("User not found in database");
    }

    const { data, error } = await supabase
        .from("conversations")
        .insert({
            user_id: user.id, // Use our internal UUID
            title: title || "New Conversation",
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating conversation:", error);
        throw new Error("Failed to create conversation");
    }

    return data;
}

export async function saveMessageToConversation(
    conversationId: string,
    message: Omit<Message, "id" | "timestamp"> & { timestamp?: Date }
) {
    const supabase = createServerSupabaseClient();

    // First, save the message
    const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert({
            conversation_id: conversationId,
            role: message.role,
            content: message.content,
            created_at:
                message.timestamp?.toISOString() || new Date().toISOString(),
        })
        .select()
        .single();

    if (messageError) {
        console.error("Error saving message:", messageError);
        throw new Error("Failed to save message");
    }

    // If there are files, save them
    if (message.files && message.files.length > 0) {
        const fileInserts = message.files.map((file) => ({
            message_id: messageData.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: `files/${messageData.id}/${file.id}`, // You'll need to save the actual file to storage separately
            preview_url: file.previewUrl || null,
        }));

        const { error: filesError } = await supabase
            .from("files")
            .insert(fileInserts);

        if (filesError) {
            console.error("Error saving files:", filesError);
            // Not throwing here, as the message is already saved
        }
    }

    // Update the conversation's last_message_at timestamp
    await supabase
        .from("conversations")
        .update({
            last_message_at: new Date().toISOString(),
            title:
                message.role === "user" &&
                !(await hasConversationTitle(conversationId))
                    ? generateTitleFromMessage(message.content)
                    : undefined,
        })
        .eq("id", conversationId);

    return messageData;
}

// Helper to check if a conversation has a title
async function hasConversationTitle(conversationId: string): Promise<boolean> {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
        .from("conversations")
        .select("title")
        .eq("id", conversationId)
        .single();

    if (error || !data) return false;

    return !!data.title && data.title !== "New Conversation";
}

// Helper to generate a title from the first message
function generateTitleFromMessage(content: string): string {
    // Take the first 50 characters and add ellipsis if needed
    const title = content.substring(0, 50);
    return title.length < content.length ? `${title}...` : title;
}

// Get user's conversations
export async function getUserConversations() {
    const auth_obj = await auth();
    const userId = auth_obj.userId;

    if (!userId) {
        throw new Error("User not authenticated");
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
        throw new Error("User not found in database");
    }

    // Now get conversations using our internal ID
    const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false });

    if (error) {
        console.error("Error fetching conversations:", error);
        throw new Error("Failed to fetch conversations");
    }

    return data;
}

// Get messages for a conversation
export async function getConversationMessages(conversationId: string) {
    const auth_obj = await auth();
    const clerkUserId = auth_obj.userId;

    if (!clerkUserId) {
        throw new Error("User not authenticated");
    }

    const supabase = createServerSupabaseClient();

    // First, find the user by clerk_id to get our internal UUID
    const { data: user, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", clerkUserId)
        .single();

    if (userError) {
        console.error("Error finding user:", userError);
        throw new Error("User not found in database");
    }

    // Check if the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("user_id")
        .eq("id", conversationId)
        .single();

    if (convError || !conversation) {
        throw new Error("Conversation not found");
    }

    if (conversation.user_id !== user.id) {
        throw new Error("Unauthorized access to conversation");
    }

    // Get the messages with their associated files
    const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select(
            `
      *,
      files:files(*)
    `
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (messagesError) {
        console.error("Error fetching messages:", messagesError);
        throw new Error("Failed to fetch messages");
    }

    // Format the messages to match the expected structure
    return messages.map((message: any) => ({
        id: message.id,
        content: message.content,
        role: message.role,
        timestamp: new Date(message.created_at),
        files: message.files as ProcessedFile[],
    }));
}
