"use client";

import { useState, useEffect } from "react";
import { Conversation, Message } from "../../types";

export default function TestMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch all conversations
  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/conversations");
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setMessages(data.messages || []);
      setSuccess("Messages fetched successfully");
    } catch (err: any) {
      setError(err.message || "Failed to fetch messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Send a new message
  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) {
      setError("Please select a conversation and enter a message");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newMessage,
          role: "user",
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setSuccess("Message sent successfully");
      setNewMessage("");
      
      // Refresh messages
      fetchMessages(selectedConversation.id);
      
      // Simulate AI response after 1 second
      setTimeout(() => {
        sendAIResponse(selectedConversation.id);
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  // Send an AI response
  const sendAIResponse = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "This is an automated AI response to your message.",
          role: "assistant",
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Refresh messages
      fetchMessages(conversationId);
      
    } catch (err: any) {
      console.error("Failed to send AI response:", err);
    }
  };

  // Select a conversation and fetch its messages
  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  // Load conversations on initial render
  useEffect(() => {
    fetchConversations();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">Test Conversation Messages</h1>
      
      {/* Status messages */}
      {loading && <div className="bg-blue-900 text-blue-100 p-2 mb-4 rounded">Loading...</div>}
      {error && <div className="bg-red-900 text-red-100 p-2 mb-4 rounded">Error: {error}</div>}
      {success && <div className="bg-green-900 text-green-100 p-2 mb-4 rounded">Success: {success}</div>}
      
      <div className="flex gap-4">
        {/* Conversations list */}
        <div className="w-1/3 p-4 border rounded border-gray-700 bg-gray-800">
          <h2 className="text-xl font-semibold mb-2 text-white">Conversations</h2>
          <button
            onClick={fetchConversations}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-4 w-full"
          >
            Refresh Conversations
          </button>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-gray-400">No conversations found. Create one in the test-conversations page first.</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-3 rounded cursor-pointer ${
                    selectedConversation?.id === conv.id ? "bg-blue-900 border-2 border-blue-500" : "bg-gray-900 border border-gray-700"
                  }`}
                  onClick={() => selectConversation(conv)}
                >
                  <h3 className="font-medium text-white">{conv.title || "Untitled"}</h3>
                  <p className="text-sm text-gray-400">
                    Last message: {new Date(conv.last_message_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Messages */}
        <div className="w-2/3 p-4 border rounded border-gray-700 bg-gray-800">
          <h2 className="text-xl font-semibold mb-2 text-white">
            {selectedConversation 
              ? `Messages for: ${selectedConversation.title || "Untitled"}` 
              : "Select a conversation to view messages"}
          </h2>
          
          {selectedConversation && (
            <>
              {/* Messages list */}
              <div className="border border-gray-700 rounded p-4 mb-4 h-96 overflow-y-auto bg-gray-900">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-400">No messages yet. Start the conversation!</p>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded max-w-[80%] ${
                          msg.role === "user"
                            ? "bg-blue-900 ml-auto"
                            : "bg-gray-800 border border-gray-700"
                        }`}
                      >
                        <p className="text-white">{msg.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Send message form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="border p-2 rounded flex-grow bg-gray-700 border-gray-600 text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !newMessage.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 