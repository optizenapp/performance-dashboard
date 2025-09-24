import { NextRequest, NextResponse } from 'next/server';
import { getGSCClient } from '@/lib/gsc-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Handle missing authorization code
    if (!code) {
      return NextResponse.redirect(
        new URL('/?error=missing_code', request.url)
      );
    }

    // Exchange code for tokens
    const gscClient = getGSCClient();
    await gscClient.setCredentials(code);

    // Redirect back to main page with success
    return NextResponse.redirect(
      new URL('/?auth=success', request.url)
    );

  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('auth_failed')}`, request.url)
    );
  }
}
