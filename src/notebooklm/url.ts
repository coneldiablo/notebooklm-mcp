/** URLs for the personal Gemini Notebook app (formerly NotebookLM). */
export const GEMINI_NOTEBOOK_ORIGIN = "https://notebook.google.com";

const APP_HOSTS = new Set(["notebook.google.com", "notebooklm.google.com"]);

export function isNotebookAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      APP_HOSTS.has(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname !== "/login" &&
      !url.pathname.startsWith("/login/")
    );
  } catch {
    return false;
  }
}

/** Accept existing NotebookLM links and navigate through the current origin. */
export function normalizeNotebookUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Notebook URL must be a valid HTTPS URL");
  }

  if (
    url.protocol !== "https:" ||
    !APP_HOSTS.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/notebook\/[a-f0-9-]{8,}\/?$/i.test(url.pathname)
  ) {
    throw new Error("Notebook URL must point to a personal Gemini Notebook notebook");
  }

  url.hostname = "notebook.google.com";
  url.hash = "";
  return url.toString();
}
