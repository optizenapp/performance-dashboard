import { NextRequest, NextResponse } from 'next/server';
import { getGSCClient } from '@/lib/gsc-client';

export async function GET() {
  try {
    const gscClient = getGSCClient();
    const authUrl = gscClient.getAuthUrl();
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('GSC Auth Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    const gscClient = getGSCClient();
    await gscClient.setCredentials(code);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GSC Token Exchange Error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange authorization code for tokens' },
      { status: 500 }
    );
  }
}
