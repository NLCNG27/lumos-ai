export type Message = {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
    files?: ProcessedFile[];
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