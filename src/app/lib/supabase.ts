import { createClient } from "@supabase/supabase-js";

// Types for our database
export type Database = {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    clerk_id: string | null;
                    email: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    created_at: string;
                    last_login_at: string | null;
                };
                Insert: {
                    id: string;
                    clerk_id?: string | null;
                    email: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    created_at?: string;
                    last_login_at?: string | null;
                };
                Update: {
                    id?: string;
                    clerk_id?: string | null;
                    email?: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    created_at?: string;
                    last_login_at?: string | null;
                };
            };
            conversations: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string | null;
                    created_at: string;
                    updated_at: string;
                    is_archived: boolean;
                    last_message_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    title?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    is_archived?: boolean;
                    last_message_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    title?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    is_archived?: boolean;
                    last_message_at?: string;
                };
            };
            messages: {
                Row: {
                    id: string;
                    conversation_id: string;
                    role: "user" | "assistant";
                    content: string;
                    created_at: string;
                    is_edited: boolean;
                    metadata: Record<string, any> | null;
                };
                Insert: {
                    id?: string;
                    conversation_id: string;
                    role: "user" | "assistant";
                    content: string;
                    created_at?: string;
                    is_edited?: boolean;
                    metadata?: Record<string, any> | null;
                };
                Update: {
                    id?: string;
                    conversation_id?: string;
                    role?: "user" | "assistant";
                    content?: string;
                    created_at?: string;
                    is_edited?: boolean;
                    metadata?: Record<string, any> | null;
                };
            };
            files: {
                Row: {
                    id: string;
                    message_id: string;
                    file_name: string;
                    file_type: string;
                    file_size: number;
                    storage_path: string;
                    created_at: string;
                    preview_url: string | null;
                };
                Insert: {
                    id?: string;
                    message_id: string;
                    file_name: string;
                    file_type: string;
                    file_size: number;
                    storage_path: string;
                    created_at?: string;
                    preview_url?: string | null;
                };
                Update: {
                    id?: string;
                    message_id?: string;
                    file_name?: string;
                    file_type?: string;
                    file_size?: number;
                    storage_path?: string;
                    created_at?: string;
                    preview_url?: string | null;
                };
            };
            csv_datasets: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    description: string | null;
                    data: Record<string, any>;
                    size: number;
                    row_count: number;
                    column_count: number;
                    created_at: string;
                    updated_at: string;
                    is_favorite: boolean;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    description?: string | null;
                    data: Record<string, any>;
                    size: number;
                    row_count: number;
                    column_count: number;
                    created_at?: string;
                    updated_at?: string;
                    is_favorite?: boolean;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    name?: string;
                    description?: string | null;
                    data?: Record<string, any>;
                    size?: number;
                    row_count?: number;
                    column_count?: number;
                    created_at?: string;
                    updated_at?: string;
                    is_favorite?: boolean;
                };
            };
        };
    };
};

// Create a single supabase client for the entire app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client with anonymous key for client-side operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// For server-side operations that need elevated privileges
export const createServerSupabaseClient = (authToken?: string) => {
    if (authToken) {
        // Create client with custom auth header when we have a token
        return createClient<Database>(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            },
        });
    }

    // Service role client for admin operations (only use in server context!)
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient<Database>(supabaseUrl, supabaseServiceKey);
};
