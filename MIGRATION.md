# Migration Guide: OpenAI to Google Gemini

This document details the migration from OpenAI models to Google Gemini models in the Lumos AI application.

## Overview

Lumos AI has been updated to use Google's Gemini models instead of OpenAI's GPT models. This migration provides:

- Improved performance with Gemini 2.0 Flash model
- Better cost efficiency
- Comparable quality for text, code, and image processing
- Similar multimodal capabilities for handling various file types

## Gemini Models Used

The application now uses these Gemini models exclusively:

| Gemini Model | Use Case |
|--------------|----------|
| `gemini-2.0-flash` | Primary text model (default) |
| `gemini-pro-vision` | Image processing, multimodal |
| `gemini-pro` | Fallback model |

## Environment Variables

1. **Replace** `OPENAI_API_KEY` with `GEMINI_API_KEY` in your environment variables.
2. **Obtain** a Gemini API key from [Google AI Studio](https://ai.google.dev/).
3. **Update** your `.env.local` file with the new key.

## Code Changes

The migration involved several key changes:

1. Created a new `gemini.ts` module to replace `openai.ts` functionality
2. Implemented format conversion between chat message formats
3. Updated the chat API route to use Gemini models
4. Added specific handling for multimodal content (text + images)
5. Preserved the same response format to maintain compatibility with the frontend

## Testing Your Implementation

After migrating to Gemini, test your application with different scenarios:

- Basic text conversations
- Image analysis
- PDF document processing
- Code analysis
- Mathematical expressions with LaTeX
- Error handling and fallbacks

## Potential Issues and Solutions

| Issue | Solution |
|-------|----------|
| Different response formatting | Adjust response format in `generateGeminiResponse` |
| Image processing differences | Test with various image types and adjust preprocessing |
| Token limits discrepancies | Adjust `maxOutputTokens` values for different models |
| Rate limiting | Implement additional retries and backoff strategies |
| System messages handling | Ensure system messages are properly converted to Gemini format |

## Fallback Strategy

The implementation includes fallback mechanisms:

1. Vision processing falls back to text-only if image processing fails
2. Main model (Gemini 2.0 Flash) falls back to Gemini Pro on errors
3. Caching is preserved across model types for efficiency

## Monitoring and Logging

Additional logging has been implemented to track:

- Model usage and switching
- Error rates and types
- Processing times
- Cache hit/miss rates

## Limitations and Future Work

While most of OpenAI's functionality has been successfully migrated to Gemini, there are a few limitations to be aware of:

1. **Code Interpreter**: The Code Interpreter feature currently still uses OpenAI's Assistants API, as Gemini does not have a direct equivalent. This feature continues to require an OpenAI API key.

2. **Model-specific features**: Some OpenAI-specific features might not have direct equivalents in Gemini, and adjustments may be needed for optimal performance.

3. **Tool calling**: Gemini's approach to tool calling and function calling differs from OpenAI's implementation. If you're using advanced function calling, additional adaptations may be required.

Future work may include:

- Implementing a Gemini-based equivalent for the Code Interpreter functionality
- Optimizing token usage for the Gemini models
- Further fine-tuning of the response formats for specific use cases

## Additional Resources

- [Google Generative AI Documentation](https://ai.google.dev/docs)
- [Gemini API Reference](https://ai.google.dev/api/rest/v1beta/models)
- [Google AI Studio](https://ai.google.dev/) 