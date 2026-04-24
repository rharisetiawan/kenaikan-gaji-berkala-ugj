import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readStoredUpload, safeMimeFor } from "@/lib/uploads";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireUser();
  const { id } = await params;

  const doc = await prisma.requestDocument.findUnique({
    where: { id },
    include: { request: { include: { employee: true } } },
  });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  // Access: ADMIN/HR/RECTOR/FOUNDATION can read anything;
  // EMPLOYEE can only read documents attached to their own request.
  if (session.role === "EMPLOYEE") {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user?.employeeId || user.employeeId !== doc.request.employeeId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const result = await readStoredUpload(doc.storedPath);
  if (result.kind === "redirect") {
    return NextResponse.redirect(result.url, 302);
  }

  // Re-derive the MIME type from the stored filename extension rather than
  // trusting the value in `doc.mimeType` (defense-in-depth — even if an old
  // row predates the MIME-allowlist fix, it gets sanitized at read time).
  // Office docs are sent as attachment; PDFs/images can safely render inline.
  const safeMime = safeMimeFor(doc.storedPath);
  const isOfficeDoc =
    safeMime === "application/msword" ||
    safeMime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    safeMime === "application/vnd.ms-excel" ||
    safeMime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    safeMime === "application/octet-stream";
  const disposition = isOfficeDoc ? "attachment" : "inline";

  // Sanitize the filename for the Content-Disposition header: drop any
  // quotes/newlines that could break out of the header.
  const safeName = doc.originalName.replace(/[^\w.\-]+/g, "_");

  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": safeMime,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
