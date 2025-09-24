# Medcerts SEO Dashboard

A comprehensive SEO metrics reporting dashboard that combines Google Search Console and Ahrefs data.

## Features

- 📊 **Real-time GSC Data**: Direct integration with Google Search Console API
- 📈 **Ahrefs CSV Import**: Upload and analyze Ahrefs keyword data  
- 🎯 **Combined Analytics**: Unified view of GSC + Ahrefs metrics
- 📱 **Responsive Design**: Works on desktop and mobile
- 🔍 **Advanced Filtering**: Date ranges, metrics, sources, queries
- 📊 **Interactive Charts**: Line/bar charts with comparison views
- 📋 **Data Tables**: Sortable, searchable tables with export
- 🔐 **Secure OAuth**: Google API integration with proper authentication

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS + Shadcn/ui
- **Charts**: Recharts
- **APIs**: Google Search Console API
- **Data**: CSV parsing with Papa Parse
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Google Search Console API credentials (see GSC_SETUP.md)
4. Add environment variables
5. Run development server: `npm run dev`

## Environment Variables

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://yourdomain.vercel.app/api/auth/callback
```

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/medcerts-seo-dashboard)

