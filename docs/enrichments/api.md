# API de Enrichments

- Total de derivadas expuestas por catálogo: `100`
- Zona horaria operativa: `America/Puerto_Rico`
- Capa técnica: catálogo persistido en `enrichment_definitions` + vistas SQL `mention_enriched_v1`, `mention_rollup_24h_v1`, `mention_rollup_7d_v1`, `mention_rollup_batch_v1`

## Endpoints internos

### `GET /api/enrichments/catalog`

Devuelve el catálogo persistido de las 100 derivadas, incluyendo `isEnabled`, `dependsOn`, `sourceCoverage` y `nullPolicy`.

Respuesta:

```json
{
  "data": [
    {
      "code": "D001",
      "slug": "canonical_external_key",
      "label": "Canonical External Key",
      "category": "identity_trace",
      "grain": "mention",
      "valueType": "key",
      "isEnabled": true,
      "dependsOn": ["Mention Id", "Resource Id", "Url"],
      "sourceCoverage": "all_sources",
      "nullPolicy": "fallback_to_canonical",
      "description": "Clave técnica final de la mención."
    }
  ]
}
```

### `GET /api/mentions/enriched`

Devuelve menciones canónicas + objeto `enrichments`.

Query params soportados:

- `agencyId`
- `source`
- `sentiment`
- `priority`
- `q`
- `from`
- `to`
- `limit`
- `offset`
- `includeDisabled=true|false`

Respuesta:

```json
{
  "data": [
    {
      "id": "mention-123",
      "agencyId": "pr-central",
      "externalId": "bw-social-123",
      "source": "social",
      "channel": "X",
      "body": "Texto canónico",
      "url": "https://example.com/post/123",
      "language": "es",
      "sentiment": "negative",
      "priority": "high",
      "authorName": "Autor",
      "occurredAt": "2026-03-13T22:00:00.000Z",
      "receivedAt": "2026-03-13T22:04:00.000Z",
      "isCritical": false,
      "engagement": {
        "likes": 10,
        "comments": 5,
        "shares": 2,
        "impressions": 500
      },
      "enrichments": {
        "platform_family": "X",
        "risk_base_score": 3,
        "same_author_day_volume": 4
      },
      "enrichmentMeta": {
        "batchId": "batch-123",
        "queryId": "2057252986",
        "windowKeys": {
          "batch": "batch-123",
          "24h": "2026-03-13|24h",
          "7d": "2026-03-13|7d"
        }
      }
    }
  ]
}
```

### `GET /api/mentions/:id/enrichments`

Devuelve una sola mención enriquecida. Acepta `includeDisabled=true` para inspección completa del catálogo.

### `GET /api/enrichments/rollups`

Devuelve agregados vivos calculados directamente desde las vistas SQL.

Query params requeridos:

- `window=24h|7d|batch`
- `groupBy=platform_family|source_class|sentiment|language|country|import_batch_id|source_query_id`

Query params opcionales:

- `agencyId`
- `batchId` cuando `window=batch`

Respuesta:

```json
{
  "data": [
    {
      "agencyId": "pr-central",
      "batchId": "batch-123",
      "queryId": "2057252986",
      "groupBy": "platform_family",
      "groupKey": "X",
      "window": "batch",
      "values": {
        "mention_count": 45,
        "negative_count": 8,
        "positive_count": 11,
        "critical_count": 2,
        "avg_risk_base_score": 1.84,
        "avg_earned_attention_index": 0.1435,
        "avg_capture_latency_minutes": 14.2,
        "avg_total_interactions_base": 27.9,
        "sum_total_interactions_base": 1255.5,
        "avg_platform_visibility_index": 0.3088
      }
    }
  ]
}
```

## Automatización

- El catálogo se sincroniza con `enrichment_definitions` en cada arranque del repositorio PostgreSQL.
- Las vistas SQL se regeneran con `CREATE OR REPLACE VIEW` dentro de `ensureEnrichmentArtifacts()`.
- La ingesta por XLSX y el futuro flujo por API reutilizan el mismo contrato canónico; cuando entren datos nuevos, `mention_enriched_v1` y los rollups reflejan los cambios sin `refresh` manual.
