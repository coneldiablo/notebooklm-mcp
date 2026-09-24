import assert from "node:assert/strict";
import test from "node:test";
import { ToolHandlers } from "../src/tools/handlers.js";
import type { SessionManager } from "../src/session/session-manager.js";
import type { AuthManager } from "../src/auth/auth-manager.js";
import type { NotebookLibrary } from "../src/library/notebook-library.js";

test("setup_auth returns while login is pending and exposes the same operation to polls", async () => {
  let finishLogin!: (success: boolean) => void;
  let setupCalls = 0;
  const auth = {
    getValidStatePath: async () => (setupCalls > 0 && finished ? "/state.json" : null),
    performSetup: async () => {
      setupCalls++;
      return new Promise<boolean>((resolve) => {
        finishLogin = resolve;
      });
    },
  } as unknown as AuthManager;
  let finished = false;
  const sessions = { closeAllSessions: async () => undefined } as unknown as SessionManager;
  const handler = new ToolHandlers(sessions, auth, {} as NotebookLibrary);

  const started = await handler.handleSetupAuth({});
  assert.equal(started.data?.status, "in_progress");
  assert.ok(started.data?.operation_id);
  assert.equal((await handler.handleGetAuthStatus()).data?.status, "in_progress");
  const duplicate = await handler.handleSetupAuth({});
  assert.equal(duplicate.data?.operation_id, started.data?.operation_id);
  assert.equal(setupCalls, 1);

  finished = true;
  finishLogin(true);
  await new Promise((resolve) => setImmediate(resolve));
  const done = await handler.handleGetAuthStatus();
  assert.equal(done.data?.status, "authenticated");
  assert.equal(done.data?.operation_id, started.data?.operation_id);
  assert.ok(done.data?.completed_at);
});

test("setup_auth does not clear a valid existing login", async () => {
  let setupCalls = 0;
  const auth = {
    getValidStatePath: async () => "/state.json",
    performSetup: async () => {
      setupCalls++;
      return true;
    },
  } as unknown as AuthManager;
  const handler = new ToolHandlers({} as SessionManager, auth, {} as NotebookLibrary);
  assert.equal((await handler.handleSetupAuth({})).data?.status, "authenticated");
  assert.equal(setupCalls, 0);
});

test("get_auth_status reports a failed login without rejecting the background task", async () => {
  const auth = {
    getValidStatePath: async () => null,
    performSetup: async () => false,
  } as unknown as AuthManager;
  const sessions = { closeAllSessions: async () => undefined } as unknown as SessionManager;
  const handler = new ToolHandlers(sessions, auth, {} as NotebookLibrary);
  assert.equal((await handler.handleSetupAuth({})).data?.status, "in_progress");
  await new Promise((resolve) => setImmediate(resolve));
  const result = await handler.handleGetAuthStatus();
  assert.equal(result.data?.status, "failed");
  assert.match(result.data?.error ?? "", /failed or was cancelled/);
});
