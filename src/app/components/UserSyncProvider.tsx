"use client";

import React from "react";
import { useUserSync } from "../hooks/useUserSync";

interface UserSyncProviderProps {
    children: React.ReactNode;
}

export function UserSyncProvider({ children }: UserSyncProviderProps) {
    // Use the hook to sync the user between Clerk and Supabase
    useUserSync();

    // Just render children, the hook will handle the sync logic
    return <>{children}</>;
}
