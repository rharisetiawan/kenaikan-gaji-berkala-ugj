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

  if (employee.employmentStatus !== "TETAP") {
    throw new Error(
      "Kenaikan Gaji Berkala hanya berlaku untuk pegawai tetap.",
    );
  }

  const notes = (formData.get("notes") as string | null)?.toString() ?? null;

  const projectedEffectiveDate = computeNextIncrementDate(employee);
  const incrementAmount = computeIncrementAmount(employee.currentBaseSalary);
  const projectedNewSalary = employee.currentBaseSalary + incrementAmount;

  const required = requiredDocumentsFor(employee.type);
  for (const kind of required) {
    const file = formData.get(`doc_${kind}`);
    if (!(file instanceof File) || file.size === 0) {
      throw new Error(`Berkas ${kind} wajib diunggah.`);
    }
  }

  // Atomic check-and-create: two concurrent submissions from the same
  // employee (e.g. double-click or two tabs) can both pass a non-transactional
  // findFirst. Wrap both reads and write in a Serializable transaction so the
  // DB rejects the second one.
  const request = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.incrementRequest.findFirst({
        where: {
          employeeId: employee.id,
          status: {
            in: ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"],
          },
        },
      });
      if (existing) {
        throw new Error("Sudah ada pengajuan aktif yang sedang diproses.");
      }
      return tx.incrementRequest.create({
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
    },
    { isolationLevel: "Serializable" },
  );

  // File writes aren't transactional. If any upload or DB insert fails after
  // the IncrementRequest row was created, roll back the row so the employee
  // can resubmit (without hitting the duplicate-active-request guard).
  try {
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
  } catch (err) {
    await prisma.requestDocument.deleteMany({ where: { requestId: request.id } });
    await prisma.incrementRequest.delete({ where: { id: request.id } }).catch(() => {});
    throw err;
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

  // Default cover letter number if HR didn't supply one. The count+update is
  // wrapped in a Serializable transaction with bounded retry so two concurrent
  // HR verifications can't produce the same auto-number and trigger a unique
  // constraint violation on `coverLetterNumber`.
  const now = new Date();
  const monthRoman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][
    now.getMonth()
  ];
  const manualNumber = coverLetterNumberInput?.trim() || null;
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          let numberToUse = manualNumber;
          if (!numberToUse) {
            const count = await tx.incrementRequest.count({
              where: { coverLetterDate: { gte: startOfYear } },
            });
            numberToUse = `${String(count + 1 + attempt).padStart(3, "0")}/KGB/UGJ/${monthRoman}/${now.getFullYear()}`;
          }
          await tx.incrementRequest.update({
            where: { id },
            data: {
              status: "HR_VERIFIED",
              hrReviewedAt: now,
              hrReviewedById: session.userId,
              hrNotes: notes,
              coverLetterNumber: numberToUse,
              coverLetterDate: now,
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (manualNumber) throw err; // Manual number collision is a user error, not a retry case.
    }
  }
  if (lastError) throw lastError;

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

  const effectiveDate = req.projectedEffectiveDate;

  // Salary numbers are recomputed from the live employee row inside the
  // transaction rather than trusting the request snapshot. The snapshot was
  // taken at submission time; if the employee's salary was updated via the
  // direct admin path in the meantime, blindly overwriting with
  // `req.projectedNewSalary` could corrupt history or regress the employee's
  // pay. The snapshot is kept on the request for audit; the history record
  // reflects what actually happened.
  await prisma.$transaction(async (tx) => {
    const freshEmp = await tx.employee.findUnique({ where: { id: req.employeeId } });
    if (!freshEmp) {
      throw new Error("Pegawai tidak ditemukan saat menerbitkan SK.");
    }
    const previousSalary = freshEmp.currentBaseSalary;
    const incrementAmount = computeIncrementAmount(previousSalary);
    const newSalary = previousSalary + incrementAmount;

    const history = await tx.incrementHistory.create({
      data: {
        employeeId: freshEmp.id,
        previousSalary,
        newSalary,
        incrementAmount,
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
      where: { id: freshEmp.id },
      data: {
        currentBaseSalary: newSalary,
        lastIncrementDate: effectiveDate,
        nextIncrementDate: computeNextIncrementDate({
          hireDate: freshEmp.hireDate,
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
