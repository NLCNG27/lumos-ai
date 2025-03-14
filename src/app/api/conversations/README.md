# Conversations API

This API provides endpoints for managing conversations between users and the AI.

## Endpoints

### List Conversations

```
GET /api/conversations
```

Returns a list of all conversations for the authenticated user.

Query parameters:
- `include_archived` (boolean): Set to "true" to include archived conversations (default: false)

### Create Conversation

```
POST /api/conversations
```

Creates a new conversation for the authenticated user.

Request body:
```json
{
  "title": "Optional conversation title"
}
```

### Get Conversation

```
GET /api/conversations/:conversationId
```

Returns a single conversation by ID.

### Update Conversation

```
PATCH /api/conversations/:conversationId
```

Updates a conversation's title or archive status.

Request body:
```json
{
  "title": "New title",
  "is_archived": true
}
```

### Delete Conversation

```
DELETE /api/conversations/:conversationId
```

Permanently deletes a conversation.

Query parameters:
- `archive` (boolean): Set to "true" to archive the conversation instead of deleting it

### Archive Conversation

```
POST /api/conversations/:conversationId/archive
```

Archives a conversation.

### Unarchive Conversation

```
POST /api/conversations/:conversationId/unarchive
```

Unarchives a conversation.

### Get Conversation Messages

```
GET /api/conversations/:conversationId/messages
```

Returns all messages for a conversation.

## Data Models

### Conversation

```typescript
{
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  last_message_at: string;
}
```

### Message

```typescript
{
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  is_edited: boolean;
  metadata: Record<string, any> | null;
  files?: {
    id: string;
    message_id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    created_at: string;
    preview_url: string | null;
  }[];
}
``` 