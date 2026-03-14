# Performance Baseline

- Base URL: `http://127.0.0.1:3300`
- Iterations per target: `36`
- Concurrency: `6`
- Warmup requests per target: `6`

| Target                 |     Avg |     p50 |     p95 |     Max |   Req/s | Success |
| ---------------------- | ------: | ------: | ------: | ------: | ------: | ------: |
| dashboard_page         | 20.3 ms | 19.3 ms | 27.7 ms | 36.9 ms |  293.81 |    100% |
| mentions_page          | 19.1 ms | 20.0 ms | 22.5 ms | 27.4 ms |  313.02 |    100% |
| bandeja_page           | 13.1 ms | 12.9 ms | 14.8 ms | 15.1 ms |  457.61 |    100% |
| dashboard_api          |  3.1 ms |  2.7 ms |  6.1 ms |  6.1 ms | 1849.07 |    100% |
| mentions_api           |  2.8 ms |  2.9 ms |  5.2 ms |  5.4 ms | 1958.56 |    100% |
| mentions_enriched_api  |  4.8 ms |  4.4 ms |  9.3 ms |  9.3 ms | 1188.14 |    100% |
| enrichment_rollups_api |  5.7 ms |  5.0 ms | 11.3 ms | 11.4 ms |  973.66 |    100% |
