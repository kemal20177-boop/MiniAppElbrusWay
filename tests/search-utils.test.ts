import test from "node:test";
import assert from "node:assert/strict";
import { computeSearchScore, dedupeSearchSources, extractMainContent, stripHtml } from "../lib/search-utils.ts";

test("stripHtml removes markup noise", () => {
  assert.equal(stripHtml("<main><h1>Hello</h1><script>alert(1)</script><p>World</p></main>"), "Hello World");
});

test("extractMainContent prefers semantic containers", () => {
  const content = extractMainContent("<body><article><h1>Title</h1><p>Useful body</p></article><footer>ignore</footer></body>");
  assert.match(content, /Title Useful body/);
});

test("computeSearchScore prefers title matches and rich content", () => {
  const high = computeSearchScore("elbrus ai workspace", {
    title: "Elbrus AI Workspace",
    snippet: "platform",
    content: "Detailed content about workspace flows",
    domain: "example.com"
  });
  const low = computeSearchScore("elbrus ai workspace", {
    title: "Random page",
    snippet: "other",
    content: "",
    domain: "example.com"
  });
  assert.ok(high > low);
});

test("dedupeSearchSources removes near-duplicate results", () => {
  const deduped = dedupeSearchSources([
    { title: "A", url: "https://example.com/page", snippet: "same", domain: "example.com", content: "", score: 1 },
    { title: "A", url: "https://example.com/page/", snippet: "same", domain: "example.com", content: "", score: 2 }
  ]);
  assert.equal(deduped.length, 1);
});
