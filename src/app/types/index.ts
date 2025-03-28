export type Message = {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    files?: ProcessedFile[];
    groundingSources?: GroundingSource[];
    generatedFiles?: GeneratedFile[];
    codeExecutionResult?: string;
};

export type GeneratedFile = {
    filename: string;
    content: string;
};

export type GroundingSource = {
    title: string;
    link: string;
    snippet: string;
};

// For code execution operations
export type CodeExecutionRequest = {
    prompt: string;
    codeSnippet?: string;
    conversationId?: string;
};

export type CodeExecutionResponse = {
    result: string;
    generatedFiles?: GeneratedFile[];
    error?: string;
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