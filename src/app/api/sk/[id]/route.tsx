import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SuratKeputusanDocument } from "@/lib/pdf/SuratKeputusan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await context.params;

  const record = await prisma.incrementHistory.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          dosenDetail: { include: { academicRank: true } },
          staffDetail: { include: { payGrade: true } },
        },
      },
      generatedBy: true,
    },
  });

  if (!record) {
    return NextResponse.json({ error: "SK tidak ditemukan" }, { status: 404 });
  }

  const buffer = await renderToBuffer(<SuratKeputusanDocument record={record} />);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

  const filename = `SK-KGB-${(record.decreeNumber ?? record.id).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
