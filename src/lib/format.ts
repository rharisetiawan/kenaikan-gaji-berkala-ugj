// Indonesian-locale formatting helpers.

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function formatDateID(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatLongDateID(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatMonthYearID(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const rounded = Math.round(value);
  const str = rounded.toLocaleString("id-ID");
  return `Rp ${str}`;
}

// Years of service, e.g. "5 tahun 3 bulan"
export function formatServiceLength(hireDate: Date | string, reference: Date = new Date()): string {
  const d = typeof hireDate === "string" ? new Date(hireDate) : hireDate;
  let years = reference.getFullYear() - d.getFullYear();
  let months = reference.getMonth() - d.getMonth();
  if (reference.getDate() < d.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "0 bulan";
  if (years === 0) return `${months} bulan`;
  return `${years} tahun ${months} bulan`;
}

// Angka menjadi kalimat (spell out integer in Indonesian).
// Used for the "Rp X (tertulis: ...)" line in the SK.
const UNITS_ID = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

function spellThreeDigits(n: number): string {
  let result = "";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 1) result += "seratus";
  else if (hundreds > 1) result += `${UNITS_ID[hundreds]} ratus`;
  if (rest > 0) {
    if (result) result += " ";
    if (rest < 12) {
      result += UNITS_ID[rest];
    } else if (rest < 20) {
      result += `${UNITS_ID[rest - 10]} belas`;
    } else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      result += `${UNITS_ID[tens]} puluh`;
      if (ones > 0) result += ` ${UNITS_ID[ones]}`;
    }
  }
  return result;
}

export function terbilang(value: number): string {
  if (value === 0) return "nol";
  if (value < 0) return `minus ${terbilang(-value)}`;
  const scales = [
    { divisor: 1_000_000_000_000, label: "triliun" },
    { divisor: 1_000_000_000, label: "miliar" },
    { divisor: 1_000_000, label: "juta" },
    { divisor: 1_000, label: "ribu" },
  ];
  let remaining = Math.round(value);
  const parts: string[] = [];
  for (const { divisor, label } of scales) {
    if (remaining >= divisor) {
      const count = Math.floor(remaining / divisor);
      remaining = remaining % divisor;
      if (label === "ribu" && count === 1) {
        parts.push("seribu");
      } else {
        parts.push(`${spellThreeDigits(count)} ${label}`);
      }
    }
  }
  if (remaining > 0) parts.push(spellThreeDigits(remaining));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function terbilangRupiah(value: number): string {
  return `${terbilang(value)} rupiah`;
}
