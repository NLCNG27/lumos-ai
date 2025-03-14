"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function useUserSync() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();
    const [syncAttempted, setSyncAttempted] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 5;

    const syncUser = useCallback(async () => {
        try {
            console.log(`Syncing user with Supabase... (attempt ${retryCount + 1})`);
            const response = await fetch("/api/auth/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const error = await response.json();
                console.error("Failed to sync user:", error);
                return false;
            }
            
            console.log("User sync successful");
            return true;
        } catch (error) {
            console.error("Error syncing user with Supabase:", error);
            return false;
        }
    }, [retryCount]);

    useEffect(() => {
        // Only run if Clerk has loaded and user is signed in
        if (!isLoaded || !isSignedIn || !userId) return;

        // Call the sync function if not already attempted or if we need to retry
        if (!syncAttempted) {
            setSyncAttempted(true);
            syncUser().then(success => {
                if (!success && retryCount < MAX_RETRIES) {
                    // If sync failed, retry with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
                    console.log(`Sync failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    
                    setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                        setSyncAttempted(false);
                    }, delay);
                } else if (success) {
                    // Reset retry count on success
                    setRetryCount(0);
                }
            });
        }
    }, [isLoaded, isSignedIn, userId, router, syncAttempted, syncUser, retryCount]);

    return { isLoaded, isSignedIn, userId };
}
