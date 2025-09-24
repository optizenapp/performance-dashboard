# Google Search Console API Setup Guide

## Prerequisites

To use the Google Search Console integration, you'll need to set up Google API credentials.

## Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Search Console API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Search Console API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure the consent screen if prompted
4. Choose "Web application" as the application type
5. Add authorized origins:
   - `http://localhost:3000` (for development)
   - Your production domain (e.g., `https://yourdomain.com`)
6. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback` (for development)
   - `https://yourdomain.com/api/auth/callback` (for production)

## Step 3: Environment Variables

Create a `.env.local` file in your project root with:

```env
# Google Search Console API Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

## Step 4: Verify Search Console Access

Make sure you have access to the website in Google Search Console:
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add and verify your website property
3. Ensure you have "Owner" or "Full User" permissions

## Step 5: Test the Integration

1. Start your development server: `npm run dev`
2. Go to your dashboard
3. Click "Connect to Google Search Console"
4. Complete the OAuth flow
5. Select your verified property
6. Import your GSC data

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch" error**
   - Check that your redirect URI in Google Cloud Console matches exactly
   - Make sure there are no trailing slashes

2. **"access_denied" error**
   - Ensure you have proper permissions in Google Search Console
   - Check that the Search Console API is enabled

3. **"invalid_client" error**
   - Verify your Client ID and Client Secret are correct
   - Make sure the OAuth client is for a "Web application"

### Required Scopes:
The application requests the following scope:
- `https://www.googleapis.com/auth/webmasters.readonly`

This provides read-only access to your Search Console data.

## Security Notes

- Never commit your `.env.local` file to version control
- The Client ID can be public, but keep the Client Secret private
- Use different credentials for development and production
- Regularly rotate your credentials for security

## Data Available

Once connected, you'll have access to:
- **Clicks**: Number of clicks from search results
- **Impressions**: How often your pages appeared in search
- **CTR**: Click-through rate percentage
- **Average Position**: Your ranking position
- **Queries**: What users searched for
- **Pages**: Which pages appeared in search
- **Time Series Data**: Daily performance trends
