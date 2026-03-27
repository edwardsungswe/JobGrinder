import type { ScoringJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";

export type PrefilterResult = {
  decision: "yes" | "maybe" | "no";
  reasons: string[];
};

function containsAny(haystack: string, needles: string[]): string[] {
  const lowered = haystack.toLowerCase();
  return needles.filter((needle) => lowered.includes(needle.toLowerCase()));
}

export function prefilterJob(job: ScoringJobRecord, profile: Profile): PrefilterResult {
  const reasons: string[] = [];
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
      reasons.push("Location not clearly in preferred list");
    }
  }

  if (profile.compensation.minimumBaseUsd && job.compensationBaseUsd && job.compensationBaseUsd < profile.compensation.minimumBaseUsd) {
    return {
      decision: "no",
      reasons: [`Compensation below minimum (${job.compensationBaseUsd} < ${profile.compensation.minimumBaseUsd})`],
    };
  }

  const includeEmploymentTypes = profile.preferences.employmentTypes.include;
  if (includeEmploymentTypes.length > 0 && !containsAny(job.employmentType, includeEmploymentTypes).length) {
    reasons.push("Employment type not clearly preferred");
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
      decision: reasons.length === 0 ? "yes" : "maybe",
      reasons: reasons.length > 0 ? reasons : ["Passed deterministic filters"],
    };
  }

  return { decision: "maybe", reasons: reasons.length > 0 ? reasons : ["Needs model review"] };
}
