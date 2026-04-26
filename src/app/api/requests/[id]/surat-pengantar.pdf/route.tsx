import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SuratPengantarDocument } from "@/lib/pdf/SuratPengantar";
import { getOfficial } from "@/lib/officials";
import { getLetterheadUrl } from "@/lib/app-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await context.params;

  const req = await prisma.incrementRequest.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          dosenDetail: { include: { academicRank: true } },
          staffDetail: { include: { payGrade: true } },
        },
      },
      hrReviewedBy: true,
      rectorSignedBy: true,
    },
  });
  if (!req) return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });

  if (session.role === "EMPLOYEE") {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user?.employeeId || user.employeeId !== req.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (req.status === "DRAFT" || req.status === "SUBMITTED" || req.status === "HR_REJECTED") {
    return NextResponse.json(
      { error: "Surat Pengantar belum tersedia sampai diverifikasi Bagian Kepegawaian." },
      { status: 409 },
    );
  }

  const [rector, letterheadUrl] = await Promise.all([
    getOfficial("RECTOR"),
    getLetterheadUrl(),
  ]);
  const buffer = await renderToBuffer(
    <SuratPengantarDocument
      record={req}
      rector={rector}
      letterheadUrl={letterheadUrl}
    />,
  );
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

  const filename = `Surat-Pengantar-${(req.coverLetterNumber ?? req.id).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
