// Core business logic for Kenaikan Gaji Berkala (KGB) eligibility.
//
// The rules encoded here intentionally mirror common university HR practice.
// They can be tuned without touching UI or storage layers.

import type {
  BkdEvaluation,
  Employee,
  PerformanceScore,
  DosenDetail,
  StaffDetail,
  PayGrade,
  AcademicRank,
} from "@prisma/client";

export const INCREMENT_INTERVAL_YEARS = 2;
export const INCREMENT_PERCENT = 0.03; // 3% of current base salary per periodic increment

// Minimum evaluations a Dosen must have passed (over the latest 2 semesters).
export const DOSEN_REQUIRED_BKD_PASSES = 2;

/**
 * Sort BKD evaluations newest-first (by academicYear desc, then semester desc).
 * Semester values like "GANJIL"/"GENAP" sort lexicographically — GENAP > GANJIL.
 */
export function sortBkdNewestFirst(evals: BkdEvaluation[]): BkdEvaluation[] {
  return [...evals].sort((a, b) => {
    if (a.academicYear !== b.academicYear) return a.academicYear < b.academicYear ? 1 : -1;
    return a.semester < b.semester ? 1 : -1;
  });
}

/**
 * Returns true iff the Dosen has `DOSEN_REQUIRED_BKD_PASSES` most-recent
 * evaluations and all of them are PASS.
 */
export function dosenHasRecentBkdPasses(evals: BkdEvaluation[]): boolean {
  const latest = sortBkdNewestFirst(evals).slice(0, DOSEN_REQUIRED_BKD_PASSES);
  return (
    latest.length === DOSEN_REQUIRED_BKD_PASSES &&
    latest.every((b) => b.status === "PASS")
  );
}

// Minimum performance score (0-100) a Staff must hit on the last annual review.
export const STAFF_MIN_PERFORMANCE_SCORE = 76;

export type EligibilityStatus = "ELIGIBLE" | "NOT_YET" | "BLOCKED" | "INSUFFICIENT_DATA";

export interface EligibilityResult {
  status: EligibilityStatus;
  // Human-readable Indonesian reason list, suitable for showing in the UI.
  reasons: string[];
  projectedEffectiveDate: Date;
  projectedNewSalary: number;
  incrementAmount: number;
}

export type EmployeeWithDetails = Employee & {
  dosenDetail:
    | (DosenDetail & { academicRank: AcademicRank })
    | null;
  staffDetail: (StaffDetail & { payGrade: PayGrade }) | null;
  bkdEvaluations: BkdEvaluation[];
  performanceScores: PerformanceScore[];
};

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Next scheduled KGB date = (lastIncrementDate ?? hireDate) + 2 years. */
export function computeNextIncrementDate(employee: Pick<Employee, "hireDate" | "lastIncrementDate">): Date {
  const base = employee.lastIncrementDate ?? employee.hireDate;
  return addYears(base, INCREMENT_INTERVAL_YEARS);
}

export function computeIncrementAmount(currentBaseSalary: number): number {
  // Round to nearest 100 IDR to match payroll policy.
  const raw = currentBaseSalary * INCREMENT_PERCENT;
  return Math.round(raw / 100) * 100;
}

/**
 * Given a current golongan code like "II/c", return the next KGB golongan:
 *   - II/a → II/b, II/b → II/c, II/c → II/d
 *   - II/d → II/d (mentok — a KGB within-golongan does not bump the roman;
 *     cross-roman promotion (II → III) requires a separate "kenaikan pangkat"
 *     process based on a new academic degree and is out of scope for this
 *     automatic periodic-increment flow.)
 * Accepts either "II/c" (canonical) or "II-C" (legacy) and returns the canonical form.
 */
export function computeNextGolongan(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = code.trim().match(/^([IVX]+)[\/-]?([a-dA-D])$/);
  if (!m) return code;
  const roman = m[1].toUpperCase();
  const letter = m[2].toLowerCase();
  if (letter === "d") return `${roman}/d`;
  const next = String.fromCharCode(letter.charCodeAt(0) + 1);
  return `${roman}/${next}`;
}

