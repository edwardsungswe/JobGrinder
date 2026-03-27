import { createHash } from "node:crypto";
import {
  normalizedJobRecordSchema,
  scoringJobRecordSchema,
  type JobRecord,
  type NormalizedJobRecord,
  type ScoringJobRecord,
} from "../types/job.js";

const airtableColumns = [
  "Position Title",
  "Date",
  "Apply",
  "Work Model",
  "Location",
  "Company",
  "Salary",
  "Hire Time",
  "Graduate Time",
  "Company Industry",
  "Company Size",
  "Qualifications",
] as const;

function normalizeString(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getExactField(raw: Record<string, string>, key: (typeof airtableColumns)[number]): string {
  return normalizeString(raw[key] ?? "");
}

function parseCompensationBaseUsd(text: string): number | null {
  const normalized = text.replace(/,/g, "");
  const matches = normalized.match(/\$?(\d{2,6})/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const values = matches
    .map((match) => Number(match.replace(/\$/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 10_000);

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function createSourceId(input: { title: string; company: string; url: string; rowNumber: number }): string {
  const stableKey = `${input.url}|${input.company}|${input.title}|${input.rowNumber}`;
  return createHash("sha1").update(stableKey).digest("hex");
}

export function normalizeJobs(rows: JobRecord[]): NormalizedJobRecord[] {
  const seen = new Set<string>();
  const normalized: NormalizedJobRecord[] = [];

  for (const row of rows) {
    const normalizedRow = normalizedJobRecordSchema.parse({
      "Position Title": getExactField(row.raw, "Position Title"),
      Date: getExactField(row.raw, "Date"),
      Apply: getExactField(row.raw, "Apply"),
      "Work Model": getExactField(row.raw, "Work Model"),
      Location: getExactField(row.raw, "Location"),
      Company: getExactField(row.raw, "Company"),
      Salary: getExactField(row.raw, "Salary"),
      "Hire Time": getExactField(row.raw, "Hire Time"),
      "Graduate Time": getExactField(row.raw, "Graduate Time"),
      "Company Industry": getExactField(row.raw, "Company Industry"),
      "Company Size": getExactField(row.raw, "Company Size"),
      Qualifications: getExactField(row.raw, "Qualifications"),
    });

    const dedupeKey = `${normalizedRow.Apply}|${normalizedRow.Company.toLowerCase()}|${normalizedRow["Position Title"].toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    normalized.push(normalizedRow);
  }

  return normalized;
}

export function toScoringJobRecord(job: NormalizedJobRecord, sourceRowNumber = 0): ScoringJobRecord {
  return scoringJobRecordSchema.parse({
    sourceRowNumber,
    sourceId: createSourceId({
      title: job["Position Title"],
      company: job.Company,
      url: job.Apply,
      rowNumber: sourceRowNumber,
    }),
    title: job["Position Title"] || "Unknown Title",
    company: job.Company || "Unknown Company",
    location: job.Location,
    url: job.Apply.startsWith("http") ? job.Apply : undefined,
    description: job.Qualifications,
    workModel: job["Work Model"],
    employmentType: job["Hire Time"],
    seniority: "",
    compensationText: job.Salary,
    compensationBaseUsd: parseCompensationBaseUsd(job.Salary),
    postedAt: job.Date || undefined,
    fields: {
      "Position Title": job["Position Title"],
      Date: job.Date,
      Apply: job.Apply,
      "Work Model": job["Work Model"],
      Location: job.Location,
      Company: job.Company,
      Salary: job.Salary,
      "Hire Time": job["Hire Time"],
      "Graduate Time": job["Graduate Time"],
      "Company Industry": job["Company Industry"],
      "Company Size": job["Company Size"],
      Qualifications: job.Qualifications,
    },
  });
}
