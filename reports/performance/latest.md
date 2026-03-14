# Performance Baseline

- Base URL: `http://127.0.0.1:3300`
- Iterations per target: `36`
- Concurrency: `6`
- Warmup requests per target: `6`

| Target                     |     Avg |     p50 |     p95 |     Max |   Req/s | Success |
| -------------------------- | ------: | ------: | ------: | ------: | ------: | ------: |
| exploration_page           | 32.8 ms | 31.2 ms | 63.2 ms | 64.6 ms |  182.26 |    100% |
| operations_page            | 13.2 ms | 13.0 ms | 14.5 ms | 15.1 ms |  452.94 |    100% |
| mentions_page              | 14.8 ms | 14.8 ms | 18.9 ms | 21.0 ms |  403.34 |    100% |
| bandeja_page               | 11.0 ms | 11.1 ms | 11.8 ms | 11.9 ms |  542.18 |    100% |
| dashboard_api              |  2.4 ms |  1.8 ms |  4.4 ms |  4.6 ms | 2322.66 |    100% |
| exploration_summary_api    |  5.2 ms |  5.5 ms | 12.8 ms | 12.9 ms |  1043.2 |    100% |
| exploration_timeseries_api |  4.6 ms |  3.3 ms |  7.4 ms |  7.5 ms | 1223.93 |    100% |
| exploration_breakdowns_api |  4.2 ms |  3.2 ms |  7.0 ms |  7.1 ms | 1328.18 |    100% |
| exploration_entities_api   |  3.8 ms |  2.7 ms |  6.2 ms |  6.4 ms |  1460.3 |    100% |
| mentions_api               |  2.4 ms |  2.3 ms |  4.3 ms |  4.3 ms | 2341.61 |    100% |
| mentions_enriched_api      |  3.3 ms |  2.4 ms |  5.3 ms |  5.4 ms | 1700.45 |    100% |
| enrichment_rollups_api     |  4.4 ms |  4.4 ms |  9.3 ms |  9.5 ms | 1283.06 |    100% |
