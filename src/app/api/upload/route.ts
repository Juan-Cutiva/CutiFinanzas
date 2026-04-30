import { auth } from '@clerk/nextjs/server';
import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf'];
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          tokenPayload: JSON.stringify({ userId, pathname }),
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (process.env.NODE_ENV === 'development') {
          console.info('[blob] uploaded', blob.url, tokenPayload);
        }
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload error' },
      { status: 400 },
    );
  }
}
