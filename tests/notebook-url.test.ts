import assert from "node:assert/strict";
import test from "node:test";
import { isNotebookAppUrl, normalizeNotebookUrl } from "../src/notebooklm/url.js";

const ID = "12345678-1234-1234-1234-123456789abc";

test("current and legacy notebook links resolve to the current origin", () => {
  assert.equal(
    normalizeNotebookUrl(`https://notebook.google.com/notebook/${ID}?authuser=1`),
    `https://notebook.google.com/notebook/${ID}?authuser=1`
  );
  assert.equal(
    normalizeNotebookUrl(`https://notebooklm.google.com/notebook/${ID}`),
    `https://notebook.google.com/notebook/${ID}`
  );
});

test("only personal Gemini Notebook URLs can become browser session targets", () => {
  for (const value of [
    "http://notebook.google.com/notebook/12345678",
    "https://notebook.google.com.evil.test/notebook/12345678",
    "https://notebook.google.com:8443/notebook/12345678",
    "https://notebook.google.com/login",
    "https://notebook.google.com/notebook/not-an-id",
    "https://example.com/notebook/12345678",
  ]) {
    assert.throws(() => normalizeNotebookUrl(value), value);
  }
});

test("login detection accepts the app but not its sign-in screen", () => {
  assert.equal(isNotebookAppUrl("https://notebook.google.com/"), true);
  assert.equal(isNotebookAppUrl(`https://notebooklm.google.com/notebook/${ID}`), true);
  assert.equal(isNotebookAppUrl("https://notebook.google.com/login?continue=%2F"), false);
  assert.equal(isNotebookAppUrl("https://accounts.google.com/v3/signin/identifier"), false);
  assert.equal(isNotebookAppUrl("https://notebook.google.com.evil.test/"), false);
});
