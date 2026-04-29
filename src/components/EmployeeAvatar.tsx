/**
 * Render an employee's profile photo when available, or a deterministic
 * initial-letter fallback when not. Uses /api/employee-photo/[id] which
 * streams Drive bytes through the service account; the route enforces
 * auth and content-type sanitization.
 */
export interface EmployeeAvatarProps {
  employeeId: string;
  fullName: string;
  hasPhoto: boolean;
  size?: number;
  className?: string;
}

const PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

function pickPalette(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function EmployeeAvatar({
  employeeId,
  fullName,
  hasPhoto,
  size = 40,
  className = "",
}: EmployeeAvatarProps) {
  const dim = `${size}px`;
  if (hasPhoto) {
    // Plain <img> rather than next/image so we don't have to add the
    // /api/employee-photo route to next.config images.remotePatterns.
    // Cache-Control on the route gates re-fetch; new uploads bust it via
    // revalidatePath on /employees and /profile.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/employee-photo/${employeeId}`}
        alt={fullName}
        width={size}
        height={size}
        loading="lazy"
        className={`rounded-full border border-slate-200 object-cover ${className}`}
        style={{ width: dim, height: dim }}
      />
    );
  }
  const palette = pickPalette(employeeId);
  const initials = initialsOf(fullName);
  return (
    <div
      aria-label={fullName}
      title={fullName}
      className={`flex items-center justify-center rounded-full border border-slate-200 font-semibold ${palette} ${className}`}
      style={{
        width: dim,
        height: dim,
        fontSize: `${Math.max(10, Math.floor(size * 0.4))}px`,
      }}
    >
      {initials}
    </div>
  );
}
