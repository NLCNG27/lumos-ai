"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function useUserSync() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Only run if Clerk has loaded and user is signed in
        if (!isLoaded || !isSignedIn || !userId) return;

        // Function to synchronize user with Supabase
        const syncUser = async () => {
            try {
                const response = await fetch("/api/auth/sync", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error("Failed to sync user:", error);
                }
            } catch (error) {
                console.error("Error syncing user with Supabase:", error);
            }
        };

        // Call the sync function
        syncUser();
    }, [isLoaded, isSignedIn, userId, router]);

    return { isLoaded, isSignedIn, userId };
}
