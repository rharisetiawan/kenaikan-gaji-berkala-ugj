"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { computeIncrementAmount, computeNextIncrementDate } from "@/lib/eligibility";
import { saveUpload } from "@/lib/uploads";
import { requiredDocumentsFor, workflowEnabledFor } from "@/lib/requests";
import type { DocumentKind, IncrementRequestStatus } from "@prisma/client";

function assertTransition(
  current: IncrementRequestStatus,
  allowed: IncrementRequestStatus[],
): void {
  if (!allowed.includes(current)) {
    throw new Error(
      `Perubahan status tidak diizinkan dari "${current}" ke "${allowed.join("/")}" `,
    );
  }
}

/**
 * Employee: create a new IncrementRequest from their own profile and upload
 * all required supporting documents in one step.
 */
export async function submitIncrementRequestAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (session.role !== "EMPLOYEE" && session.role !== "ADMIN") {
    throw new Error("Hanya pegawai yang dapat mengajukan KGB dari akun sendiri.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { employee: true },
  });
  if (!user?.employee) {
    throw new Error("Akun ini belum tertaut dengan data pegawai.");
  }
  const employee = user.employee;

  if (!workflowEnabledFor(employee.type)) {
    throw new Error(
      "Alur KGB untuk Dosen belum dibuka. Saat ini sistem fokus pada Tenaga Kependidikan.",
    );
  }

  const notes = (formData.get("notes") as string | null)?.toString() ?? null;

  const projectedEffectiveDate = computeNextIncrementDate(employee);
  const incrementAmount = computeIncrementAmount(employee.currentBaseSalary);
  const projectedNewSalary = employee.currentBaseSalary + incrementAmount;

  // Block duplicate active requests.
  const existing = await prisma.incrementRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"] },
    },
  });
  if (existing) {
    throw new Error("Sudah ada pengajuan aktif yang sedang diproses.");
  }

  const required = requiredDocumentsFor(employee.type);
  for (const kind of required) {
    const file = formData.get(`doc_${kind}`);
    if (!(file instanceof File) || file.size === 0) {
      throw new Error(`Berkas ${kind} wajib diunggah.`);
    }
  }

  const request = await prisma.incrementRequest.create({
    data: {
      employeeId: employee.id,
      status: "SUBMITTED",
      currentSalary: employee.currentBaseSalary,
      projectedNewSalary,
      incrementAmount,
      projectedEffectiveDate,
      employeeNotes: notes,
      submittedAt: new Date(),
    },
  });

  for (const kind of required) {
    const file = formData.get(`doc_${kind}`) as File;
    const saved = await saveUpload(file, request.id, kind);
    await prisma.requestDocument.create({
      data: {
        requestId: request.id,
        kind: kind as DocumentKind,
        originalName: saved.originalName,
        storedPath: saved.storedPath,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        uploadedById: session.userId,
      },
    });
  }

  revalidatePath("/my-requests");
  revalidatePath("/hr");
  redirect(`/my-requests/${request.id}`);
}

async function loadRequestOrThrow(id: string) {
  const req = await prisma.incrementRequest.findUnique({
    where: { id },
    include: { employee: true, documents: true },
  });
  if (!req) throw new Error("Pengajuan tidak ditemukan.");
  return req;
}

/** HR: verify a submission and auto-generate a cover letter number. */
export async function hrVerifyAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (session.role !== "HR" && session.role !== "ADMIN") {
    throw new Error("Hanya Bagian Kepegawaian yang dapat memverifikasi pengajuan.");
  }
  const id = (formData.get("requestId") as string).toString();
  const notes = (formData.get("notes") as string | null)?.toString() ?? null;
  const coverLetterNumberInput = (formData.get("coverLetterNumber") as string | null)?.toString();

  const req = await loadRequestOrThrow(id);
  assertTransition(req.status, ["SUBMITTED"]);

  // Default cover letter number if HR didn't supply one.
  const now = new Date();
  const monthRoman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][
    now.getMonth()
  ];
  const count = await prisma.incrementRequest.count({
    where: { coverLetterDate: { gte: new Date(now.getFullYear(), 0, 1) } },
  });
  const autoNumber = `${String(count + 1).padStart(3, "0")}/KGB/UGM/${monthRoman}/${now.getFullYear()}`;

  await prisma.incrementRequest.update({
    where: { id },
    data: {
      status: "HR_VERIFIED",
      hrReviewedAt: now,
      hrReviewedById: session.userId,
      hrNotes: notes,
      coverLetterNumber: coverLetterNumberInput?.trim() || autoNumber,
      coverLetterDate: now,
    },
  });

  revalidatePath("/hr");
  revalidatePath("/rector");
  revalidatePath(`/my-requests/${id}`);
  redirect(`/hr/${id}`);
}

/** HR: reject a submission (sends it back to the employee). */
export async function hrRejectAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (session.role !== "HR" && session.role !== "ADMIN") {
    throw new Error("Hanya Bagian Kepegawaian yang dapat menolak pengajuan.");
  }
  const id = (formData.get("requestId") as string).toString();
  const notes = (formData.get("notes") as string | null)?.toString() ?? null;
  if (!notes?.trim()) throw new Error("Alasan penolakan wajib diisi.");

  const req = await loadRequestOrThrow(id);
  assertTransition(req.status, ["SUBMITTED"]);

  await prisma.incrementRequest.update({
    where: { id },
    data: {
      status: "HR_REJECTED",
      hrReviewedAt: new Date(),
      hrReviewedById: session.userId,
      hrNotes: notes,
    },
  });

  revalidatePath("/hr");
  revalidatePath(`/my-requests/${id}`);
  redirect(`/hr/${id}`);
}

