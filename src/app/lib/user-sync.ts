import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "./supabase";
import { v4 as uuidv4 } from "uuid";

export async function syncUserWithSupabase() {
    try {
        // Get the current user from Clerk
        const user = await currentUser();

        if (!user) {
            return null;
        }

        // Create a Supabase client with service role for admin operations
        const supabase = createServerSupabaseClient();

        // Instead of using Clerk's ID directly, we'll use a deterministic mapping
        // For existing users, we want to retrieve them using the clerk_id field
        const { data: existingUserByClerkId, error: queryError } =
            await supabase
                .from("users")
                .select()
                .eq("clerk_id", user.id)
                .maybeSingle();

        if (queryError) {
            console.error(
                "Error checking for existing user by clerk_id:",
                queryError
            );
            return null;
        }

        // Get the primary email
        const primaryEmail = user.emailAddresses.find(
            (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!primaryEmail) {
            console.error("User has no primary email address");
            return null;
        }

        // User data to insert/update
        const userData = {
            // If we find an existing user, use their ID, otherwise generate a new UUID
            id: existingUserByClerkId?.id || uuidv4(),
            clerk_id: user.id, // Store Clerk's ID separately
            email: primaryEmail,
            display_name:
                `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                primaryEmail,
            avatar_url: user.imageUrl,
            last_login_at: new Date().toISOString(),
        };

        if (!existingUserByClerkId) {
            // Insert new user
            const { data, error } = await supabase
                .from("users")
                .insert(userData)
                .select()
                .single();

            if (error) {
                console.error("Error creating user in Supabase:", error);
                return null;
            }

            return data;
        } else {
            // Update existing user
            const { data, error } = await supabase
                .from("users")
                .update(userData)
                .eq("id", existingUserByClerkId.id) // Use the UUID from our database, not Clerk's ID
                .select()
                .single();

            if (error) {
                console.error("Error updating user in Supabase:", error);
                return null;
            }

            return data;
        }
    } catch (error) {
        console.error("Error syncing user with Supabase:", error);
        return null;
    }
}

// Helper to get Clerk JWT for Supabase
export async function getSupabaseToken() {
    const auth_obj = await auth();

    try {
        // Get a JWT for Supabase from Clerk
        const token = await auth_obj.getToken({
            template: "supabase",
        });

        return token;
    } catch (error) {
        console.error("Error getting Supabase token from Clerk:", error);
        return null;
    }
}
