import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { profileSchema, type Profile } from "../types/profile.js";

export async function loadProfile(cwd: string): Promise<Profile> {
  const profilePath = path.join(cwd, "config", "profile.yaml");
  const raw = await readFile(profilePath, "utf8");
  return profileSchema.parse(YAML.parse(raw));
}
