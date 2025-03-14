"use client";

import { useState, useEffect } from "react";
import { Conversation } from "../types";

export default function TestConversations() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] =
        useState<Conversation | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Fetch all conversations
    const fetchConversations = async (includeArchived = false) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `/api/conversations?include_archived=${includeArchived}`
            );
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            const data = await response.json();
            setConversations(data.conversations || []);
            setSuccess("Conversations fetched successfully");
        } catch (err: any) {
            setError(err.message || "Failed to fetch conversations");
        } finally {
            setLoading(false);
        }
    };

    // Create a new conversation
    const createConversation = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/conversations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: newTitle || "New Test Conversation",
                }),
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            const data = await response.json();
            setSuccess(`Conversation created with ID: ${data.conversation.id}`);
            fetchConversations(); // Refresh the list
        } catch (err: any) {
            setError(err.message || "Failed to create conversation");
        } finally {
            setLoading(false);
        }
    };

    // Get a specific conversation
    const getConversation = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/conversations/${id}`);
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            const data = await response.json();
            setSelectedConversation(data.conversation);
            setSuccess(`Conversation fetched: ${data.conversation.title}`);
        } catch (err: any) {
            setError(err.message || "Failed to fetch conversation");
        } finally {
            setLoading(false);
        }
    };

    // Update a conversation
    const updateConversation = async (id: string, title: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/conversations/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ title }),
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            const data = await response.json();
            setSelectedConversation(data.conversation);
            setSuccess(`Conversation updated: ${data.conversation.title}`);
            fetchConversations(); // Refresh the list
        } catch (err: any) {
            setError(err.message || "Failed to update conversation");
        } finally {
            setLoading(false);
        }
    };

    // Archive a conversation
    const archiveConversation = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/conversations/${id}/archive`, {
                method: "POST",
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            const data = await response.json();
            setSuccess(`Conversation archived: ${data.conversation.title}`);
            fetchConversations(); // Refresh the list
        } catch (err: any) {
            setError(err.message || "Failed to archive conversation");
        } finally {
            setLoading(false);
        }
    };

    // Unarchive a conversation
    const unarchiveConversation = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/conversations/${id}/unarchive`, {
                method: "POST",
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            const data = await response.json();
            setSuccess(`Conversation unarchived: ${data.conversation.title}`);
            fetchConversations(true); // Refresh the list including archived
        } catch (err: any) {
            setError(err.message || "Failed to unarchive conversation");
        } finally {
            setLoading(false);
        }
    };

    // Delete a conversation
    const deleteConversation = async (id: string) => {
        if (!confirm("Are you sure you want to delete this conversation?")) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/conversations/${id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            setSuccess("Conversation deleted successfully");
            setSelectedConversation(null);
            fetchConversations(); // Refresh the list
        } catch (err: any) {
            setError(err.message || "Failed to delete conversation");
        } finally {
            setLoading(false);
        }
    };

    // Load conversations on initial render
    useEffect(() => {
        fetchConversations();
    }, []);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4 text-white">
                Test Conversations API
            </h1>

            {/* Status messages */}
            {loading && (
                <div className="bg-blue-900 text-blue-100 p-2 mb-4 rounded">
                    Loading...
                </div>
            )}
            {error && (
                <div className="bg-red-900 text-red-100 p-2 mb-4 rounded">
                    Error: {error}
                </div>
            )}
            {success && (
                <div className="bg-green-900 text-green-100 p-2 mb-4 rounded">
                    Success: {success}
                </div>
            )}

            {/* Create new conversation */}
            <div className="mb-6 p-4 border rounded border-gray-700 bg-gray-800">
                <h2 className="text-xl font-semibold mb-2 text-white">
                    Create New Conversation
                </h2>
                <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Conversation Title"
                        className="border p-2 rounded flex-grow bg-gray-700 border-gray-600 text-white"
                    />
                    <button
                        onClick={createConversation}
                        disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        Create
                    </button>
                </div>
            </div>

            {/* Fetch conversations */}
            <div className="mb-6 p-4 border rounded border-gray-700 bg-gray-800">
                <h2 className="text-xl font-semibold mb-2 text-white">
                    Conversations
                </h2>
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => fetchConversations(false)}
                        disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        Fetch Active
                    </button>
                    <button
                        onClick={() => fetchConversations(true)}
                        disabled={loading}
                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                        Include Archived
                    </button>
                </div>

                {/* Conversations list */}
                <div className="space-y-2">
                    {conversations.length === 0 ? (
                        <p className="text-gray-400">No conversations found.</p>
                    ) : (
                        conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`p-3 rounded cursor-pointer ${
                                    conv.is_archived
                                        ? "bg-gray-700"
                                        : "bg-gray-900"
                                } ${
                                    selectedConversation?.id === conv.id
                                        ? "border-2 border-blue-500"
                                        : "border border-gray-700"
                                }`}
                                onClick={() => getConversation(conv.id)}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-medium text-white">
                                            {conv.title || "Untitled"}
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            Created:{" "}
                                            {new Date(
                                                conv.created_at
                                            ).toLocaleString()}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            Last message:{" "}
                                            {new Date(
                                                conv.last_message_at
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        {conv.is_archived ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    unarchiveConversation(
                                                        conv.id
                                                    );
                                                }}
                                                className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700"
                                            >
                                                Unarchive
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    archiveConversation(
                                                        conv.id
                                                    );
                                                }}
                                                className="bg-yellow-600 text-white px-2 py-1 rounded text-sm hover:bg-yellow-700"
                                            >
                                                Archive
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteConversation(conv.id);
                                            }}
                                            className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                {conv.is_archived && (
                                    <span className="inline-block bg-gray-600 text-gray-200 text-xs px-2 py-1 rounded mt-1">
                                        Archived
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Selected conversation details */}
            {selectedConversation && (
                <div className="p-4 border rounded border-gray-700 bg-gray-800">
                    <h2 className="text-xl font-semibold mb-2 text-white">
                        Selected Conversation
                    </h2>
                    <div className="mb-4 text-gray-300">
                        <p>
                            <strong className="text-white">ID:</strong>{" "}
                            {selectedConversation.id}
                        </p>
                        <p>
                            <strong className="text-white">Title:</strong>{" "}
                            {selectedConversation.title || "Untitled"}
                        </p>
                        <p>
                            <strong className="text-white">Created:</strong>{" "}
                            {new Date(
                                selectedConversation.created_at
                            ).toLocaleString()}
                        </p>
                        <p>
                            <strong className="text-white">Updated:</strong>{" "}
                            {new Date(
                                selectedConversation.updated_at
                            ).toLocaleString()}
                        </p>
                        <p>
                            <strong className="text-white">
                                Last Message:
                            </strong>{" "}
                            {new Date(
                                selectedConversation.last_message_at
                            ).toLocaleString()}
                        </p>
                        <p>
                            <strong className="text-white">Archived:</strong>{" "}
                            {selectedConversation.is_archived ? "Yes" : "No"}
                        </p>
                    </div>

                    {/* Update title */}
                    <div className="mt-4">
                        <h3 className="font-medium mb-2 text-white">
                            Update Title
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="New title"
                                className="border p-2 rounded flex-grow bg-gray-700 border-gray-600 text-white"
                                defaultValue={selectedConversation.title || ""}
                                onChange={(e) => setNewTitle(e.target.value)}
                            />
                            <button
                                onClick={() =>
                                    updateConversation(
                                        selectedConversation.id,
                                        newTitle
                                    )
                                }
                                disabled={loading || !newTitle}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
