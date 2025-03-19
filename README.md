# Lumos AI

Lumos AI is a helpful assistant that can analyze various types of files including documents, images, and data files.

## Features

- Text conversations with AI
- File analysis (PDF, Word, Excel, PowerPoint, images, code)
- RAG (Retrieval Augmented Generation) for document intelligence
- Mathematical expression support with LaTeX
- Dataset generation
- And more!

## AI Models

Lumos AI uses Google's Gemini models for its AI functionality:

- **Gemini 2.0 Flash** - Main model for fast, efficient text processing
- **Gemini Pro Vision** - For processing images and visual content
- **Gemini Pro** - Alternative model for fallback

Previously, Lumos used OpenAI's models (GPT-4o, GPT-4o-mini), but has been migrated to Gemini for improved performance and cost efficiency.

## Environment Setup

You'll need to set up the following environment variables:

```
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# Clerk (Authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (see above)
4. Run the development server:
   ```
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Additional Information

- Lumos AI supports multimodal inputs (text + images)
- PDF processing capabilities for document analysis
- Math expression rendering using LaTeX
- Code analysis and explanation

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
