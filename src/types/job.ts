import { z } from "zod";

export const recommendationSchema = z.enum(["yes", "maybe", "no"]);

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

export const scoredJobRecordSchema = scoringJobRecordSchema.extend({
  deterministicDecision: recommendationSchema,
  deterministicReasons: z.array(z.string()),
  score: z.number().min(0).max(100),
  rationale: z.string(),
  matchingFactors: z.array(z.string()),
  redFlags: z.array(z.string()),
  recommendation: recommendationSchema,
  provider: z.string(),
});

export type JobRecord = z.infer<typeof jobRecordSchema>;
export type NormalizedJobRecord = z.infer<typeof normalizedJobRecordSchema>;
export type ScoringJobRecord = z.infer<typeof scoringJobRecordSchema>;
export type ScoredJobRecord = z.infer<typeof scoredJobRecordSchema>;
