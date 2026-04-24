import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolveUpload } from "@/lib/uploads";

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

  const absPath = resolveUpload(doc.storedPath);
  const bytes = await readFile(absPath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.originalName}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
