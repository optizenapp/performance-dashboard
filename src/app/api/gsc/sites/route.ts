import { NextResponse } from 'next/server';
import { getGSCClient } from '@/lib/gsc-client';

export async function GET() {
  try {
    const gscClient = getGSCClient();
    
    // Check if authenticated
    if (!gscClient.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Search Console' },
        { status: 401 }
      );
    }

    const sites = await gscClient.getSites();
    
    return NextResponse.json({ sites });
  } catch (error) {
    console.error('GSC Sites Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve sites from Google Search Console' },
      { status: 500 }
    );
  }
}
