# SAC Populicom

Base técnica inicial para una consola de monitoreo SAC orientada a operación gubernamental en Puerto Rico.

## Stack base

- `pnpm` + `Turborepo`
- `Next.js` + `React` para la consola operativa
- Servicios `Node.js` para ingesta, alertas y exportación
- `AWS CDK` para infraestructura
- `PostgreSQL` + `S3` como base de datos operativa y almacenamiento crudo

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
