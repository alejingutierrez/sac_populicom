# AGENTS.md

## Proyecto

- Nombre: `sac_populicom`
- Objetivo: consola SAC de monitoreo de redes para operación gubernamental en Puerto Rico.
- Stack base: `pnpm` + `Turborepo`, `Next.js` + `React`, servicios `Node.js`, `AWS CDK`, `PostgreSQL`, `S3`.

## Referencias vivas

- Repositorio GitHub: `git@github.com:alejingutierrez/sac_populicom.git`
- Región AWS por defecto del stack principal: `us-east-1`
- Región real de Amplify Hosting: `us-east-2`
- Amplify ya fue creado y conectado al repositorio.
- URL actual de la rama `main` en Amplify: `https://main.d3adx7sp1dipb1.amplifyapp.com`
- Esta referencia fue confirmada por el usuario el `2026-03-13`.
- El `appId` de Amplify `d3adx7sp1dipb1` vive en `us-east-2`, no en `us-east-1`.
- Stack AWS desplegado de referencia: `SacPlatformProd`
- Buckets activos:
  - raw/imports: `sac-populicom-raw`
  - exports: `sac-populicom-exports`
- Primer batch Brandwatch confirmado en producción:
  - key: `imports/brandwatch/pr-central/2026/03/13/2057252986_AAA+-+General.xlsx`
  - batch id: `batch-7bd586d1-66fc-4a9c-a1ff-ae7a2fc6369c`
- Fuente temporal de Brandwatch mientras no exista API:
  - workbook: `/Users/alejandrogutierrez/Downloads/2057252986_AAA+-+General.xlsx`
  - perfil generado: [`docs/brandwatch-export/profile.md`](/Volumes/MyApps/sac_populicom/docs/brandwatch-export/profile.md)
  - diccionario: [`docs/brandwatch-export/data-dictionary.md`](/Volumes/MyApps/sac_populicom/docs/brandwatch-export/data-dictionary.md)
  - runbook: [`docs/brandwatch-export/ingestion-runbook.md`](/Volumes/MyApps/sac_populicom/docs/brandwatch-export/ingestion-runbook.md)
- Capa actual de enriquecimientos:
  - catálogo: [`docs/enrichments/catalog.md`](/Volumes/MyApps/sac_populicom/docs/enrichments/catalog.md)
  - fórmulas: [`docs/enrichments/formulas.md`](/Volumes/MyApps/sac_populicom/docs/enrichments/formulas.md)
  - API interna: [`docs/enrichments/api.md`](/Volumes/MyApps/sac_populicom/docs/enrichments/api.md)
  - total de derivadas habilitadas por defecto: `100`
  - artefactos persistidos: tabla `enrichment_definitions` + vistas `mention_enriched_v1`, `mention_rollup_24h_v1`, `mention_rollup_7d_v1`, `mention_rollup_batch_v1`

## Reglas operativas para futuros agentes

- No recrear otra app de Amplify si no hay una instrucción explícita; primero verificar la existente y reutilizarla.
- No romper la conexión actual de Amplify con GitHub sin autorización explícita.
- Si se ajustan dominios, callbacks o variables públicas del frontend, alinear cualquier configuración con la URL actual de Amplify.
- Mantener secretos fuera del repo. Usar `.env` local solo para trabajo local y `AWS Secrets Manager` o `SSM` para despliegues.
- Antes de cambios en infraestructura, verificar el estado real en AWS; no asumir que el estado del repo refleja el estado desplegado.
- Si se revisa Amplify, consultar primero `us-east-2`; el stack principal y la base siguen en `us-east-1`.
- El parser del export Brandwatch detecta el header por firma de columnas; no asumir filas fijas sin validar el archivo real.
- Para deduplicación de menciones del export, usar siempre `Mention Id -> Resource Id -> Url`.
- Si el frontend en Amplify debe leer PostgreSQL, confirmar que `DATABASE_URL` esté configurado explícitamente en el runtime SSR.
- Si se necesita verificar Lambdas del stack desde esta máquina sin `aws` CLI, usar `pnpm brandwatch:invoke-import` y `pnpm stack:invoke-lambda`.
- Si se cambia el catálogo o una fórmula, regenerar `docs/enrichments` con `pnpm enrichments:docs`.
- `GET /api/mentions` sigue siendo el contrato compatible; la capa nueva entra por `GET /api/mentions/enriched`, `GET /api/mentions/:id/enrichments`, `GET /api/enrichments/catalog` y `GET /api/enrichments/rollups`.

## Validación mínima esperada

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm --filter @sac/web test:e2e`
- `pnpm test:perf`

## Notas de despliegue

- La configuración de build para Amplify vive en `amplify.yml`.
- La infraestructura base vive en `infra/cdk`.
- Si un cambio toca autenticación o URLs públicas, revisar también las salidas y parámetros que dependan del dominio de Amplify.