/** Rektor: sign the generated cover letter and forward to Yayasan. */
export async function rectorSignAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (session.role !== "RECTOR" && session.role !== "ADMIN") {
    throw new Error("Hanya Rektor yang dapat menandatangani Surat Pengantar.");
  }
  const id = (formData.get("requestId") as string).toString();
  const notes = (formData.get("notes") as string | null)?.toString() ?? null;

  const req = await loadRequestOrThrow(id);
  assertTransition(req.status, ["HR_VERIFIED"]);

  await prisma.incrementRequest.update({
    where: { id },
    data: {
      status: "RECTOR_SIGNED",
      rectorSignedAt: new Date(),
      rectorSignedById: session.userId,
      rectorNotes: notes,
    },
  });

  revalidatePath("/rector");
  revalidatePath("/foundation");
  revalidatePath(`/my-requests/${id}`);
  redirect(`/rector/${id}`);
}

/** Yayasan: approve request (ready to issue SK). */
export async function foundationApproveAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (session.role !== "FOUNDATION" && session.role !== "ADMIN") {
    throw new Error("Hanya Yayasan yang dapat menyetujui pengajuan.");
  }
  const id = (formData.get("requestId") as string).toString();
  const notes = (formData.get("notes") as string | null)?.toString() ?? null;

  const req = await loadRequestOrThrow(id);
  assertTransition(req.status, ["RECTOR_SIGNED"]);

  await prisma.incrementRequest.update({
    where: { id },
    data: {
      status: "FOUNDATION_APPROVED",
      foundationReviewedAt: new Date(),
      foundationReviewedById: session.userId,
      foundationNotes: notes,
    },
  });
  revalidatePath("/foundation");
  revalidatePath(`/my-requests/${id}`);
  redirect(`/foundation/${id}`);
}

/** Yayasan: reject the request. */
export async function foundationRejectAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (session.role !== "FOUNDATION" && session.role !== "ADMIN") {
    throw new Error("Hanya Yayasan yang dapat menolak pengajuan.");
  }
  const id = (formData.get("requestId") as string).toString();
  const notes = (formData.get("notes") as string | null)?.toString() ?? null;
  if (!notes?.trim()) throw new Error("Alasan penolakan wajib diisi.");

  const req = await loadRequestOrThrow(id);
  assertTransition(req.status, ["RECTOR_SIGNED"]);

  await prisma.incrementRequest.update({
    where: { id },
    data: {
      status: "FOUNDATION_REJECTED",
      foundationReviewedAt: new Date(),
      foundationReviewedById: session.userId,
      foundationNotes: notes,
    },
  });
  revalidatePath("/foundation");
  revalidatePath(`/my-requests/${id}`);
  redirect(`/foundation/${id}`);
}

/** Yayasan: issue the final SK Berkala (writes IncrementHistory + updates employee). */
export async function foundationIssueSkAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  if (session.role !== "FOUNDATION" && session.role !== "ADMIN") {
    throw new Error("Hanya Yayasan yang dapat menerbitkan SK.");
  }
  const id = (formData.get("requestId") as string).toString();
  const decreeNumberInput = (formData.get("decreeNumber") as string).toString();
  const decreeDateInput = (formData.get("decreeDate") as string).toString();
  const signedByName = (formData.get("signedByName") as string).toString();
  const signedByPosition = (formData.get("signedByPosition") as string).toString();

  const req = await loadRequestOrThrow(id);
  assertTransition(req.status, ["FOUNDATION_APPROVED"]);

  const emp = req.employee;
  const effectiveDate = req.projectedEffectiveDate;
  const newSalary = req.projectedNewSalary;
  const increment = req.incrementAmount;

  await prisma.$transaction(async (tx) => {
    const history = await tx.incrementHistory.create({
      data: {
        employeeId: emp.id,
        previousSalary: emp.currentBaseSalary,
        newSalary,
        incrementAmount: increment,
        effectiveDate,
        decreeNumber: decreeNumberInput,
        decreeDate: new Date(decreeDateInput),
        signedByName,
        signedByPosition,
        reason: req.employeeNotes ?? "Kenaikan Gaji Berkala reguler.",
        status: "ISSUED",
        generatedById: session.userId,
      },
    });
    await tx.incrementRequest.update({
      where: { id },
      data: {
        status: "ISSUED",
        decreeNumber: decreeNumberInput,
        decreeDate: new Date(decreeDateInput),
        signedByName,
        signedByPosition,
        issuedAt: new Date(),
        incrementHistoryId: history.id,
      },
    });
    await tx.employee.update({
      where: { id: emp.id },
      data: {
        currentBaseSalary: newSalary,
        lastIncrementDate: effectiveDate,
        nextIncrementDate: computeNextIncrementDate({
          hireDate: emp.hireDate,
          lastIncrementDate: effectiveDate,
        }),
      },
    });
  });

  revalidatePath("/foundation");
  revalidatePath("/dashboard");
  revalidatePath(`/my-requests/${id}`);
  redirect(`/foundation/${id}`);
}

/** Employee: cancel a draft / submitted request (only while still unreviewed). */
export async function cancelRequestAction(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = (formData.get("requestId") as string).toString();
  const req = await loadRequestOrThrow(id);

  const owner = await prisma.user.findFirst({ where: { employeeId: req.employeeId } });
  if (session.role !== "ADMIN" && owner?.id !== session.userId) {
    throw new Error("Anda tidak berhak membatalkan pengajuan ini.");
  }
  assertTransition(req.status, ["DRAFT", "SUBMITTED", "HR_REJECTED", "FOUNDATION_REJECTED"]);
  await prisma.incrementRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/my-requests");
  revalidatePath(`/my-requests/${id}`);
}
