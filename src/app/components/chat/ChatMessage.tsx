import { Message } from '@/app/types';

type ChatMessageProps = {
    message: Message;
};

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs">AI</span>
                </div>
            )}
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${isUser
                    ? 'bg-blue-500 text-white rounded-tr-none'
                    : 'bg-gray-100 dark:bg-gray-800 rounded-tl-none'
                }`}>
                <p className="text-sm">{message.content}</p>
            </div>
            {isUser && (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-700 text-xs">You</span>
                </div>
            )}
        </div>
    );
}