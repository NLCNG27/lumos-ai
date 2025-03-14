import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";

// Get a single conversation by ID
export async function GET(
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

        // Get the conversation and verify ownership
        const { data, error } = await supabase
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .eq("user_id", user.id)
            .single();

        if (error || !data) {
            console.error("Error fetching conversation:", error);
            return NextResponse.json(
                { error: "Conversation not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ conversation: data });
    } catch (error: any) {
        console.error("Error fetching conversation:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch conversation" },
            { status: 500 }
        );
    }
}

// Update a conversation (title or archive status)
export async function PATCH(
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

        // Get update data from request
        const updateData = await req.json();
        const allowedFields = ["title", "is_archived"];
        
        // Filter to only allowed fields
        const filteredUpdate = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updateData[key];
                return obj;
            }, {} as Record<string, any>);
        
        // Add updated_at timestamp
        filteredUpdate.updated_at = new Date().toISOString();

        // Update the conversation
        const { data, error } = await supabase
            .from("conversations")
            .update(filteredUpdate)
            .eq("id", conversationId)
            .select()
            .single();

        if (error) {
            console.error("Error updating conversation:", error);
            return NextResponse.json(
                { error: "Failed to update conversation" },
                { status: 500 }
            );
        }

        return NextResponse.json({ conversation: data });
    } catch (error: any) {
        console.error("Error updating conversation:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update conversation" },
            { status: 500 }
        );
    }
}

// Delete a conversation (or archive it if specified)
export async function DELETE(
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

        // Check if we should archive instead of delete
        const url = new URL(req.url);
        const archive = url.searchParams.get("archive") === "true";

        if (archive) {
            // Archive the conversation instead of deleting it
            const { data, error } = await supabase
                .from("conversations")
                .update({
                    is_archived: true,
                    updated_at: new Date().toISOString()
                })
                .eq("id", conversationId)
                .select()
                .single();

            if (error) {
                console.error("Error archiving conversation:", error);
                return NextResponse.json(
                    { error: "Failed to archive conversation" },
                    { status: 500 }
                );
            }

            return NextResponse.json({ 
                message: "Conversation archived successfully",
                conversation: data
            });
        } else {
            // Permanently delete the conversation and all associated data
            // First, find all messages in this conversation
            const { data: messages, error: messagesError } = await supabase
                .from("messages")
                .select("id")
                .eq("conversation_id", conversationId);

            if (messagesError) {
                console.error("Error finding messages:", messagesError);
                return NextResponse.json(
                    { error: "Failed to find messages for conversation" },
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

                // Delete all messages in the conversation
                const { error: deleteMessagesError } = await supabase
                    .from("messages")
                    .delete()
                    .eq("conversation_id", conversationId);

                if (deleteMessagesError) {
                    console.error("Error deleting messages:", deleteMessagesError);
                    return NextResponse.json(
                        { error: "Failed to delete messages" },
                        { status: 500 }
                    );
                }
            }

            // Finally delete the conversation
            const { error } = await supabase
                .from("conversations")
                .delete()
                .eq("id", conversationId);

            if (error) {
                console.error("Error deleting conversation:", error);
                return NextResponse.json(
                    { error: "Failed to delete conversation" },
                    { status: 500 }
                );
            }

            return NextResponse.json({ 
                message: "Conversation deleted successfully" 
            });
        }
    } catch (error: any) {
        console.error("Error deleting conversation:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete conversation" },
            { status: 500 }
        );
    }
} 