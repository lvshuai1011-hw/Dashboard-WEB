import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource } from './load-source.mjs';
const { createSseParser, chatStream } = await loadSource(
  `export { createSseParser, chatStream } from './src/views/ux/aiAgent/lib/sse'`,
  {
    plugins: [
      {
        name: 'login-store-fixture',
        setup(build) {
          build.onResolve({ filter: /^~\/store$/ }, () => ({
            path: 'store',
            namespace: 'fixture',
          }));
          build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: 'export const useLoginStore = () => ({ getCsrfWebToken: "fixture" });',
          }));
        },
      },
    ],
  },
);
const frame = (event, ending = '\n') =>
  `data:${JSON.stringify({ event: 'ExecuteAgentNormal', data: JSON.stringify({ event, content: '中文' }) })}${ending}${ending}`;

test('SSE parser accepts every split point for LF, CRLF and CR', () => {
  for (const ending of ['\n', '\r\n', '\r']) {
    const text = frame('finish_stop', ending);
    for (let split = 0; split <= text.length; split++) {
      const events = [];
      const parse = createSseParser((event) => events.push(event));
      parse(text.slice(0, split));
      parse(text.slice(split), true);
      assert.equal(events.length, 1);
      assert.equal(events[0].content, '中文');
    }
  }
});

test('SSE parser drops malformed JSON and unterminated final frames', () => {
  const events = [];
  const parse = createSseParser((event) => events.push(event));
  parse('data:broken\n\n');
  parse(frame('done').trimEnd(), true);
  assert.deepEqual(events, []);
});

test('transport distinguishes expected completion, premature EOF and HTTP errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [body, status, expected] of [
      [frame('done'), 200, 'complete'],
      [frame('answer'), 200, 'UNEXPECTED_EOF'],
      ['', 403, 'HTTP_ERROR'],
    ]) {
      globalThis.fetch = async () =>
        new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
      const result = await new Promise((resolve) =>
        chatStream(
          {},
          () => {},
          (error) => resolve(error.message),
          () => resolve('complete'),
        ),
      );
      assert.equal(result, expected);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cancelling before response headers suppresses callbacks', async () => {
  const originalFetch = globalThis.fetch;
  let resolveResponse;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      resolveResponse = resolve;
    });
  const calls = [];
  try {
    const abort = chatStream(
      {},
      () => calls.push('event'),
      () => calls.push('error'),
      () => calls.push('complete'),
    );
    abort();
    resolveResponse(
      new Response(frame('done'), { headers: { 'content-type': 'text/event-stream' } }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
