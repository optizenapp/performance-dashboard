import { NextRequest, NextResponse } from 'next/server';
import { getGSCClient } from '@/lib/gsc-client';

export async function POST(request: NextRequest) {
  try {
    const { tokens } = await request.json();
    
    if (!tokens) {
      return NextResponse.json(
        { error: 'Tokens are required' },
        { status: 400 }
      );
    }

    console.log('Syncing tokens to server...', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token
    });

    // Store tokens in global cache for server-side access
    global.gscTokens = tokens;
    
    // Also set credentials on the GSC client
    const gscClient = getGSCClient();
    // The auth property is private, so we'll rely on the global cache
    // The client will load from global cache when needed
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Token sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync tokens' },
      { status: 500 }
    );
  }
}
