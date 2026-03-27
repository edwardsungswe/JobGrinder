import { z } from "zod";

export const jobRecordSchema = z.object({
  sourceRowNumber: z.number().int().positive(),
  raw: z.record(z.string(), z.string()),
});

export const normalizedJobRecordSchema = z.object({
  "Position Title": z.string(),
  Date: z.string(),
  Apply: z.string(),
  "Work Model": z.string(),
  Location: z.string(),
  Company: z.string(),
  Salary: z.string(),
  "Hire Time": z.string(),
  "Graduate Time": z.string(),
  "Company Industry": z.string(),
  "Company Size": z.string(),
  Qualifications: z.string(),
});

export const scoringJobRecordSchema = z.object({
  sourceRowNumber: z.number().int().positive(),
  sourceId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().default(""),
  url: z.string().url().optional(),
  description: z.string().default(""),
  workModel: z.string().default(""),
  employmentType: z.string().default(""),
  seniority: z.string().default(""),
  compensationText: z.string().default(""),
  compensationBaseUsd: z.number().nullable(),
  postedAt: z.string().optional(),
  fields: z.record(z.string(), z.string()),
});

export const deterministicDecisionSchema = z.enum(["yes", "maybe", "no"]);

export const filteredJobRecordSchema = normalizedJobRecordSchema.extend({
  keep: z.boolean(),
  rationale: z.string(),
  redFlags: z.array(z.string()),
  deterministicDecision: deterministicDecisionSchema,
  deterministicReasons: z.array(z.string()),
  provider: z.string(),
});

export type JobRecord = z.infer<typeof jobRecordSchema>;
export type NormalizedJobRecord = z.infer<typeof normalizedJobRecordSchema>;
export type ScoringJobRecord = z.infer<typeof scoringJobRecordSchema>;
export type FilteredJobRecord = z.infer<typeof filteredJobRecordSchema>;
