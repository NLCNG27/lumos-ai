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
            // Permanently delete the conversation
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