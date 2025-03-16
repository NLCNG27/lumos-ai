import { useState, useEffect, useRef } from "react";
import { Conversation } from "@/app/types";
import Link from "next/link";

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}

// Custom confirmation modal component
function DeleteConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  conversationTitle,
  isDeleteAll = false 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
  conversationTitle: string;
  isDeleteAll?: boolean;
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h3 className="text-lg font-medium">{isDeleteAll ? "Clear All Conversations" : "Delete Conversation"}</h3>
          </div>
          <p className="text-gray-300 mb-6">
            {isDeleteAll 
              ? "Are you sure you want to delete ALL conversations? This action cannot be undone."
              : <>Are you sure you want to delete <span className="font-semibold">"{conversationTitle || 'this conversation'}"</span>? This action cannot be undone.</>
            }
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              {isDeleteAll ? "Delete All" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConversationSidebar({ 
  currentConversationId, 
  onSelectConversation 
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // Archive a conversation
  const archiveConversation = async (conversationId: string, isArchived: boolean) => {
    try {
      const endpoint = isArchived 
        ? `/api/conversations/${conversationId}/unarchive` 
        : `/api/conversations/${conversationId}/archive`;
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Refresh the conversation list
      await fetchConversations();
      
      // Close the menu
      setActiveMenu(null);
    } catch (err: any) {
      console.error(`Error ${isArchived ? 'unarchiving' : 'archiving'} conversation:`, err);
      alert(`Failed to ${isArchived ? 'unarchive' : 'archive'} conversation. Please try again.`);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    setConversationToDelete(conversation);
    setDeleteModalOpen(true);
    setActiveMenu(null); // Close the options menu
  };

  // Delete a conversation
  const deleteConversation = async () => {
    if (!conversationToDelete) return;
    
    try {
      const response = await fetch(`/api/conversations/${conversationToDelete.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Refresh the conversation list
      await fetchConversations();
      
      // If the deleted conversation was the current one, create a new conversation
      if (currentConversationId === conversationToDelete.id) {
        await createNewConversation();
      }
      
      // Close the modal
      setDeleteModalOpen(false);
      setConversationToDelete(null);
    } catch (err: any) {
      console.error("Error deleting conversation:", err);
      alert("Failed to delete conversation. Please try again.");
    }
  };

  // Toggle options menu
  const toggleOptionsMenu = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === conversationId ? null : conversationId);
  };

  // Add a function to clear all conversations
  const clearAllConversations = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/conversations/clear-all', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear conversations');
      }
      
      // Refresh the conversations list
      await fetchConversations();
      
      // If we deleted the current conversation, create a new one
      if (currentConversationId && !conversations.some(c => c.id === currentConversationId)) {
        await createNewConversation();
      }
      
      // Close the modal
      setDeleteAllModalOpen(false);
      
    } catch (error: any) {
      console.error('Error clearing conversations:', error);
      alert('Failed to clear all conversations. Please try again.');
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
    <>
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
                  className={`p-2 rounded cursor-pointer transition-colors group relative ${
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
                    
                    {/* Options button (visible on hover) */}
                    <button 
                      className={`ml-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                        activeMenu === conversation.id ? 'bg-gray-700 opacity-100' : 'hover:bg-gray-700'
                      }`}
                      onClick={(e) => toggleOptionsMenu(e, conversation.id)}
                      aria-label="Conversation options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {/* Options menu (visible when activeMenu === conversation.id) */}
                    {activeMenu === conversation.id && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 py-1 w-36"
                      >
                        <button 
                          className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveConversation(conversation.id, conversation.is_archived);
                          }}
                        >
                          {conversation.is_archived ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                              Unarchive
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                              </svg>
                              Archive
                            </>
                          )}
                        </button>
                        <button 
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center"
                          onClick={(e) => openDeleteModal(e, conversation)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
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
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDeleteAllModalOpen(true)}
                className="text-red-400 hover:text-red-300 relative"
                disabled={loading}
                title="Clear all conversations"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                  />
                </svg>
                {loading && (
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                )}
              </button>
              <button
                onClick={fetchConversations}
                className="text-blue-400 hover:text-blue-300 transition-transform duration-300 hover:rotate-180 relative"
                disabled={loading}
                title="Refresh conversations"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                {loading && (
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setConversationToDelete(null);
        }}
        onConfirm={deleteConversation}
        conversationTitle={conversationToDelete?.title || ''}
      />

      {/* Delete All Confirmation Modal */}
      <DeleteConfirmationModal 
        isOpen={deleteAllModalOpen}
        onClose={() => setDeleteAllModalOpen(false)}
        onConfirm={clearAllConversations}
        conversationTitle=""
        isDeleteAll={true}
      />
    </>
  );
} 