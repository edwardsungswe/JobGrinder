import type { ScoringJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";

export type PrefilterResult = {
  decision: "yes" | "maybe" | "no";
  reasons: string[];
};

function parseCompensation(text: string): { unit: "hourly" | "annual" | "unknown"; maxValue: number | null } {
  const normalized = text.toLowerCase().replace(/,/g, "");
  const values = [...normalized.matchAll(/\$?(\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  const maxValue = values.length > 0 ? Math.max(...values) : null;
  if (normalized.includes("/hr") || normalized.includes("hour")) {
    return { unit: "hourly", maxValue };
  }

  if (normalized.includes("/yr") || normalized.includes("/year") || normalized.includes("salary")) {
    return { unit: "annual", maxValue };
  }

  if (maxValue !== null) {
    if (maxValue >= 1_000) {
      return { unit: "annual", maxValue };
    }

    if (maxValue <= 500) {
      return { unit: "hourly", maxValue };
    }
  }

  return { unit: "unknown", maxValue };
}

function containsAny(haystack: string, needles: string[]): string[] {
  const lowered = haystack.toLowerCase();
  return needles.filter((needle) => lowered.includes(needle.toLowerCase()));
}

export function prefilterJob(job: ScoringJobRecord, profile: Profile): PrefilterResult {
  const cautionReasons: string[] = [];
  const positiveNotes: string[] = [];
  const haystack = [job.title, job.company, job.location, job.description, job.employmentType, job.seniority]
    .join(" ")
    .toLowerCase();

  const excludedCompany = profile.preferences.excludedCompanies.find((company) =>
    job.company.toLowerCase().includes(company.toLowerCase()),
  );
  if (excludedCompany) {
    return { decision: "no", reasons: [`Excluded company: ${excludedCompany}`] };
  }

  const bannedKeywordHits = containsAny(haystack, profile.excludeKeywords);
  if (bannedKeywordHits.length > 0) {
    return { decision: "no", reasons: [`Excluded keywords matched: ${bannedKeywordHits.join(", ")}`] };
  }

  if (profile.locations.remoteOnly && !haystack.includes("remote")) {
    return { decision: "no", reasons: ["Remote-only preference not satisfied"] };
  }

  if (profile.locations.allowed.length > 0) {
    const locationMatch = profile.locations.allowed.some((location) => haystack.includes(location.toLowerCase()));
    if (!locationMatch) {
      cautionReasons.push("Location not clearly in preferred list");
    }
  }

  const compensation = parseCompensation(job.compensationText);

  if (compensation.unit === "annual" && profile.compensation.minimumBaseUsd && compensation.maxValue !== null) {
    if (compensation.maxValue >= profile.compensation.minimumBaseUsd) {
      return {
        decision: "yes",
        reasons: [`Annual compensation meets minimum (${compensation.maxValue} >= ${profile.compensation.minimumBaseUsd})`],
      };
    }

    return {
      decision: "maybe",
      reasons: [`Annual compensation below minimum (${compensation.maxValue} < ${profile.compensation.minimumBaseUsd})`],
    };
  }

  if (compensation.unit === "hourly" && profile.compensation.minimumHourlyUsd && compensation.maxValue !== null) {
    if (compensation.maxValue >= profile.compensation.minimumHourlyUsd) {
      return {
        decision: "yes",
        reasons: [`Hourly compensation meets minimum (${compensation.maxValue} >= ${profile.compensation.minimumHourlyUsd})`],
      };
    }

    return {
      decision: "maybe",
      reasons: [`Hourly compensation below minimum (${compensation.maxValue} < ${profile.compensation.minimumHourlyUsd})`],
    };
  }

  if (job.compensationText === "" || job.compensationText.toLowerCase() === "n/a") {
    return {
      decision: "maybe",
      reasons: ["Compensation missing; let Ollama judge company quality and fit"],
    };
  }

  const includeEmploymentTypes = profile.preferences.employmentTypes.include;
  if (includeEmploymentTypes.length > 0 && !containsAny(job.employmentType, includeEmploymentTypes).length) {
    cautionReasons.push("Employment type not clearly preferred");
  }

  const excludedEmploymentTypes = containsAny(job.employmentType, profile.preferences.employmentTypes.exclude);
  if (excludedEmploymentTypes.length > 0) {
    return { decision: "no", reasons: [`Excluded employment type: ${excludedEmploymentTypes.join(", ")}`] };
  }

  const matchingTitles = containsAny(job.title, profile.targetTitles);
  const matchingKeywords = containsAny(haystack, profile.includeKeywords);
  const matchingSeniority = containsAny(job.seniority, profile.seniority);

  if (matchingTitles.length > 0 || matchingKeywords.length >= 2 || matchingSeniority.length > 0) {
    return {
      decision: cautionReasons.length === 0 ? "yes" : "maybe",
      reasons:
        positiveNotes.length > 0
          ? [...positiveNotes, ...cautionReasons]
          : cautionReasons.length > 0
            ? cautionReasons
            : ["Passed deterministic filters"],
    };
  }

  return {
    decision: "maybe",
    reasons: [...positiveNotes, ...(cautionReasons.length > 0 ? cautionReasons : ["Needs model review"])],
  };
}
