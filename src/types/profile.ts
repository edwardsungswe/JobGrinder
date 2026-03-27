import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1),
  summary: z.string().min(1),
  targetTitles: z.array(z.string().min(1)).default([]),
  includeKeywords: z.array(z.string().min(1)).default([]),
  excludeKeywords: z.array(z.string().min(1)).default([]),
  seniority: z.array(z.string().min(1)).default([]),
  locations: z.object({
    allowed: z.array(z.string().min(1)).default([]),
    remoteOnly: z.boolean().default(false),
  }),
  compensation: z.object({
    minimumBaseUsd: z.number().int().nonnegative().nullable().default(null),
    minimumHourlyUsd: z.number().nonnegative().nullable().default(null),
    reputableCompaniesOnMissingCompensation: z.array(z.string().min(1)).default([]),
  }),
  preferences: z.object({
    employmentTypes: z.object({
      include: z.array(z.string().min(1)).default([]),
      exclude: z.array(z.string().min(1)).default([]),
    }),
    excludedCompanies: z.array(z.string().min(1)).default([]),
    weightingHints: z.array(z.string().min(1)).default([]),
  }),
});

export type Profile = z.infer<typeof profileSchema>;
