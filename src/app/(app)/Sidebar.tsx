import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NAV_GROUPS, type IconName } from "./nav-config";
import { SidebarClient } from "./SidebarClient";

/**
 * Resolved (serializable) shape sent to the client. We strip `showIf`
 * predicates after evaluating them on the server.
 */
export interface ResolvedNavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface ResolvedNavGroup {
  id: string;
  label: string;
  icon: IconName;
  items: ResolvedNavItem[];
}

export async function Sidebar() {
  const user = await requireUser();

  let employmentStatus: string | null = null;
  if (user.role === "EMPLOYEE") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { employee: { select: { employmentStatus: true } } },
    });
    employmentStatus = dbUser?.employee?.employmentStatus ?? null;
  }

  const groups: ResolvedNavGroup[] = NAV_GROUPS.map((group) => {
    const items = group.items
      .filter((item) => item.roles.includes(user.role))
      .filter((item) => !item.showIf || item.showIf({ employmentStatus }))
      .map((item) => ({ href: item.href, label: item.label, icon: item.icon }));
    return {
      id: group.id,
      label: group.label,
      icon: group.icon,
      items,
    };
  }).filter((group) => group.items.length > 0);

  return <SidebarClient groups={groups} />;
}
