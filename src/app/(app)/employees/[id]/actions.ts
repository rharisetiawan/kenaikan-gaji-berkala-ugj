"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, getSession } from "@/lib/auth";
import {
  computeIncrementAmount,
  computeNextIncrementDate,
} from "@/lib/eligibility";

export interface ActionState {
  error?: string;
  success?: string;
}

const INIT: ActionState = {};

function reqString(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`Field ${key} wajib diisi.`);
  }
  return v.trim();
}

function optString(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim();
}

function reqDate(formData: FormData, key: string): Date {
  const v = reqString(formData, key);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Tanggal pada ${key} tidak valid.`);
  return d;
}

function reqNumber(formData: FormData, key: string): number {
  const v = reqString(formData, key).replace(/[,.]/g, "");
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Nilai ${key} tidak valid.`);
  return n;
}

export async function addBkdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["ADMIN", "HR"]);
  try {
    const employeeId = reqString(formData, "employeeId");
    const academicYear = reqString(formData, "academicYear");
    const semester = reqString(formData, "semester");
    const sksLoad = Number(reqString(formData, "sksLoad"));
    const status = reqString(formData, "status") as "PASS" | "FAIL" | "PENDING";
    const notes = optString(formData, "notes");

    if (!["PASS", "FAIL", "PENDING"].includes(status)) {
      return { error: "Status BKD tidak valid." };
    }

    await prisma.bkdEvaluation.upsert({
      where: {
        employeeId_academicYear_semester: { employeeId, academicYear, semester },
      },
      update: { sksLoad, status, notes },
      create: { employeeId, academicYear, semester, sksLoad, status, notes },
    });

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/dashboard");
    return { ...INIT, success: "Data BKD berhasil disimpan." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addPerformanceScoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["ADMIN", "HR"]);
  try {
    const employeeId = reqString(formData, "employeeId");
    const year = Number(reqString(formData, "year"));
    const score = Number(reqString(formData, "score"));
    const rating = reqString(formData, "rating") as
      | "EXCELLENT"
      | "GOOD"
      | "SUFFICIENT"
      | "POOR"
      | "VERY_POOR";
    const notes = optString(formData, "notes");

    await prisma.performanceScore.upsert({
      where: { employeeId_year: { employeeId, year } },
      update: { score, rating, notes },
      create: { employeeId, year, score, rating, notes },
    });

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/dashboard");
    return { ...INIT, success: "Nilai kinerja berhasil disimpan." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function issueIncrementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["ADMIN", "HR"]);
  try {
    const session = await getSession();
    const employeeId = reqString(formData, "employeeId");
    const decreeNumber = reqString(formData, "decreeNumber");
    const decreeDate = reqDate(formData, "decreeDate");
    const effectiveDate = reqDate(formData, "effectiveDate");
    const signedByName = reqString(formData, "signedByName");
    const signedByPosition = reqString(formData, "signedByPosition");
    const reason = optString(formData, "reason") ?? "Kenaikan Gaji Berkala Reguler.";
    const newSalaryInput = formData.get("newSalary");
    const manualNewSalary =
      typeof newSalaryInput === "string" && newSalaryInput.trim()
        ? reqNumber(formData, "newSalary")
        : null;

    // Everything — active-request guard, employee read, and history write — runs
    // inside a single Serializable transaction so neither a stale salary read
    // nor a concurrent workflow issuance can corrupt data.
    const record = await prisma.$transaction(
      async (tx) => {
        const activeRequest = await tx.incrementRequest.findFirst({
          where: {
            employeeId,
            status: {
              in: ["SUBMITTED", "HR_VERIFIED", "RECTOR_SIGNED", "FOUNDATION_APPROVED"],
            },
          },
        });
        if (activeRequest) {
          throw new Error(
            "Pegawai memiliki pengajuan KGB yang sedang diproses. Selesaikan lewat alur portal (HR / Rektor / Yayasan) atau batalkan pengajuan sebelum menerbitkan SK langsung.",
          );
        }

        const employee = await tx.employee.findUnique({ where: { id: employeeId } });
        if (!employee) {
          throw new Error("Pegawai tidak ditemukan.");
        }

        const previousSalary = employee.currentBaseSalary;
        const defaultIncrement = computeIncrementAmount(previousSalary);
        const newSalary = manualNewSalary ?? previousSalary + defaultIncrement;
        const finalIncrement = newSalary - previousSalary;

        const created = await tx.incrementHistory.create({
          data: {
            employeeId,
            previousSalary,
            newSalary,
            incrementAmount: finalIncrement,
            effectiveDate,
            decreeNumber,
            decreeDate,
            signedByName,
            signedByPosition,
            reason,
            status: "ISSUED",
            generatedById: session?.userId ?? null,
          },
        });

        await tx.employee.update({
          where: { id: employeeId },
          data: {
            currentBaseSalary: newSalary,
            lastIncrementDate: effectiveDate,
            nextIncrementDate: computeNextIncrementDate({
              hireDate: employee.hireDate,
              lastIncrementDate: effectiveDate,
            }),
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/dashboard");
    revalidatePath("/increments");
    redirect(`/increments/${record.id}`);
  } catch (e) {
    if ((e as { digest?: string } | null)?.digest?.toString().startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    return { error: (e as Error).message };
  }
  return INIT;
}
