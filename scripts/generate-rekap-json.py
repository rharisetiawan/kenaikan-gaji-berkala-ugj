#!/usr/bin/env python3
"""
Convert the legacy "REKAP BERKALA DIEDIT 2019 April.xlsx" workbook into a
clean JSON file consumable by `prisma/import-rekap-berkala.ts`.

Input:  path to the .xlsx (arg 1; defaults to ~/attachments/...)
Output: prisma/data/rekap-berkala-2019.json

Authoritative sheet:    "Data Karyawan (FINAL)"
Dedup rule:             one row per unique fullName (the latest cycle by
                        tgl_kenaikan).
NIS generation:         auto-synthesized "YY2095NNN" (YY = 2-digit TMT year,
                        NNN = sequence) because the Excel has no NIS column.
Salary filter:          rows where Gaji Baru is #NUM! / #REF! are kept but
                        fall back to 0 (the importer will skip them).

Requires: `pip install openpyxl`
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required: pip install openpyxl")


def to_iso(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


def slug(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[.,]+", "", s)
    s = re.sub(r"\s+", ".", s.strip())
    s = re.sub(r"[^a-z0-9.]", "", s)
    return s


def normalize_gol(g):
    if not g:
        return None
    m = re.match(r"^([IVX]+)[-/]?([a-zA-Z])$", str(g).strip())
    if not m:
        return str(g)
    return f"{m.group(1)}/{m.group(2).lower()}"


def main() -> None:
    default_src = Path(
        "/home/ubuntu/attachments/08946970-2c92-44ff-8e6a-acf90ec4e3ec/"
        "REKAP+BERKALA+DIEDIT+2019+April.xlsx"
    )
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else default_src
    if not src.exists():
        sys.exit(f"Source not found: {src}")

    wb = openpyxl.load_workbook(src, data_only=True)
    ws = wb["Data Karyawan (FINAL)"]
    rows = list(ws.iter_rows(values_only=True))

    by_name = defaultdict(list)
    for i, row in enumerate(rows):
        if i < 3 or not row[1]:
            continue
        name = str(row[1]).strip()
        by_name[name].append(
            {
                "tmt_sk": to_iso(row[2]),
                "status": row[8],
                "sk_nomor": row[9],
                "gaji_terakhir": row[14],
                "tgl_terakhir": to_iso(row[15]),
                "golongan": row[16],
                "gaji_baru": row[17],
                "tgl_kenaikan": to_iso(row[18]),
            }
        )

    out = []
    seq = 1
    for name, entries in by_name.items():
        latest = max(
            entries,
            key=lambda e: (e["tgl_kenaikan"] or "") + (e["tgl_terakhir"] or ""),
        )
        tmt = latest["tmt_sk"] or latest["tgl_terakhir"]
        if not tmt:
            continue
        year2 = tmt[2:4]
        nis = f"{year2}2095{seq:03d}"
        seq += 1
        gaji_baru = latest["gaji_baru"] if isinstance(latest["gaji_baru"], (int, float)) else None
        gaji_terakhir = (
            latest["gaji_terakhir"] if isinstance(latest["gaji_terakhir"], (int, float)) else None
        )
        out.append(
            {
                "fullName": name,
                "nis": nis,
                "email": f"{slug(name)}@unigamalang.ac.id",
                "hireDate": latest["tmt_sk"],
                "golongan": normalize_gol(latest["golongan"]),
                "currentBaseSalary": gaji_baru,
                "previousBaseSalary": gaji_terakhir,
                "lastIncrementDate": latest["tgl_kenaikan"],
                "skNomor": latest["sk_nomor"],
                "status": latest["status"],
            }
        )

    out.sort(key=lambda e: e["lastIncrementDate"] or "")

    out_path = Path(__file__).resolve().parent.parent / "prisma" / "data" / "rekap-berkala-2019.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(out)} employees to {out_path}")


if __name__ == "__main__":
    main()
