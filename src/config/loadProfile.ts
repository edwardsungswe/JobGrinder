import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { profileSchema, type Profile } from "../types/profile.js";

export async function loadProfile(cwd: string): Promise<Profile> {
  const profilePath = path.join(cwd, "config", "profile.yaml");
  let raw: string;

  try {
    raw = await readFile(profilePath, "utf8");
  } catch (error) {
    throw new Error(
      `Missing ${profilePath}. Copy config/profile.example.yaml to config/profile.yaml and fill in your private preferences.`,
      { cause: error },
    );
  }

  return profileSchema.parse(YAML.parse(raw));
}
