import { prisma } from "@/lib/prisma";
import {
  computeNextIncrementDate,
  evaluateEligibility,
  type EmployeeWithDetails,
  type EligibilityResult,
} from "@/lib/eligibility";
import { DEFAULT_KGB_RULES, type KgbRules } from "@/lib/app-settings";

export async function loadEmployeeWithDetails(id: string): Promise<EmployeeWithDetails | null> {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      dosenDetail: { include: { academicRank: true } },
      staffDetail: { include: { payGrade: true } },
      bkdEvaluations: true,
      performanceScores: true,
    },
  });
}

export async function loadAllEmployeesWithDetails(): Promise<EmployeeWithDetails[]> {
  return prisma.employee.findMany({
    orderBy: [{ type: "asc" }, { fullName: "asc" }],
    include: {
      dosenDetail: { include: { academicRank: true } },
      staffDetail: { include: { payGrade: true } },
      bkdEvaluations: true,
      performanceScores: true,
    },
  });
}

export interface EmployeeEvaluation {
  employee: EmployeeWithDetails;
  eligibility: EligibilityResult;
}

export function evaluateAll(
  employees: EmployeeWithDetails[],
  today: Date = new Date(),
  rules: KgbRules = DEFAULT_KGB_RULES,
): EmployeeEvaluation[] {
  return employees.map((employee) => ({
    employee,
    eligibility: evaluateEligibility(employee, today, rules),
  }));
}

export async function refreshNextIncrementDate(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return;
  const next = computeNextIncrementDate(employee);
  if (employee.nextIncrementDate.getTime() !== next.getTime()) {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { nextIncrementDate: next },
    });
  }
}
