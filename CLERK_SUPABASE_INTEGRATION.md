# Clerk-Supabase Integration Guide

This guide walks through the final steps needed to configure your Clerk JWT template to work with Supabase.

## 1. Set Up Clerk JWT Template

1. Log in to your [Clerk Dashboard](https://dashboard.clerk.dev)
2. Go to **JWT Templates** in the left sidebar
3. Click **New Template**
4. Name it `supabase`
5. Add the following claims:

```json
{
  "aud": "authenticated",
  "role": "authenticated",
  "user_id": "{{user.id}}"
}
```

6. Set the token lifetime to match your security requirements (e.g., 24 hours)
7. Save the template

## 2. Configure Supabase JWT Settings

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Go to your project
3. Navigate to **Authentication** → **Settings** → **JWT Settings**
4. Set the JWT Settings:
   - **JWT Secret Type**: `JWKS`
   - **JWKS URL**: `https://api.clerk.dev/v1/jwks` (or your Clerk instance URL if using Enterprise)
   - **JWT Expiry**: Set to match your Clerk JWT template expiry

## 3. Testing the Integration

To test that the integration is working:

1. Log in to your application
2. You should see user data synced to Supabase automatically
3. Visit the `/api/conversations` endpoint to verify you get an empty array (or your existing conversations)
4. Create a new conversation by sending a POST request to `/api/conversations`

## 4. Troubleshooting

If you encounter issues:

- Check browser console for errors during authentication
- Check server logs for errors during token verification
- Verify that Clerk JWT claims match what Supabase expects
- Make sure the proper environment variables are set

## Environment Variables

Ensure these variables are set in your `.env.local` file:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
``` 