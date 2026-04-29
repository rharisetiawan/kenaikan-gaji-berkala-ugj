"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth";
import {
  computeIncrementAmount,
  computeNextIncrementDate,
  dosenHasRecentBkdPasses,
} from "@/lib/eligibility";
import { readKgbRulesInTx } from "@/lib/app-settings";
import { saveUpload, rollbackUpload, type SavedUpload } from "@/lib/uploads";
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
    include: {
      employee: {
        include: { bkdEvaluations: true },
      },
    },
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

  const required = requiredDocumentsFor(employee.type);
  for (const kind of required) {
    const file = formData.get(`doc_${kind}`);
    if (!(file instanceof File) || file.size === 0) {
      throw new Error(`Berkas ${kind} wajib diunggah.`);
    }
  }

  // Atomic check-and-create: two concurrent submissions from the same
  // employee (e.g. double-click or two tabs) can both pass a non-transactional
  // findFirst. Wrap rules read, BKD gate, financial computation, dupe check,
  // and create in one Serializable transaction so:
  //   - The financial snapshot stored on the IncrementRequest comes from the
  //     same isolation snapshot as the BKD gate (no split-brain on rules).
  //   - A DB blip on the rules read aborts the txn instead of silently
  //     falling back to hardcoded defaults (cf. the warning on
  //     getAppSettings in src/lib/app-settings.ts).
  const request = await prisma.$transaction(
    async (tx) => {
      const rules = await readKgbRulesInTx(tx);

      // Dosen gate: block submission if BKD isn't passed for the configured
      // number of most-recent semesters. HR would otherwise reject; pre-
      // flighting avoids wasted uploads.
      if (
        employee.type === "DOSEN" &&
        !dosenHasRecentBkdPasses(employee.bkdEvaluations, rules.dosenRequiredBkdPasses)
      ) {
        throw new Error(
          `Pengajuan diblokir: BKD ${rules.dosenRequiredBkdPasses} semester terakhir belum lulus. Selesaikan BKD sebelum mengajukan KGB.`,
        );
      }

      const incrementAmount = computeIncrementAmount(
        employee.currentBaseSalary,
        rules.incrementPercent,
      );
      const projectedNewSalary = employee.currentBaseSalary + incrementAmount;

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
  // the IncrementRequest row was created, roll back both the DB row and any
  // Drive files we already created so the employee can resubmit cleanly.
  const uploadedSoFar: SavedUpload[] = [];
  try {
    for (const kind of required) {
      const file = formData.get(`doc_${kind}`) as File;
      const saved = await saveUpload(file, request.id, kind);
      uploadedSoFar.push(saved);
      await prisma.requestDocument.create({
        data: {
          requestId: request.id,
          kind: kind as DocumentKind,
          originalName: saved.originalName,
          storedPath: saved.storedPath,
          driveFileId: saved.driveFileId,
          driveWebViewLink: saved.driveWebViewLink,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          uploadedById: session.userId,
        },
      });
    }
  } catch (err) {
    await Promise.all(uploadedSoFar.map((s) => rollbackUpload(s)));
    await prisma.requestDocument.deleteMany({ where: { requestId: request.id } });
    await prisma.incrementRequest.delete({ where: { id: request.id } }).catch(() => {});
    throw err;
  }

  revalidatePath("/my-requests");
  revalidatePath("/hr");
  redirect(`/my-requests/${request.id}`);
}

/**
 * HR (or ADMIN) bypass: submit an IncrementRequest on behalf of an elderly
 * or non-tech-savvy pegawai. The same eligibility/gate checks apply as for
 * the self-service flow; the request is persisted with `filedById` set to
 * the HR user so audit can distinguish HR-filed vs self-filed requests.
 */
export async function submitRequestOnBehalfAction(formData: FormData): Promise<void> {
  const session = await requireRole(["HR", "ADMIN"]);

  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!employeeId) throw new Error("ID pegawai wajib.");

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { bkdEvaluations: true },
  });
  if (!employee) throw new Error("Pegawai tidak ditemukan.");

  if (!workflowEnabledFor(employee.type)) {
    throw new Error(
      "Alur KGB untuk tipe pegawai ini belum diaktifkan.",
    );
  }
  if (employee.employmentStatus !== "TETAP") {
    throw new Error(
      "Kenaikan Gaji Berkala hanya berlaku untuk pegawai tetap.",
    );
  }
  const notes = (formData.get("notes") as string | null)?.toString() ?? null;
  const projectedEffectiveDate = computeNextIncrementDate(employee);

  const required = requiredDocumentsFor(employee.type);
  for (const kind of required) {
    const file = formData.get(`doc_${kind}`);
    if (!(file instanceof File) || file.size === 0) {
      throw new Error(`Berkas ${kind} wajib diunggah.`);
    }
  }

  // See submitIncrementRequestAction for the rationale: rules read + BKD
  // gate + financial computation + dupe check + create all live in one
  // Serializable transaction so the financial snapshot is derived from
  // the same rules that gated the submission, and a DB blip on the rules
  // read aborts the txn instead of silently using hardcoded defaults.
  const request = await prisma.$transaction(
    async (tx) => {
      const rules = await readKgbRulesInTx(tx);

      if (
        employee.type === "DOSEN" &&
        !dosenHasRecentBkdPasses(employee.bkdEvaluations, rules.dosenRequiredBkdPasses)
      ) {
        throw new Error(
          `Pengajuan diblokir: BKD ${rules.dosenRequiredBkdPasses} semester terakhir belum lulus.`,
        );
      }

      const incrementAmount = computeIncrementAmount(
        employee.currentBaseSalary,
        rules.incrementPercent,
      );
      const projectedNewSalary = employee.currentBaseSalary + incrementAmount;

      const existing = await tx.incrementRequest.findFirst({
        where: {
          employeeId: employee.id,
          status: {
            in: ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"],
          },
        },
      });
      if (existing) {
        throw new Error(
          "Sudah ada pengajuan aktif pegawai ini yang sedang diproses.",
        );
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
          filedById: session.userId,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  const uploadedSoFar: SavedUpload[] = [];
  try {
    for (const kind of required) {
      const file = formData.get(`doc_${kind}`) as File;
      const saved = await saveUpload(file, request.id, kind);
      uploadedSoFar.push(saved);
      await prisma.requestDocument.create({
        data: {
          requestId: request.id,
          kind: kind as DocumentKind,
          originalName: saved.originalName,
          storedPath: saved.storedPath,
          driveFileId: saved.driveFileId,
          driveWebViewLink: saved.driveWebViewLink,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          uploadedById: session.userId,
        },
      });
    }
  } catch (err) {
    await Promise.all(uploadedSoFar.map((s) => rollbackUpload(s)));
    await prisma.requestDocument.deleteMany({ where: { requestId: request.id } });
    await prisma.incrementRequest.delete({ where: { id: request.id } }).catch(() => {});
    throw err;
  }

  revalidatePath("/hr");
  revalidatePath(`/employees/${employee.id}`);
  redirect(`/hr/${request.id}`);
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

  // All guards + writes must run inside a Serializable transaction to avoid
  // double-issuing the SK. Two concurrent Foundation calls (double-click or
  // two reviewers) could otherwise both read the request as FOUNDATION_APPROVED
  // before either transaction commits, resulting in a phantom IncrementHistory
  // and an inflated salary. Recompute salary from the live employee row inside
  // the transaction (the request snapshot is audit-only).
  await prisma.$transaction(
    async (tx) => {
      const freshReq = await tx.incrementRequest.findUnique({ where: { id } });
      if (!freshReq) throw new Error("Pengajuan tidak ditemukan.");
      assertTransition(freshReq.status, ["FOUNDATION_APPROVED"]);

      const effectiveDate = freshReq.projectedEffectiveDate;

      const freshEmp = await tx.employee.findUnique({ where: { id: freshReq.employeeId } });
      if (!freshEmp) {
        throw new Error("Pegawai tidak ditemukan saat menerbitkan SK.");
      }
      const previousSalary = freshEmp.currentBaseSalary;
      // Re-read rules through the tx client so the rules snapshot lives
      // inside the same Serializable isolation as the salary read above.
      // A concurrent admin update to incrementPercent will either be
      // reflected here (and the salary read above will see the same
      // post-update state) or the txn will abort — never split-read.
      const rules = await readKgbRulesInTx(tx);
      const incrementAmount = computeIncrementAmount(
        previousSalary,
        rules.incrementPercent,
      );
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
          reason: freshReq.employeeNotes ?? "Kenaikan Gaji Berkala reguler.",
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
    },
    { isolationLevel: "Serializable" },
  );

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
