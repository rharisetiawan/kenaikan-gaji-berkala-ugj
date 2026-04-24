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

  const cert = await prisma.certification.findUnique({
    where: { id },
  });
  if (!cert || !cert.filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Access: ADMIN/HR can read anything; EMPLOYEE can only read their own.
  if (session.role === "EMPLOYEE") {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user?.employeeId || user.employeeId !== cert.employeeId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else if (session.role !== "ADMIN" && session.role !== "HR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const result = await readStoredUpload(cert.filePath);
  if (result.kind === "redirect") {
    return NextResponse.redirect(result.url, 302);
  }

  // Re-derive MIME from the stored extension (defense-in-depth — never trust
  // the value in cert.fileMimeType). Render PDFs/images inline; force download
  // for any Office/unknown type.
  const safeMime = safeMimeFor(cert.filePath);
  const isOfficeDoc =
    safeMime === "application/msword" ||
    safeMime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    safeMime === "application/vnd.ms-excel" ||
    safeMime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    safeMime === "application/octet-stream";
  const disposition = isOfficeDoc ? "attachment" : "inline";

  const safeName = (cert.fileName ?? "sertifikat").replace(/[^\w.\-]+/g, "_");

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
