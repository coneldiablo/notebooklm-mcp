#!/usr/bin/env node
// Live MCP smoke test. Run only against a notebook intended for testing.
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const notebookUrl = process.env.SMOKE_NOTEBOOK_URL;
assert.ok(notebookUrl, "Set SMOKE_NOTEBOOK_URL to a test notebook URL");
const addSource = process.env.SMOKE_ADD_SOURCE === "true";
const client = new Client({ name: "notebooklm-live-smoke", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [new URL("../dist/index.js", import.meta.url).pathname],
});

async function call(name, args = {}, timeout = 120_000) {
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout });
  const payload = JSON.parse(response.content.find((item) => item.type === "text")?.text ?? "{}");
  assert.equal(payload.success, true, `${name}: ${payload.error ?? "failed"}`);
  return payload.data;
}

try {
  await client.connect(transport);
  let auth = await call("get_auth_status");
  if (!auth.authenticated) {
    const started = await call("setup_auth");
    assert.equal(started.status, "in_progress");
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      auth = await call("get_auth_status");
      if (auth.status !== "in_progress") break;
    }
  }
  assert.equal(auth.authenticated, true, `Authentication ended with ${auth.status}`);
  const health = await call("get_health");
  assert.equal(health.authenticated, true);

  const discovery = await call("search_remote_notebooks");
  assert.ok(
    discovery.notebooks.some((item) => item.url === notebookUrl),
    "Test notebook missing from remote search"
  );
  const testNotebook = discovery.notebooks.find((item) => item.url === notebookUrl);
  const filtered = await call("search_remote_notebooks", { query: testNotebook.title });
  assert.ok(filtered.notebooks.some((item) => item.id === testNotebook.id));

  let sourceResult = null;
  if (addSource) {
    const marker = `MCP-LIVE-${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
    const added = await call("add_source", {
      type: "text",
      title: `MCP live smoke ${marker}`,
      content: `This is a disposable MCP integration test source. Verification marker: ${marker}.`,
      notebook_url: notebookUrl,
    });
    sourceResult = added.result;
    assert.equal(sourceResult.success, true, sourceResult.message);
    assert.ok(sourceResult.sourceCountAfter > sourceResult.sourceCountBefore);
  }

  let answer;
  for (const question of [
    "According to the Gemini Notebook Help source, how can I add or discover sources? Cite the source.",
    "What does the source titled 'Add or discover new sources for your notebook' say about adding sources? Include a source citation.",
  ]) {
    answer = await call("ask_question", {
      notebook_url: notebookUrl,
      question,
      source_format: "json",
      ...(answer?.session_id && { session_id: answer.session_id }),
    });
    assert.equal(answer.status, "success");
    assert.ok(answer.answer?.trim(), "Answer is empty");
    if (answer.sources?.length) break;
  }
  assert.ok(answer.sources?.length > 0, "No structured citations returned");
  assert.ok(answer.sources.every((source) => source.sourceName && source.sourceText));

  console.log(
    JSON.stringify(
      {
        authenticated: true,
        remote_notebooks: discovery.total,
        test_notebook_found: true,
        source_added: sourceResult
          ? sourceResult.sourceCountAfter > sourceResult.sourceCountBefore
          : "skipped",
        answer_received: true,
        citation_count: answer.sources.length,
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
