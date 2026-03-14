# Performance Baseline

- Base URL: `http://127.0.0.1:3300`
- Iterations per target: `36`
- Concurrency: `6`
- Warmup requests per target: `6`

| Target | Avg | p50 | p95 | Max | Req/s | Success |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dashboard_page | 15.4 ms | 14.2 ms | 21.0 ms | 29.3 ms | 386.19 | 100% |
| mentions_page | 15.1 ms | 15.5 ms | 16.3 ms | 25.6 ms | 396.24 | 100% |
| bandeja_page | 10.5 ms | 10.4 ms | 11.3 ms | 17.0 ms | 569.78 | 100% |
| dashboard_api | 2.6 ms | 2.6 ms | 5.2 ms | 5.3 ms | 2131.63 | 100% |
| mentions_api | 2.3 ms | 1.8 ms | 3.9 ms | 4.0 ms | 2438.06 | 100% |
