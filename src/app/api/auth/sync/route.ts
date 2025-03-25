import { syncUserWithSupabase } from "@/app/lib/user-sync";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
    // Check authentication
    const auth_obj = await auth();
    const userId = auth_obj.userId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
 
    try {
        // Sync the user with Supabase
        const userData = await syncUserWithSupabase();

        if (!userData) {
            return NextResponse.json(
                { error: "Failed to sync user" },
                { status: 500 }
            );
        }

        return NextResponse.json({ user: userData });
    } catch (error) {
        console.error("Error in user sync route:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
