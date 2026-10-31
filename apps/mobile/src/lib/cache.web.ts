export async function localGet<Value>(key: string): Promise<Value | null> {
  try {
    const value = sessionStorage.getItem("agristock:" + key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
export async function localSet(key: string, value: unknown) {
  sessionStorage.setItem("agristock:" + key, JSON.stringify(value));
}
export async function localRemove(key: string) {
  sessionStorage.removeItem("agristock:" + key);
}
export async function clearUserCache(prefix: string) {
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith("agristock:" + prefix))
    .forEach((key) => sessionStorage.removeItem(key));
}
