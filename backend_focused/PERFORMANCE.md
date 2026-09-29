# Large vehicle history: local verification

Measured on September 29, 2026 using the existing SQLite performance seed. These are individual local observations, not an SLA, production load test, or statistically representative benchmark. The challenge requires hundreds of records; 100,000 is an additional stress scenario.

## Endpoint memory and serialization

Each measurement ran the detail view in a fresh Python process inside the existing Docker backend, using DRF `APIRequestFactory`, `DEBUG=false`, and SQL logging disabled. `CaptureQueriesContext` covered the entire rendered/streamed body. The process had a 768 MiB address-space limit and, for the streaming runs, a 30-second alarm. The body was consumed without accumulating it in the measuring caller. Peak RSS is the entire Python process, including Django startup, measured with Linux `resource.getrusage`; it is not Docker-wide memory or a per-request allocation delta.

| Records | Buffered time before | Buffered peak RSS before | Streamed time after | Streamed peak RSS after | SQL queries after |
| --- | --- | --- | --- | --- | --- |
| 1,000 | 0.079 s | 59.1 MiB | 0.060 s | 63.2 MiB | 2 |
| 10,000 | 0.581 s | 86.4 MiB | 0.434 s | 63.6 MiB | 2 |
| 50,000 | Not rerun | Not rerun | 5.470 s | 65.1 MiB | 2 |
| 100,000 | Not rerun | Not rerun | 4.806 s | 66.7 MiB | 2 |

The earlier buffered endpoint was observed in an OOM-killed container after overlapping 100,000-record requests. That unsafe load was not repeated for a before measurement. Timing varied with other local work, so the 50,000/100,000 observations must not be interpreted as a scaling trend. First streamed chunks were available in 4–9 ms in these isolated runs.

## Real HTTP verification

One request at a time was sent through the running development API. Each complete JSON response was parsed and checked for the exact history count and descending date/ID order. Times include local HTTP download and parsing in the Node caller; they exclude browser rendering.

| Records | Status | Complete JSON received and parsed |
| --- | --- | --- |
| 1,000 | 200 | 0.295 s |
| 10,000 | 200 | 0.854 s |
| 50,000 | 200 | 3.029 s |
| 100,000 | 200 | 5.534 s |

The 100,000-record JSON is still 44,244,374 bytes (about 42.2 MiB) before compression. This change preserves fields rather than reducing the payload. No extra RAM, database migration, data reset, or caching layer was required.

## Browser verification

A production frontend build was opened in Chromium against the real development API. Each dataset used a fresh browser context, with requests run sequentially. The times below include navigation, download, JSON parsing, and rendering until the complete-history count became visible.

| Records | Navigation to visible history | API requests | Mounted data rows at top / end |
| --- | --- | --- | --- |
| 1,000 | 0.663 s | 1 | 8 / 8 |
| 10,000 | 0.915 s | 1 | 8 / 8 |
| 50,000 | 2.959 s | 1 | 8 / 8 |
| 100,000 | 5.452 s | 1 | 8 / 8 |

The final record was reached for all four volumes without another request or a JavaScript error. The real 100,000-record dataset was also checked at a 390 px mobile viewport: the last notes cell remained reachable through the table's internal horizontal scroll, with no page-wide overflow. Mounted row counts depend on viewport and content height; eight is an observation, not a fixed limit.

## Regression coverage and limits

Backend tests verify the full streamed contract, date/ID ordering, Unicode/escaping, decimal/date formats, empty history, permission/404/error handling before streaming, iteration in bounded chunks, cursor closure, and a constant query count while consuming the complete stream. The TypeScript API schema is regenerated without a contract change.

Browser regression tests exercise 500 and 100,000 mocked records, complete first/last-row content including multiline notes, bounded DOM size, row count/index semantics, keyboard scrolling, mobile overflow, empty history, and recovery from truncated JSON without automatic retry. Desktop/mobile screenshots at both ends of the virtualized history were inspected.

Final checks passed: 87 backend tests (plus 14 subtests), all 27 frontend end-to-end tests, TypeScript, ESLint, Prettier, and the production build. The real database remained at 21 offices, 31 mechanics, 104 vehicles, and 181,000 maintenance records after test-fixture cleanup.

Streaming does not make the current Axios JSON parser incremental. The complete response still resides in browser memory. Virtualization bounds mounted table rows, not the downloaded dataset; browser Find searches mounted rows only. A failed stream cannot change its HTTP status after headers were sent, so truncated JSON must be treated as an error. Slow clients occupy the current WSGI worker/thread until the response completes; concurrent load and mobile/network limits still require separate testing.
