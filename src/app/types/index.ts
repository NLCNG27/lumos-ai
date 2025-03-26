export type Message = {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    files?: ProcessedFile[];
    groundingSources?: GroundingSource[];
};

export type GroundingSource = {
    title: string;
    link: string;
    snippet: string;
};

export type ChatState = {
    messages: Message[];
    isLoading: boolean;
    error: string | null;
};

// For client-side use with actual File objects
export type UploadedFile = {
    id: string;
    file: File;
    previewUrl?: string;
};

// For storing in messages and sending to API
export type ProcessedFile = {
    id: string;
    name: string;
    type: string;
    size: number;
    previewUrl?: string;
    content?: string; // For text content after processing
};

// Conversation type
export type Conversation = {
    id: string;
    user_id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
    is_archived: boolean;
    last_message_at: string;
};