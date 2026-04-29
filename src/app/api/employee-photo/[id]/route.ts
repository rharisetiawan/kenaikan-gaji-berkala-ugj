import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStoredUpload } from "@/lib/uploads";

/**
 * Stream an employee's profile photo. Auth-gated to any logged-in user;
 * photos are mildly sensitive (face data) but viewable across the app
 * for any employee, the same scope as their name and unit on the
 * employees list page.
 *
 * Uses `readStoredUpload` so all three storage backends work uniformly
 * (Drive in production, Vercel Blob, and local disk for dev).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await ctx.params;
  const emp = await prisma.employee.findUnique({
    where: { id },
    select: {
      photoDriveFileId: true,
      photoStoredPath: true,
      photoMimeType: true,
    },
  });
  if (!emp || !emp.photoStoredPath) {
    return new NextResponse("No photo", { status: 404 });
  }

  // Defense-in-depth: never trust MIME from Drive metadata or DB row;
  // force an image-only allowlist. Falls back to image/jpeg for unknown
  // values and disables sniffing via X-Content-Type-Options.
  const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
  const safeMime = (raw: string | null | undefined): string =>
    raw && ALLOWED.includes(raw) ? raw : "image/jpeg";

  try {
    const result = await readStoredUpload(
      emp.photoStoredPath,
      emp.photoDriveFileId,
    );
    return new NextResponse(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": safeMime(result.mimeType ?? emp.photoMimeType),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Photo unavailable", { status: 404 });
  }
}
