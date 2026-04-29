import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { streamDriveFile } from "@/lib/gdrive";

/**
 * Stream the current letterhead image bytes for the admin preview UI.
 *
 * Drive-backed letterheads are fetched via the service account (no
 * dependency on anyone-with-link Drive ACLs). Legacy Vercel Blob
 * letterheads are redirected to so the browser fetches them directly.
 *
 * Auth-gated to any logged-in user — the kop surat is institutional
 * artwork and not sensitive, but we don't expose it to anonymous
 * clients to keep the rule "all uploads sit behind auth" simple.
 */
export async function GET() {
  await requireUser();
  const s = await getAppSettings();

  if (s.letterheadDriveFileId) {
    try {
      const { bytes, mimeType } = await streamDriveFile(s.letterheadDriveFileId);
      // Defense-in-depth: never trust the MIME from Drive metadata. Force
      // an image-only allowlist (uploadLetterheadAction already restricts
      // extensions to png/jpg/webp at upload time). Anything else falls
      // back to image/png — sniffing is also disabled via nosniff.
      const safeMime = ["image/png", "image/jpeg", "image/webp"].includes(mimeType)
        ? mimeType
        : "image/png";
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": safeMime,
          "X-Content-Type-Options": "nosniff",
          // Match sibling download routes — sandbox prevents an attacker-
          // controlled byte stream from being interpreted as HTML/JS even
          // if a misconfiguration ever served the wrong Content-Type.
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Cache-Control": "private, max-age=300",
        },
      });
    } catch {
      return new NextResponse("Letterhead unavailable", { status: 404 });
    }
  }

  if (s.letterheadUrl && /^https?:\/\//i.test(s.letterheadUrl)) {
    return NextResponse.redirect(s.letterheadUrl, 302);
  }

  return new NextResponse("No letterhead configured", { status: 404 });
}
