import { useState, useEffect } from "react";
import { Conversation } from "@/app/types";
import Link from "next/link";

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}

export default function ConversationSidebar({ 
  currentConversationId, 
  onSelectConversation 
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch user's conversations
  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations?include_archived=${showArchived}`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch conversations");
      console.error("Error fetching conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  // Create a new conversation
  const createNewConversation = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Refresh the conversation list
      await fetchConversations();
      
      // Select the new conversation
      onSelectConversation(data.conversation.id);
      
      // Update URL with the new conversation ID
      const url = new URL(window.location.href);
      url.searchParams.set("conversation", data.conversation.id);
      window.history.pushState({}, "", url);
    } catch (err: any) {
      setError(err.message || "Failed to create conversation");
      console.error("Error creating conversation:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load conversations on initial render
  useEffect(() => {
    fetchConversations();
    
    // Refresh conversations every 30 seconds
    const intervalId = setInterval(fetchConversations, 30000);
    
    return () => clearInterval(intervalId);
  }, [showArchived]);

  // Update the conversation list when the current conversation changes
  useEffect(() => {
    if (currentConversationId) {
      fetchConversations();
    }
  }, [currentConversationId]);

  return (
    <div className="w-64 h-full bg-gray-950 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <button 
          onClick={createNewConversation}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center justify-center"
          disabled={loading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="text-gray-400 text-center p-4">Loading conversations...</div>
        ) : error ? (
          <div className="text-red-400 text-center p-4">{error}</div>
        ) : conversations.length === 0 ? (
          <div className="text-gray-400 text-center p-4">No conversations found</div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  currentConversationId === conversation.id
                    ? "bg-blue-900 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                } ${conversation.is_archived ? "opacity-60" : ""}`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <div className="truncate flex-1">
                    <div className="font-medium truncate">{conversation.title || "New Conversation"}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {new Date(conversation.last_message_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {conversation.is_archived && (
                  <span className="inline-block bg-gray-800 text-gray-300 text-xs px-1.5 py-0.5 rounded mt-1">
                    Archived
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center justify-between text-sm mb-2">
          <label className="text-gray-400 flex items-center">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={() => setShowArchived(!showArchived)}
              className="mr-2"
            />
            Show archived
          </label>
          <button
            onClick={fetchConversations}
            className="text-blue-400 hover:text-blue-300"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        <Link
          href="/test-conversations"
          className="text-blue-400 hover:text-blue-300 text-sm flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Manage Conversations
        </Link>
      </div>
    </div>
  );
} 