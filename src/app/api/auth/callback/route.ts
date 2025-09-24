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
      return new NextResponse(
        `<html><body><script>
          window.opener?.postMessage({type: 'GSC_AUTH_ERROR', error: '${error}'}, '*');
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Handle missing authorization code
    if (!code) {
      return new NextResponse(
        `<html><body><script>
          window.opener?.postMessage({type: 'GSC_AUTH_ERROR', error: 'missing_code'}, '*');
          window.close();
        </script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Exchange code for tokens
    const gscClient = getGSCClient();
    await gscClient.setCredentials(code);

    // Send success message to parent window and close popup
    return new NextResponse(
      `<html><body><script>
        window.opener?.postMessage({type: 'GSC_AUTH_SUCCESS'}, '*');
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    return new NextResponse(
      `<html><body><script>
        window.opener?.postMessage({type: 'GSC_AUTH_ERROR', error: 'auth_failed'}, '*');
        window.close();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
