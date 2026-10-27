import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../web/src/features/chat/markdown.js";

test("renders the markdown subset models emit without passing HTML through", () => {
  const html = renderToStaticMarkup(createElement(Markdown, { text: "Hai **3 cronjob**:\n\n- uno `x`\n- due\n\n```\ncode <b>\n```\n<img src=x onerror=1>" }));
  assert.match(html, /<strong>3 cronjob<\/strong>/);
  assert.match(html, /<ul[^>]*><li>uno <code[^>]*>x<\/code><\/li><li>due<\/li><\/ul>/);
  assert.match(html, /<pre[^>]*>code &lt;b&gt;<\/pre>/);
  assert.match(html, /&lt;img src=x onerror=1&gt;/);
});

test("renders README tables and only http links", () => {
  const html = renderToStaticMarkup(createElement(Markdown, { document: true, text: "## Setup\n\n| Key | Value |\n| --- | --- |\n| a | `b` |\n\n[docs](https://x.dev) [bad](javascript:alert(1)) ![logo](logo.png)" }));
  assert.match(html, /<th[^>]*>Key<\/th>/);
  assert.match(html, /<td[^>]*><code[^>]*>b<\/code><\/td>/);
  assert.doesNotMatch(html, /---/);
  assert.match(html, /<a href="https:\/\/x.dev"[^>]*>docs<\/a>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /logo/);
  assert.match(html, /text-lg[^>]*>Setup/);
});
