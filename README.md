# SAC Populicom

Base técnica inicial para una consola de monitoreo SAC orientada a operación gubernamental en Puerto Rico.

## Stack base

- `pnpm` + `Turborepo`
- `Next.js` + `React` para la consola operativa
- Servicios `Node.js` para ingesta, alertas y exportación
- `AWS CDK` para infraestructura
- `PostgreSQL` + `S3` como base de datos operativa y almacenamiento crudo

## Estado de ingestión

- Mientras no exista acceso a la API de Brandwatch, la fuente oficial temporal es un export XLSX.
- El perfil y diccionario del primer export real viven en:
  - [`docs/brandwatch-export/profile.md`](/Volumes/MyApps/sac_populicom/docs/brandwatch-export/profile.md)
  - [`docs/brandwatch-export/data-dictionary.md`](/Volumes/MyApps/sac_populicom/docs/brandwatch-export/data-dictionary.md)
  - [`docs/brandwatch-export/ingestion-runbook.md`](/Volumes/MyApps/sac_populicom/docs/brandwatch-export/ingestion-runbook.md)
- Estado operativo confirmado el `2026-03-13`:
  - stack desplegado: `SacPlatformProd` en `us-east-1`
  - bucket raw: `sac-populicom-raw`
  - primera carga real: `s3://sac-populicom-raw/imports/brandwatch/pr-central/2026/03/13/2057252986_AAA+-+General.xlsx`
  - batch persistido: `batch-7bd586d1-66fc-4a9c-a1ff-ae7a2fc6369c`
  - validación posterior: reimportar el mismo archivo responde como duplicado por `checksum`

## Estructura

- `apps/web`: consola operativa y BFF
- `services/ingestion`: sincronización desde Brandwatch
- `services/notifications`: despacho de alertas
- `services/exports`: artefactos CSV/PDF
- `packages/config`: validación centralizada de entorno
- `packages/auth`: RBAC y scoping multiagencia
- `packages/brandwatch`: contratos y normalización
- `packages/db`: modelos, repositorio en memoria y esquema Prisma
- `packages/ui`: componentes compartidos
- `infra/cdk`: infraestructura AWS

## Modelo de datos operativo

- Tablas canónicas de la app:
  - `agencies`, `users`, `user_roles`
  - `mentions`, `alerts`, `cases`, `case_events`, `saved_filters`, `audit_logs`
- Capa de importación/analítica:
  - `source_queries`, `import_batches`, `mention_raw_rows`
  - `authors`, `publications`, `mention_threads`, `geographies`
  - `mention_metrics`, `mention_attributes`, `brandwatch_sync_runs`

## Primer arranque

```bash
pnpm install
pnpm dev
```

## Variables de entorno

Usa `.env.example` como referencia. Las credenciales reales deben residir en AWS Secrets Manager o SSM para despliegues.

## Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm brandwatch:profile <xlsx-path>`
- `pnpm brandwatch:import <xlsx-path> --agency pr-central`
- `pnpm brandwatch:invoke-import --bucket <bucket> --key <s3-key>`
- `pnpm stack:invoke-lambda --prefix <LogicalIdPrefix> --payload '{"format":"csv"}'`

## Flujo temporal sin API

- Perfilado/documentación:

```bash
pnpm brandwatch:profile "/ruta/al/export.xlsx"
```

- Ingesta directa a PostgreSQL:

```bash
DATABASE_URL=postgresql://... pnpm brandwatch:import "/ruta/al/export.xlsx" --agency pr-central
```

- Ingesta productiva:
  - subir el XLSX a `s3://$RAW_BUCKET_NAME/imports/brandwatch/{agency_id}/YYYY/MM/DD/archivo.xlsx`
  - `S3 -> SQS -> Lambda -> PostgreSQL`
- Verificación remota sin `aws` CLI:
  - invocar la Lambda de ingesta con `pnpm brandwatch:invoke-import ...`
  - invocar la Lambda de exports con `pnpm stack:invoke-lambda --prefix ExportsFunction ...`
