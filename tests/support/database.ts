export function localTestUrl(key: string): string {
  const value = process.env[key];
  let url: URL;
  try {
    url = new URL(value!);
  } catch {
    throw new Error(`${key} is required for owned local tests`);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/clientelo_native_test"
  ) throw new Error("Only the owned loopback clientelo_native_test fixture is allowed");
  return value!;
}
