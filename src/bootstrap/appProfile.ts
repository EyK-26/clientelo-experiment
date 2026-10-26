export type AppProfile = "worksheet-qualification" | "worksheet-product";
export function appProfile(
  env: Record<string, string | undefined> = process.env,
): AppProfile {
  const profile = env.APP_PROFILE ?? "worksheet-product";
  if (
    profile !== "worksheet-qualification" &&
    profile !== "worksheet-product"
  )
    throw new Error("Unknown application profile");
  return profile;
}
