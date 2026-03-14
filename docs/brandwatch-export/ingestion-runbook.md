# Runbook de ingestión temporal Brandwatch

## Estado actual

- Fuente temporal oficial mientras no exista acceso API: export XLSX de Brandwatch.
- Archivo modelado inicialmente: `2057252986_AAA+-+General.xlsx`.
- Perfil confirmado el `2026-03-13`:
  - `1` hoja (`Sheet0`)
  - `1755` filas de datos
  - `187` columnas
  - metadatos en filas `1-5`
  - encabezado efectivo detectado en la fila `6`
  - datos desde la fila `7`
  - `18` filas sin `Mention Id`, todas con fallback viable por `Resource Id`
- Despliegue confirmado en AWS `us-east-1`:
  - stack: `SacPlatformProd`
  - bucket raw: `sac-populicom-raw`
  - bucket exports: `sac-populicom-exports`
  - prefijo activo: `imports/brandwatch/`
  - app Amplify referencial: `https://main.d3adx7sp1dipb1.amplifyapp.com`
- Primera carga productiva confirmada:
  - objeto: `s3://sac-populicom-raw/imports/brandwatch/pr-central/2026/03/13/2057252986_AAA+-+General.xlsx`
  - batch detectado: `batch-7bd586d1-66fc-4a9c-a1ff-ae7a2fc6369c`
  - verificación posterior: el mismo archivo responde como duplicado por `checksum`, señal de que el primer import ya quedó persistido

## Ruta técnica

- Bucket raw/imports: `s3://$RAW_BUCKET_NAME`
- Prefijo: `imports/brandwatch/{agency_id}/{yyyy}/{mm}/{dd}/{filename}.xlsx`
- Flujo:
  - `S3` recibe el XLSX
  - notificación a `SQS`
  - `services/ingestion` consume el mensaje
  - el parser normaliza el workbook
  - `@sac/db` persiste `import_batches`, `mention_raw_rows`, dimensiones y `mentions`
  - se generan `alerts` cuando la mención normalizada es crítica/negativa

## Tablas activadas por el import

- `source_queries`
- `import_batches`
- `mention_raw_rows`
- `authors`
- `publications`
- `mention_threads`
- `geographies`
- `mentions`
- `mention_metrics`
- `mention_attributes`
- `alerts`

## Reglas de deduplicación

- Batch único por `checksum`.
- Fila raw única por `import_batch_id + row_number`.
- Mención canónica única por `agency_id + external_id + source_system`.
- Orden de clave externa:
  - `Mention Id`
  - `Resource Id`
  - `Url`

## Validación local

- Perfilado del workbook:

```bash
pnpm brandwatch:profile "/Users/alejandrogutierrez/Downloads/2057252986_AAA+-+General.xlsx"
```

- Importación directa contra PostgreSQL local/remoto:

```bash
DATABASE_URL=postgresql://... pnpm brandwatch:import "/Users/alejandrogutierrez/Downloads/2057252986_AAA+-+General.xlsx" --agency pr-central
```

## Despliegue AWS

1. Configurar variables reales:
   - `AWS_REGION`
   - `AWS_ACCOUNT_ID`
   - `RAW_BUCKET_NAME`
   - `EXPORTS_BUCKET_NAME`
   - `NEXT_PUBLIC_DEFAULT_AGENCY_ID`
   - `AMPLIFY_APP_ID`
   - `AMPLIFY_APP_URL`
2. Bootstrap CDK si la cuenta no tiene toolkit:

```bash
pnpm --filter @sac/infra-cdk cdk bootstrap
```

3. Desplegar stack:

```bash
pnpm --filter @sac/infra-cdk cdk deploy
```

4. Subir el XLSX al prefijo de import:

```bash
aws s3 cp "/Users/alejandrogutierrez/Downloads/2057252986_AAA+-+General.xlsx" \
  "s3://$RAW_BUCKET_NAME/imports/brandwatch/pr-central/2026/03/13/2057252986_AAA+-+General.xlsx"
```

## Observabilidad

- Revisar `import_batches.status`.
- Revisar logs del Lambda de ingestión.
- Revisar profundidad de `ImportsQueue`.
- Verificar que `GET /api/mentions` devuelve datos importados.
- Para operación desde esta máquina sin `aws` CLI:

```bash
pnpm brandwatch:invoke-import --bucket sac-populicom-raw --key imports/brandwatch/pr-central/2026/03/13/2057252986_AAA+-+General.xlsx
pnpm stack:invoke-lambda --prefix ExportsFunction --payload "{\"format\":\"csv\"}"
```

## Notas

- El parser detecta automáticamente la fila de header por firma de columnas; no depende de una fila fija.
- Las fechas del export se normalizan a ISO UTC para evitar diferencias por timezone del runtime.
- El segundo comando de validación anterior devuelve `Function.ResponseSizeTooLarge` porque el CSV real excede el límite de respuesta síncrona de Lambda; ese resultado confirma que la función de exportación sí está leyendo datos reales desde PostgreSQL.
- Mientras Amplify siga siendo externo al stack, la app web requiere `DATABASE_URL` explícita si se quiere que sus route handlers lean PostgreSQL en producción.