export function evaluateEligibility(
  employee: EmployeeWithDetails,
  today: Date = new Date(),
): EligibilityResult {
  const projectedEffectiveDate = computeNextIncrementDate(employee);
  const incrementAmount = computeIncrementAmount(employee.currentBaseSalary);
  const projectedNewSalary = employee.currentBaseSalary + incrementAmount;

  const reasons: string[] = [];

  if (employee.status !== "ACTIVE") {
    reasons.push(`Status pegawai bukan aktif (${employee.status}).`);
    return { status: "BLOCKED", reasons, projectedEffectiveDate, projectedNewSalary, incrementAmount };
  }

  if (employee.employmentStatus !== "TETAP") {
    reasons.push(
      `Kenaikan Gaji Berkala hanya untuk pegawai tetap. Status saat ini: ${employee.employmentStatus}.`,
    );
    return { status: "BLOCKED", reasons, projectedEffectiveDate, projectedNewSalary, incrementAmount };
  }

  if (employee.type === "DOSEN") {
    const detail = employee.dosenDetail;
    if (!detail) {
      reasons.push("Data detail dosen belum lengkap.");
      return {
        status: "INSUFFICIENT_DATA",
        reasons,
        projectedEffectiveDate,
        projectedNewSalary,
        incrementAmount,
      };
    }

    const sortedBkd = [...employee.bkdEvaluations].sort((a, b) => {
      if (a.academicYear !== b.academicYear) return a.academicYear < b.academicYear ? 1 : -1;
      // GANJIL comes after GENAP of the same academic year in practice
      return a.semester < b.semester ? 1 : -1;
    });
    const latest = sortedBkd.slice(0, DOSEN_REQUIRED_BKD_PASSES);

    if (latest.length < DOSEN_REQUIRED_BKD_PASSES) {
      reasons.push(
        `Data BKD belum mencukupi (diperlukan ${DOSEN_REQUIRED_BKD_PASSES} semester terakhir, tersedia ${latest.length}).`,
      );
    }

    const allPassed = latest.length === DOSEN_REQUIRED_BKD_PASSES && latest.every((b) => b.status === "PASS");
    if (latest.length === DOSEN_REQUIRED_BKD_PASSES && !allPassed) {
      const failing = latest.filter((b) => b.status !== "PASS");
      reasons.push(
        `BKD belum lulus pada semester: ${failing
          .map((b) => `${b.semester} ${b.academicYear}`)
          .join(", ")}.`,
      );
    } else if (allPassed) {
      reasons.push(`BKD ${DOSEN_REQUIRED_BKD_PASSES} semester terakhir: LULUS.`);
    }

    reasons.push(
      `Jabatan akademik saat ini: ${detail.academicRank.name}.`,
    );
  } else {
    const detail = employee.staffDetail;
    if (!detail) {
      reasons.push("Data detail tenaga kependidikan belum lengkap.");
      return {
        status: "INSUFFICIENT_DATA",
        reasons,
        projectedEffectiveDate,
        projectedNewSalary,
        incrementAmount,
      };
    }

    const latestScore = [...employee.performanceScores].sort((a, b) => b.year - a.year)[0];
    if (!latestScore) {
      reasons.push("Belum ada data penilaian kinerja tahunan.");
    } else if (latestScore.score < STAFF_MIN_PERFORMANCE_SCORE) {
      reasons.push(
        `Nilai kinerja tahun ${latestScore.year} (${latestScore.score.toFixed(2)}) di bawah ambang ${STAFF_MIN_PERFORMANCE_SCORE}.`,
      );
    } else {
      reasons.push(
        `Nilai kinerja tahun ${latestScore.year}: ${latestScore.score.toFixed(2)} (${humanRating(latestScore.rating)}).`,
      );
    }

    reasons.push(`Golongan saat ini: ${detail.payGrade.code} - ${detail.payGrade.name}.`);
  }

  const msInDay = 1000 * 60 * 60 * 24;
  const daysUntil = Math.ceil((projectedEffectiveDate.getTime() - today.getTime()) / msInDay);
  if (daysUntil > 90) {
    reasons.unshift(
      `Belum saatnya kenaikan: TMT proyeksi ${projectedEffectiveDate.toISOString().slice(0, 10)} (${daysUntil} hari lagi).`,
    );
    return { status: "NOT_YET", reasons, projectedEffectiveDate, projectedNewSalary, incrementAmount };
  }

  // Within 3 months window (including overdue).
  if (employee.type === "DOSEN") {
    const sortedBkd = [...employee.bkdEvaluations].sort((a, b) => {
      if (a.academicYear !== b.academicYear) return a.academicYear < b.academicYear ? 1 : -1;
      return a.semester < b.semester ? 1 : -1;
    });
    const latest = sortedBkd.slice(0, DOSEN_REQUIRED_BKD_PASSES);
    const allPassed = latest.length === DOSEN_REQUIRED_BKD_PASSES && latest.every((b) => b.status === "PASS");
    if (!allPassed) {
      return { status: "BLOCKED", reasons, projectedEffectiveDate, projectedNewSalary, incrementAmount };
    }
  } else {
    const latestScore = [...employee.performanceScores].sort((a, b) => b.year - a.year)[0];
    if (!latestScore || latestScore.score < STAFF_MIN_PERFORMANCE_SCORE) {
      return { status: "BLOCKED", reasons, projectedEffectiveDate, projectedNewSalary, incrementAmount };
    }
  }

  if (daysUntil < 0) {
    reasons.unshift(`Sudah melewati TMT (${Math.abs(daysUntil)} hari).`);
  } else {
    reasons.unshift(`Siap naik gaji dalam ${daysUntil} hari (TMT ${projectedEffectiveDate.toISOString().slice(0, 10)}).`);
  }
  return { status: "ELIGIBLE", reasons, projectedEffectiveDate, projectedNewSalary, incrementAmount };
}

export function humanRating(rating: PerformanceScore["rating"]): string {
  switch (rating) {
    case "EXCELLENT":
      return "Sangat Baik";
    case "GOOD":
      return "Baik";
    case "SUFFICIENT":
      return "Cukup";
    case "POOR":
      return "Kurang";
    case "VERY_POOR":
      return "Sangat Kurang";
  }
}

export function humanEligibilityStatus(status: EligibilityStatus): string {
  switch (status) {
    case "ELIGIBLE":
      return "Memenuhi Syarat";
    case "NOT_YET":
      return "Belum Waktunya";
    case "BLOCKED":
      return "Terkendala Syarat";
    case "INSUFFICIENT_DATA":
      return "Data Belum Lengkap";
  }
}
