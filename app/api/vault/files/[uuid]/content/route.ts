import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  if (!uuid) {
    return NextResponse.json({ error: 'File UUID is required' }, { status: 400 });
  }

  try {
    // Get cookies to forward auth to Django backend
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Get signed URL from Django backend (server-side, not exposed to client)
    const downloadResponse = await fetch(
      `${BASE_URL}/opie/api/v1/vault-files/${uuid}/download/?expires=5&disposition=inline`,
      {
        headers: {
          'Cookie': cookieHeader,
        },
      }
    );

    if (!downloadResponse.ok) {
      if (downloadResponse.status === 401 || downloadResponse.status === 403) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.json(
        { error: 'Failed to get file URL' },
        { status: downloadResponse.status }
      );
    }

    const { url, content_type, filename } = await downloadResponse.json();

    // Fetch the actual file content from storage (signed URL stays server-side)
    const fileResponse = await fetch(url);

    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch file content' },
        { status: fileResponse.status }
      );
    }

    // Stream the file content back to the client
    const headers = new Headers();
    headers.set('Content-Type', content_type || 'application/octet-stream');
    headers.set('Content-Disposition', `inline; filename="${filename}"`);

    // Cache for 5 minutes (matches short signed URL expiry)
    headers.set('Cache-Control', 'private, max-age=300');

    return new NextResponse(fileResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error proxying vault file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
