import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "data", "predictionpick.csv");

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        rows: [],
        headers: [],
        error: "predictionpick.csv not found — place it in public/data/predictionpick.csv",
      });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split(/\r?\n/);

    if (lines.length < 2) {
      return NextResponse.json({ rows: [], headers: [] });
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.trim());

    const rows = lines
      .slice(1)
      .filter((l) => l.trim())
      .map((line) => {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = (values[i] ?? "").trim();
        });
        return row;
      });

    return NextResponse.json({ rows, headers });
  } catch (err) {
    return NextResponse.json(
      { rows: [], headers: [], error: String(err) },
      { status: 500 }
    );
  }
}
