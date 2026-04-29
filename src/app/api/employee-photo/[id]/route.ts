import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamDriveFile } from "@/lib/gdrive";

/**
 * Stream an employee's profile photo. Auth-gated to any logged-in user;
 * photos are mildly sensitive (face data) but viewable across the app
 * for any employee, the same scope as their name and unit on the
 * employees list page.
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
  if (!emp) {
    return new NextResponse("Not found", { status: 404 });
  }

  const safeMime = (raw: string | null): string =>
    raw && ["image/png", "image/jpeg", "image/webp"].includes(raw)
      ? raw
      : "image/jpeg";

  if (emp.photoDriveFileId) {
    try {
      const { bytes, mimeType } = await streamDriveFile(emp.photoDriveFileId);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": safeMime(mimeType),
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Cache-Control": "private, max-age=300",
        },
      });
    } catch {
      return new NextResponse("Photo unavailable", { status: 404 });
    }
  }

  if (emp.photoStoredPath && /^https?:\/\//i.test(emp.photoStoredPath)) {
    return NextResponse.redirect(emp.photoStoredPath, 302);
  }

  return new NextResponse("No photo", { status: 404 });
}
