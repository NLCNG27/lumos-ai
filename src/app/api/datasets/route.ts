import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase";
import { SavedDataset } from "@/app/types/visualization";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@clerk/nextjs/server";

// GET handler - Fetch all datasets for current user
export async function GET(request: NextRequest) {
    try {
        // Get authenticated user
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Create Supabase client
        const supabase = createServerSupabaseClient();

        // Query params for optional filtering
        const searchParams = request.nextUrl.searchParams;
        const datasetId = searchParams.get("id");

        if (datasetId) {
            // Fetch specific dataset
            const { data, error } = await supabase
                .from("csv_datasets")
                .select("*")
                .eq("id", datasetId)
                .eq("user_id", userId)
                .single();

            if (error) {
                console.error("Error fetching dataset:", error);
                return NextResponse.json(
                    { error: "Dataset not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json(data, { status: 200 });
        } else {
            // Fetch all datasets for user
            const { data, error } = await supabase
                .from("csv_datasets")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching datasets:", error);
                return NextResponse.json(
                    { error: "Failed to fetch datasets" },
                    { status: 500 }
                );
            }

            return NextResponse.json(data, { status: 200 });
        }
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}

// POST handler - Save a new dataset
export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { name, description, data } = body;

        if (!name || !data) {
            return NextResponse.json(
                { error: "Name and data are required" },
                { status: 400 }
            );
        }

        // Create Supabase client
        const supabase = createServerSupabaseClient();

        // Calculate dataset metadata
        const datasetSize = JSON.stringify(data).length;
        const rowCount = data.labels.length;
        const columnCount = data.datasets.length + 1; // +1 for labels column

        // Create dataset record
        const datasetRecord = {
            id: uuidv4(),
            user_id: userId,
            name,
            description: description || null,
            data,
            size: datasetSize,
            row_count: rowCount,
            column_count: columnCount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_favorite: false,
        };

        const { data: savedData, error } = await supabase
            .from("csv_datasets")
            .insert(datasetRecord)
            .select()
            .single();

        if (error) {
            console.error("Error saving dataset:", error);
            return NextResponse.json(
                { error: "Failed to save dataset" },
                { status: 500 }
            );
        }

        return NextResponse.json(savedData, { status: 201 });
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}

// PATCH handler - Update dataset (name, description, favorite status)
export async function PATCH(request: NextRequest) {
    try {
        // Get authenticated user
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { id, name, description, is_favorite } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Dataset ID is required" },
                { status: 400 }
            );
        }

        // Create update object with only provided fields
        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (is_favorite !== undefined) updateData.is_favorite = is_favorite;

        // Create Supabase client
        const supabase = createServerSupabaseClient();

        // Update dataset
        const { data, error } = await supabase
            .from("csv_datasets")
            .update(updateData)
            .eq("id", id)
            .eq("user_id", userId)
            .select()
            .single();

        if (error) {
            console.error("Error updating dataset:", error);
            return NextResponse.json(
                { error: "Failed to update dataset" },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}

// DELETE handler - Delete a dataset
export async function DELETE(request: NextRequest) {
    try {
        // Get authenticated user
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get dataset ID from URL
        const searchParams = request.nextUrl.searchParams;
        const datasetId = searchParams.get("id");

        if (!datasetId) {
            return NextResponse.json(
                { error: "Dataset ID is required" },
                { status: 400 }
            );
        }

        // Create Supabase client
        const supabase = createServerSupabaseClient();

        // Delete dataset
        const { error } = await supabase
            .from("csv_datasets")
            .delete()
            .eq("id", datasetId)
            .eq("user_id", userId);

        if (error) {
            console.error("Error deleting dataset:", error);
            return NextResponse.json(
                { error: "Failed to delete dataset" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
