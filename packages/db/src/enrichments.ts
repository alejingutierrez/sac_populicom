import { createHash } from "node:crypto";

import type {
  EnrichedMention,
  EnrichmentCategory,
  EnrichmentDefinition,
  EnrichmentGroupBy,
  EnrichmentRollup,
  EnrichmentRollupFilters,
  EnrichmentValue,
  EnrichmentWindow,
  NormalizedMention
} from "./types";

type RawPayload = Record<string, string | number | boolean | null>;

type MentionEnrichmentSeed = {
  mention: NormalizedMention;
  batchId?: string;
  queryId?: string;
  rawPayload?: RawPayload;
};

type AggregateContext = {
  sameAuthorDayVolume: number;
  sameDomainDayVolume: number;
  sameQueryPlatformHourVolume: number;
  sameThreadVolume: number;
  threadEngagementShare: number;
};

type MentionEnrichmentContext = MentionEnrichmentSeed &
  AggregateContext & {
    localDate: string;
    localHour: number;
    localWeekday: string;
    localDayPart: string;
    normalizedUrlHost?: string;
  };

type InternalEnrichmentDefinition = EnrichmentDefinition & {
  formulaSummary: string;
};

const TIME_ZONE = "America/Puerto_Rico";
const ROLLUP_METRICS = [
  "mention_count",
  "negative_count",
  "positive_count",
  "critical_count",
  "avg_risk_base_score",
  "avg_earned_attention_index",
  "avg_capture_latency_minutes",
  "avg_total_interactions_base",
  "sum_total_interactions_base",
  "avg_platform_visibility_index"
] as const;

const define = (
  code: string,
  slug: string,
  label: string,
  category: EnrichmentCategory,
  grain: InternalEnrichmentDefinition["grain"],
  valueType: InternalEnrichmentDefinition["valueType"],
  dependsOn: string[],
  sourceCoverage: InternalEnrichmentDefinition["sourceCoverage"],
  nullPolicy: InternalEnrichmentDefinition["nullPolicy"],
  description: string,
  formulaSummary: string
): InternalEnrichmentDefinition => ({
  code,
  slug,
  label,
  category,
  grain,
  valueType,
  isEnabled: true,
  dependsOn,
  sourceCoverage,
  nullPolicy,
  description,
  formulaSummary
});

const identityDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D001",
    "canonical_external_key",
    "Canonical External Key",
    "identity_trace",
    "mention",
    "key",
    ["Mention Id", "Resource Id", "Url"],
    "all_sources",
    "fallback_to_canonical",
    "Clave técnica final de la mención.",
    "COALESCE(Mention Id, Resource Id, Url)"
  ),
  define(
    "D002",
    "external_key_source",
    "External Key Source",
    "identity_trace",
    "mention",
    "string",
    ["Mention Id", "Resource Id", "Url"],
    "all_sources",
    "fallback_to_canonical",
    "Origen de la clave externa final.",
    "Etiqueta cuál fallback produjo la clave"
  ),
  define(
    "D003",
    "mention_trace_key",
    "Mention Trace Key",
    "identity_trace",
    "mention",
    "key",
    ["Query Id", "Mention Id", "Resource Id", "Url"],
    "all_sources",
    "fallback_to_canonical",
    "Join técnico estable para auditoría.",
    "Query Id + canonical_external_key"
  ),
  define(
    "D004",
    "normalized_url_host",
    "Normalized URL Host",
    "identity_trace",
    "mention",
    "string",
    ["Url", "Original Url", "Domain"],
    "all_sources",
    "fallback_to_canonical",
    "Dominio normalizado de navegación.",
    "Host canonizado desde URL"
  ),
  define(
    "D005",
    "normalized_url_path_depth",
    "Normalized URL Path Depth",
    "identity_trace",
    "mention",
    "number",
    ["Url"],
    "all_sources",
    "fallback_to_zero",
    "Profundidad del path en la URL.",
    "Conteo de segmentos en path"
  ),
  define(
    "D006",
    "has_original_url_flag",
    "Has Original URL Flag",
    "identity_trace",
    "mention",
    "boolean",
    ["Original Url"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Indica si vino URL original además de la principal.",
    "Original Url no vacío"
  ),
  define(
    "D007",
    "has_thread_context_flag",
    "Has Thread Context Flag",
    "identity_trace",
    "mention",
    "boolean",
    ["Thread Id", "Thread URL"],
    "thread_context_optional",
    "derived_from_available_inputs",
    "Presencia de contexto de hilo.",
    "Thread Id o Thread URL presentes"
  ),
  define(
    "D008",
    "has_publication_context_flag",
    "Has Publication Context Flag",
    "identity_trace",
    "mention",
    "boolean",
    ["Publication Id", "Publication Name"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Presencia de contexto editorial/publicación.",
    "Publication Id o Publication Name presentes"
  ),
  define(
    "D009",
    "has_platform_author_id_flag",
    "Has Platform Author ID Flag",
    "identity_trace",
    "mention",
    "boolean",
    ["Facebook Author ID", "X Author ID", "Bluesky Author Id"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Presencia de identificador nativo de autor.",
    "Cualquier author id por plataforma"
  ),
  define(
    "D010",
    "dedup_fingerprint",
    "Dedup Fingerprint",
    "identity_trace",
    "mention",
    "key",
    ["Page Type", "Author", "Date", "Url", "Title"],
    "all_sources",
    "fallback_to_canonical",
    "Hash lógico para revisión manual de duplicados.",
    "Hash de plataforma, autor, fecha, host y título"
  )
];

const timeDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D011",
    "occurred_hour_pr",
    "Occurred Hour PR",
    "time_freshness",
    "mention",
    "number",
    ["Date"],
    "all_sources",
    "fallback_to_canonical",
    "Hora local en Puerto Rico.",
    "EXTRACT(HOUR FROM occurred_at at America/Puerto_Rico)"
  ),
  define(
    "D012",
    "occurred_weekday_pr",
    "Occurred Weekday PR",
    "time_freshness",
    "mention",
    "string",
    ["Date"],
    "all_sources",
    "fallback_to_canonical",
    "Día de semana local.",
    "Nombre de weekday local"
  ),
  define(
    "D013",
    "occurred_is_weekend_flag",
    "Occurred Is Weekend Flag",
    "time_freshness",
    "mention",
    "boolean",
    ["Date"],
    "all_sources",
    "fallback_to_canonical",
    "Marca si cayó en fin de semana.",
    "Weekday en sábado/domingo"
  ),
  define(
    "D014",
    "occurred_daypart",
    "Occurred Daypart",
    "time_freshness",
    "mention",
    "bucket",
    ["Date"],
    "all_sources",
    "fallback_to_canonical",
    "Franja horaria operacional.",
    "Bucket madrugada/mañana/tarde/noche"
  ),
  define(
    "D015",
    "business_hours_flag",
    "Business Hours Flag",
    "time_freshness",
    "mention",
    "boolean",
    ["Date"],
    "all_sources",
    "fallback_to_canonical",
    "Marca si ocurrió en horario laboral estándar.",
    "Hora local entre 08 y 18"
  ),
  define(
    "D016",
    "capture_latency_minutes",
    "Capture Latency Minutes",
    "time_freshness",
    "mention",
    "number",
    ["Date", "Updated", "Added"],
    "brandwatch_export_preferred",
    "fallback_to_canonical",
    "Latencia entre ocurrencia y captura/actualización.",
    "Minutos entre occurredAt y receivedAt"
  ),
  define(
    "D017",
    "freshness_bucket",
    "Freshness Bucket",
    "time_freshness",
    "mention",
    "bucket",
    ["Date", "Updated", "Added"],
    "all_sources",
    "fallback_to_canonical",
    "Bucket operativo de frescura.",
    "0-15m, 15-60m, 1-6h, 6-24h, 24h+"
  ),
  define(
    "D018",
    "report_window_progress_pct",
    "Report Window Progress Pct",
    "time_freshness",
    "mention",
    "number",
    ["Date", "From", "To"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Posición porcentual dentro del corte del reporte.",
    "(Date-From)/(To-From)"
  ),
  define(
    "D019",
    "same_platform_hour_bucket",
    "Same Platform Hour Bucket",
    "time_freshness",
    "mention",
    "key",
    ["Page Type", "Date"],
    "all_sources",
    "fallback_to_canonical",
    "Llave por plataforma y hora local.",
    "Page Type + YYYY-MM-DD HH"
  ),
  define(
    "D020",
    "same_query_day_bucket",
    "Same Query Day Bucket",
    "time_freshness",
    "mention",
    "key",
    ["Query Id", "Date"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Llave por query y día.",
    "Query Id + fecha local"
  )
];

const geoDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D021",
    "geo_known_flag",
    "Geo Known Flag",
    "geo",
    "mention",
    "boolean",
    ["Country", "Region", "City", "Latitude", "Longitude"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Hay al menos una señal geográfica útil.",
    "Algún campo geo no nulo"
  ),
  define(
    "D022",
    "geo_granularity_level",
    "Geo Granularity Level",
    "geo",
    "mention",
    "bucket",
    ["Country", "Region", "City", "Latitude", "Longitude"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Nivel de precisión geográfica.",
    "country/region/city/latlon/unknown"
  ),
  define(
    "D023",
    "is_puerto_rico_flag",
    "Is Puerto Rico Flag",
    "geo",
    "mention",
    "boolean",
    ["Country"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Marca menciones atribuibles a Puerto Rico.",
    "Country = Puerto Rico"
  ),
  define(
    "D024",
    "is_us_flag",
    "Is US Flag",
    "geo",
    "mention",
    "boolean",
    ["Country"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Marca menciones de Estados Unidos.",
    "Country contiene United States"
  ),
  define(
    "D025",
    "is_hispanic_market_flag",
    "Is Hispanic Market Flag",
    "geo",
    "mention",
    "boolean",
    ["Country", "Language"],
    "all_sources",
    "derived_from_available_inputs",
    "Mercado hispano según país/idioma.",
    "País hispano o idioma es"
  ),
  define(
    "D026",
    "geo_market_bucket",
    "Geo Market Bucket",
    "geo",
    "mention",
    "bucket",
    ["Country"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Agrupación operativa de mercado geográfico.",
    "Puerto Rico/US/LatAm/Europe/Other/Unknown"
  ),
  define(
    "D027",
    "country_region_city_key",
    "Country Region City Key",
    "geo",
    "mention",
    "key",
    ["Country", "Region", "City"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Dimensión compuesta de geografía.",
    "Country|Region|City"
  ),
  define(
    "D028",
    "has_coordinates_flag",
    "Has Coordinates Flag",
    "geo",
    "mention",
    "boolean",
    ["Latitude", "Longitude"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Marca si llegaron coordenadas.",
    "Latitude y Longitude presentes"
  ),
  define(
    "D029",
    "location_precision_score",
    "Location Precision Score",
    "geo",
    "mention",
    "number",
    ["Country", "Region", "City", "Latitude", "Longitude"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Score simple de calidad geográfica.",
    "0 a 3 según precisión"
  ),
  define(
    "D030",
    "language_geo_alignment_flag",
    "Language Geo Alignment Flag",
    "geo",
    "mention",
    "boolean",
    ["Country", "Language"],
    "all_sources",
    "derived_from_available_inputs",
    "Coherencia básica entre idioma y geografía.",
    "Idioma compatible con mercado dominante"
  )
];

const contentDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D031",
    "body_length_chars",
    "Body Length Chars",
    "content",
    "mention",
    "number",
    ["Full Text", "Snippet", "Title"],
    "all_sources",
    "fallback_to_canonical",
    "Longitud del cuerpo disponible.",
    "LEN(body canónico)"
  ),
  define(
    "D032",
    "body_length_bucket",
    "Body Length Bucket",
    "content",
    "mention",
    "bucket",
    ["Full Text", "Snippet", "Title"],
    "all_sources",
    "fallback_to_canonical",
    "Bucket de extensión textual.",
    "short/medium/long/very_long"
  ),
  define(
    "D033",
    "title_present_flag",
    "Title Present Flag",
    "content",
    "mention",
    "boolean",
    ["Title"],
    "all_sources",
    "fallback_to_canonical",
    "Hay título disponible.",
    "Title no vacío"
  ),
  define(
    "D034",
    "snippet_present_flag",
    "Snippet Present Flag",
    "content",
    "mention",
    "boolean",
    ["Snippet"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Hay snippet disponible.",
    "Snippet no vacío"
  ),
  define(
    "D035",
    "full_text_present_flag",
    "Full Text Present Flag",
    "content",
    "mention",
    "boolean",
    ["Full Text", "Has Full Text"],
    "all_sources",
    "derived_from_available_inputs",
    "Hay texto completo disponible.",
    "Full Text o flag Has Full Text"
  ),
  define(
    "D036",
    "title_body_overlap_ratio",
    "Title Body Overlap Ratio",
    "content",
    "mention",
    "number",
    ["Title", "Full Text", "Snippet"],
    "all_sources",
    "null_if_missing",
    "Similitud básica título-cuerpo.",
    "Tokens compartidos / tokens de título"
  ),
  define(
    "D037",
    "hashtag_count",
    "Hashtag Count",
    "content",
    "mention",
    "number",
    ["Hashtags"],
    "brandwatch_export_preferred",
    "fallback_to_zero",
    "Cantidad de hashtags detectados.",
    "Conteo de Hashtags"
  ),
  define(
    "D038",
    "mentioned_authors_count",
    "Mentioned Authors Count",
    "content",
    "mention",
    "number",
    ["Mentioned Authors"],
    "brandwatch_export_preferred",
    "fallback_to_zero",
    "Cantidad de autores mencionados.",
    "Conteo de Mentioned Authors"
  ),
  define(
    "D039",
    "media_urls_count",
    "Media URLs Count",
    "content",
    "mention",
    "number",
    ["Media URLs"],
    "brandwatch_export_preferred",
    "fallback_to_zero",
    "Cantidad de URLs de media.",
    "Conteo de Media URLs"
  ),
  define(
    "D040",
    "expanded_urls_count",
    "Expanded URLs Count",
    "content",
    "mention",
    "number",
    ["Expanded URLs"],
    "brandwatch_export_preferred",
    "fallback_to_zero",
    "Cantidad de URLs expandidas.",
    "Conteo de Expanded URLs"
  )
];

const sentimentDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D041",
    "sentiment_score",
    "Sentiment Score",
    "sentiment_risk",
    "mention",
    "number",
    ["Sentiment"],
    "all_sources",
    "fallback_to_canonical",
    "Polaridad numérica básica.",
    "positive=1 neutral=0 negative=-1"
  ),
  define(
    "D042",
    "non_neutral_flag",
    "Non Neutral Flag",
    "sentiment_risk",
    "mention",
    "boolean",
    ["Sentiment"],
    "all_sources",
    "fallback_to_canonical",
    "Marca sentimiento no neutral.",
    "Sentiment != neutral"
  ),
  define(
    "D043",
    "negative_flag",
    "Negative Flag",
    "sentiment_risk",
    "mention",
    "boolean",
    ["Sentiment"],
    "all_sources",
    "fallback_to_canonical",
    "Marca sentimiento negativo.",
    "Sentiment = negative"
  ),
  define(
    "D044",
    "positive_flag",
    "Positive Flag",
    "sentiment_risk",
    "mention",
    "boolean",
    ["Sentiment"],
    "all_sources",
    "fallback_to_canonical",
    "Marca sentimiento positivo.",
    "Sentiment = positive"
  ),
  define(
    "D045",
    "emotion_present_flag",
    "Emotion Present Flag",
    "sentiment_risk",
    "mention",
    "boolean",
    ["Emotion"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Existe emoción etiquetada.",
    "Emotion no vacío"
  ),
  define(
    "D046",
    "emotion_category_normalized",
    "Emotion Category Normalized",
    "sentiment_risk",
    "mention",
    "string",
    ["Emotion"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Emoción normalizada a minúsculas.",
    "Lower(trim(Emotion))"
  ),
  define(
    "D047",
    "sentiment_emotion_alignment_flag",
    "Sentiment Emotion Alignment Flag",
    "sentiment_risk",
    "mention",
    "boolean",
    ["Sentiment", "Emotion"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Coherencia simple entre emoción y polaridad.",
    "negative con fear/anger, positive con joy/trust"
  ),
  define(
    "D048",
    "risk_base_score",
    "Risk Base Score",
    "sentiment_risk",
    "mention",
    "number",
    ["Sentiment", "Emotion", "Reportable"],
    "all_sources",
    "derived_from_available_inputs",
    "Score base de riesgo reputacional.",
    "negative + emotion + reportable"
  ),
  define(
    "D049",
    "criticality_proxy_score",
    "Criticality Proxy Score",
    "sentiment_risk",
    "mention",
    "number",
    ["Sentiment", "Priority", "Engagement Score", "Reportable"],
    "all_sources",
    "derived_from_available_inputs",
    "Score expandido de criticidad.",
    "risk_base + prioridad + engagement"
  ),
  define(
    "D050",
    "editorial_attention_flag",
    "Editorial Attention Flag",
    "sentiment_risk",
    "mention",
    "boolean",
    ["Sentiment", "Reportable", "Starred", "Checked"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Marca casos que merecen atención editorial/analítica.",
    "negative o reportable o starred/checked"
  )
];

const engagementDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D051",
    "total_interactions_base",
    "Total Interactions Base",
    "engagement",
    "mention",
    "number",
    ["Likes", "Comments", "Shares"],
    "all_sources",
    "fallback_to_zero",
    "Interacciones básicas homologadas.",
    "likes + comments + shares"
  ),
  define(
    "D052",
    "interaction_rate_impressions",
    "Interaction Rate Impressions",
    "engagement",
    "mention",
    "number",
    ["Impressions", "Likes", "Comments", "Shares"],
    "all_sources",
    "null_if_missing",
    "Tasa de interacción sobre impresiones.",
    "total_interactions / impressions"
  ),
  define(
    "D053",
    "interaction_rate_reach",
    "Interaction Rate Reach",
    "engagement",
    "mention",
    "number",
    ["Reach (new)", "Likes", "Comments", "Shares"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Tasa de interacción sobre reach.",
    "total_interactions / reach"
  ),
  define(
    "D054",
    "interaction_rate_audience",
    "Interaction Rate Audience",
    "engagement",
    "mention",
    "number",
    ["Potential Audience", "Likes", "Comments", "Shares"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Tasa de interacción sobre audiencia potencial.",
    "total_interactions / audience"
  ),
  define(
    "D055",
    "virality_ratio",
    "Virality Ratio",
    "engagement",
    "mention",
    "number",
    ["Shares", "Comments"],
    "all_sources",
    "null_if_missing",
    "Virality simple de shares a comentarios.",
    "shares / comments"
  ),
  define(
    "D056",
    "amplification_ratio",
    "Amplification Ratio",
    "engagement",
    "mention",
    "number",
    ["Shares", "Likes"],
    "all_sources",
    "null_if_missing",
    "Amplificación de shares sobre likes.",
    "shares / likes"
  ),
  define(
    "D057",
    "conversation_ratio",
    "Conversation Ratio",
    "engagement",
    "mention",
    "number",
    ["Comments", "Likes"],
    "all_sources",
    "null_if_missing",
    "Conversación sobre likes.",
    "comments / likes"
  ),
  define(
    "D058",
    "reach_efficiency_score",
    "Reach Efficiency Score",
    "engagement",
    "mention",
    "number",
    ["Reach (new)", "Potential Audience"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Eficiencia de reach versus audiencia potencial.",
    "reach / audience"
  ),
  define(
    "D059",
    "impact_per_interaction",
    "Impact Per Interaction",
    "engagement",
    "mention",
    "number",
    ["Impact", "Likes", "Comments", "Shares"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Impacto por interacción base.",
    "impact / total_interactions"
  ),
  define(
    "D060",
    "earned_attention_index",
    "Earned Attention Index",
    "engagement",
    "mention",
    "number",
    ["Impressions", "Reach (new)", "Impact", "Engagement Score"],
    "all_sources",
    "derived_from_available_inputs",
    "Score combinado de atención ganada.",
    "Promedio ponderado de visibility/impact/engagement"
  )
];

const platformDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D061",
    "source_class",
    "Source Class",
    "platform",
    "mention",
    "string",
    ["Page Type"],
    "all_sources",
    "fallback_to_canonical",
    "Clase operativa de fuente.",
    "social/news/web"
  ),
  define(
    "D062",
    "platform_family",
    "Platform Family",
    "platform",
    "mention",
    "string",
    ["Page Type", "Content Source Name"],
    "all_sources",
    "fallback_to_canonical",
    "Familia de plataforma homologada.",
    "X/Facebook/Instagram/..."
  ),
  define(
    "D063",
    "normalized_likes",
    "Normalized Likes",
    "platform",
    "mention",
    "number",
    ["Likes", "Facebook Likes", "Instagram Likes", "X Likes"],
    "all_sources",
    "fallback_to_zero",
    "Likes homologados por plataforma.",
    "Coalesce likes específicos/core"
  ),
  define(
    "D064",
    "normalized_comments",
    "Normalized Comments",
    "platform",
    "mention",
    "number",
    ["Comments", "Facebook Comments", "Instagram Comments", "Youtube Comments"],
    "all_sources",
    "fallback_to_zero",
    "Comentarios homologados por plataforma.",
    "Coalesce comments específicos/core"
  ),
  define(
    "D065",
    "normalized_shares",
    "Normalized Shares",
    "platform",
    "mention",
    "number",
    ["Shares", "Facebook Shares", "X Reposts", "Threads Shares"],
    "all_sources",
    "fallback_to_zero",
    "Shares/reposts homologados.",
    "Coalesce shares/reposts"
  ),
  define(
    "D066",
    "normalized_views",
    "Normalized Views",
    "platform",
    "mention",
    "number",
    ["Impressions", "Threads Views", "Tiktok Views", "Resource Views"],
    "all_sources",
    "fallback_to_zero",
    "Views/impressions homologadas.",
    "Coalesce views/impressions"
  ),
  define(
    "D067",
    "normalized_followers",
    "Normalized Followers",
    "platform",
    "mention",
    "number",
    ["Instagram Followers", "X Followers", "Youtube Subscriber Count"],
    "brandwatch_export_preferred",
    "fallback_to_zero",
    "Seguidores homologados.",
    "Coalesce followers/subscribers"
  ),
  define(
    "D068",
    "normalized_posts",
    "Normalized Posts",
    "platform",
    "mention",
    "number",
    ["Instagram Posts", "X Posts", "Bluesky Posts", "Youtube Video Count"],
    "brandwatch_export_preferred",
    "fallback_to_zero",
    "Posts/vídeos homologados por cuenta.",
    "Coalesce posts/video count"
  ),
  define(
    "D069",
    "platform_visibility_index",
    "Platform Visibility Index",
    "platform",
    "mention",
    "number",
    ["Impressions", "Reach (new)", "Potential Audience"],
    "all_sources",
    "derived_from_available_inputs",
    "Score comparable de visibilidad.",
    "Promedio disponible de impressions/reach/audience"
  ),
  define(
    "D070",
    "platform_engagement_index",
    "Platform Engagement Index",
    "platform",
    "mention",
    "number",
    ["Likes", "Comments", "Shares", "Engagement Score"],
    "all_sources",
    "derived_from_available_inputs",
    "Score comparable de interacción.",
    "Promedio disponible de interactions + engagement"
  )
];

const authorityDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D071",
    "author_display_name",
    "Author Display Name",
    "authority",
    "mention",
    "string",
    ["Full Name", "Author"],
    "all_sources",
    "fallback_to_canonical",
    "Nombre preferido para mostrar autor.",
    "Full Name fallback Author"
  ),
  define(
    "D072",
    "author_identity_completeness_score",
    "Author Identity Completeness Score",
    "authority",
    "mention",
    "number",
    ["Author", "Full Name", "Avatar", "Author Verified Type"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Score de completitud de identidad del autor.",
    "Suma de señales de perfil"
  ),
  define(
    "D073",
    "author_scale_bucket",
    "Author Scale Bucket",
    "authority",
    "mention",
    "bucket",
    ["Instagram Followers", "X Followers", "Youtube Subscriber Count"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Bucket de escala del autor.",
    "nano/micro/mid/macro"
  ),
  define(
    "D074",
    "author_verified_or_authoritative_flag",
    "Author Verified Or Authoritative Flag",
    "authority",
    "mention",
    "boolean",
    ["X Verified", "Author Verified Type"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Marca cuentas con señal de verificación.",
    "X verified o verified type"
  ),
  define(
    "D075",
    "publication_scale_bucket",
    "Publication Scale Bucket",
    "authority",
    "mention",
    "bucket",
    ["Daily Visitors", "Total Monthly Visitors"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Bucket de escala editorial.",
    "small/medium/large/major"
  ),
  define(
    "D076",
    "publication_type_group",
    "Publication Type Group",
    "authority",
    "mention",
    "string",
    ["Pub Type", "Subtype", "Media Type", "Broadcast Type"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Agrupación editorial de tipo de publicación.",
    "news/blog/forum/broadcast/social"
  ),
  define(
    "D077",
    "publication_authority_score",
    "Publication Authority Score",
    "authority",
    "mention",
    "number",
    ["Daily Visitors", "Total Monthly Visitors", "Circulation", "Viewership"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Score de autoridad del medio.",
    "Promedio de señales de tamaño"
  ),
  define(
    "D078",
    "sponsored_or_promoted_flag",
    "Sponsored Or Promoted Flag",
    "authority",
    "mention",
    "boolean",
    ["Linkedin Sponsored"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Marca contenido patrocinado/promovido.",
    "Linkedin Sponsored"
  ),
  define(
    "D079",
    "syndication_risk_flag",
    "Syndication Risk Flag",
    "authority",
    "mention",
    "boolean",
    ["Is Syndicated", "Redacted Fields"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Marca riesgo de sindicación o edición.",
    "Is Syndicated o Redacted Fields"
  ),
  define(
    "D080",
    "source_quality_proxy",
    "Source Quality Proxy",
    "authority",
    "mention",
    "number",
    [
      "Daily Visitors",
      "Total Monthly Visitors",
      "X Verified",
      "Author Verified Type"
    ],
    "all_sources",
    "derived_from_available_inputs",
    "Proxy compuesto de calidad de fuente.",
    "Promedio de authority + verification"
  )
];

const conversationDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D081",
    "is_root_post_flag",
    "Is Root Post Flag",
    "conversation",
    "mention",
    "boolean",
    ["Parent Post Id", "Thread Entry Type"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Marca si parece post raíz.",
    "No parent y no reply"
  ),
  define(
    "D082",
    "is_reply_flag",
    "Is Reply Flag",
    "conversation",
    "mention",
    "boolean",
    ["Thread Entry Type", "X Reply to"],
    "all_sources",
    "derived_from_available_inputs",
    "Marca si parece reply/comentario.",
    "reply/comment o X Reply to"
  ),
  define(
    "D083",
    "is_repost_or_quote_flag",
    "Is Repost Or Quote Flag",
    "conversation",
    "mention",
    "boolean",
    ["X Repost of", "Threads Reposts", "Bluesky Quotes"],
    "all_sources",
    "derived_from_available_inputs",
    "Marca si parece repost/quote.",
    "Alguna señal de repost/quote"
  ),
  define(
    "D084",
    "thread_depth_proxy",
    "Thread Depth Proxy",
    "conversation",
    "mention",
    "number",
    ["Parent Post Id", "Root Post Id", "Thread Entry Type"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Profundidad aproximada del hilo.",
    "0 root, 1 reply, 2 deeper"
  ),
  define(
    "D085",
    "thread_context_completeness_score",
    "Thread Context Completeness Score",
    "conversation",
    "mention",
    "number",
    ["Thread Id", "Thread URL", "Thread Author", "Thread Created Date"],
    "thread_context_optional",
    "derived_from_available_inputs",
    "Completitud del contexto de hilo.",
    "Suma de campos thread disponibles"
  ),
  define(
    "D086",
    "thread_engagement_share",
    "Thread Engagement Share",
    "conversation",
    "thread",
    "number",
    ["Thread Id", "Likes", "Comments", "Shares"],
    "aggregate",
    "null_if_missing",
    "Participación de la fila dentro del engagement total del hilo.",
    "interactions / total interactions thread"
  ),
  define(
    "D087",
    "same_thread_volume",
    "Same Thread Volume",
    "conversation",
    "thread",
    "number",
    ["Thread Id"],
    "aggregate",
    "null_if_missing",
    "Volumen de menciones en el mismo hilo.",
    "COUNT sobre Thread Id"
  ),
  define(
    "D088",
    "same_author_day_volume",
    "Same Author Day Volume",
    "conversation",
    "author_day",
    "number",
    ["Author", "Full Name", "Date"],
    "aggregate",
    "fallback_to_zero",
    "Volumen mismo autor y día local.",
    "COUNT author/day"
  ),
  define(
    "D089",
    "same_domain_day_volume",
    "Same Domain Day Volume",
    "conversation",
    "domain_day",
    "number",
    ["Domain", "Url", "Date"],
    "aggregate",
    "fallback_to_zero",
    "Volumen mismo dominio y día local.",
    "COUNT domain/day"
  ),
  define(
    "D090",
    "same_query_platform_hour_volume",
    "Same Query Platform Hour Volume",
    "conversation",
    "query_platform_hour",
    "number",
    ["Query Id", "Page Type", "Date"],
    "aggregate",
    "null_if_missing",
    "Volumen query+plataforma+hora.",
    "COUNT query/platform/hour"
  )
];

const semanticDefinitions: InternalEnrichmentDefinition[] = [
  define(
    "D091",
    "topic_token_count",
    "Topic Token Count",
    "semantic",
    "mention",
    "number",
    ["Interest", "Professions", "Entity Info"],
    "brandwatch_export_preferred",
    "fallback_to_zero",
    "Cantidad de tokens temáticos disponibles.",
    "Conteo de items en Interest/Professions/Entity Info"
  ),
  define(
    "D092",
    "hashtag_density",
    "Hashtag Density",
    "semantic",
    "mention",
    "number",
    ["Hashtags", "Full Text"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Densidad de hashtags en el cuerpo.",
    "hashtag_count / body_length_chars"
  ),
  define(
    "D093",
    "mention_density",
    "Mention Density",
    "semantic",
    "mention",
    "number",
    ["Mentioned Authors", "Full Text"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Densidad de menciones de autores.",
    "mentioned_authors_count / body_length_chars"
  ),
  define(
    "D094",
    "url_density",
    "URL Density",
    "semantic",
    "mention",
    "number",
    ["Expanded URLs", "Media URLs", "Full Text"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Densidad de URLs sobre cuerpo.",
    "(expanded_urls_count + media_urls_count) / body_length_chars"
  ),
  define(
    "D095",
    "metadata_density_score",
    "Metadata Density Score",
    "semantic",
    "mention",
    "number",
    ["Title", "Snippet", "Full Text", "Hashtags", "Emotion"],
    "all_sources",
    "derived_from_available_inputs",
    "Cuánta metadata útil llegó con la fila.",
    "Conteo de señales no nulas"
  ),
  define(
    "D096",
    "content_richness_score",
    "Content Richness Score",
    "semantic",
    "mention",
    "number",
    [
      "Title",
      "Snippet",
      "Full Text",
      "Hashtags",
      "Mentioned Authors",
      "Media URLs"
    ],
    "all_sources",
    "derived_from_available_inputs",
    "Score de riqueza de contenido.",
    "Suma de longitud + metadatos + media"
  ),
  define(
    "D097",
    "structured_content_flag",
    "Structured Content Flag",
    "semantic",
    "mention",
    "boolean",
    ["Title", "Snippet", "Full Text", "Hashtags", "Media URLs"],
    "all_sources",
    "derived_from_available_inputs",
    "Marca filas con suficiente estructura analítica.",
    "metadata_density_score >= 3"
  ),
  define(
    "D098",
    "multi_entity_flag",
    "Multi Entity Flag",
    "semantic",
    "mention",
    "boolean",
    ["Mentioned Authors", "Expanded URLs", "Media URLs"],
    "brandwatch_export_preferred",
    "derived_from_available_inputs",
    "Marca contenido con múltiples entidades referenciadas.",
    "Suma de counts > 1"
  ),
  define(
    "D099",
    "broadcast_media_flag",
    "Broadcast Media Flag",
    "semantic",
    "mention",
    "boolean",
    ["Broadcast Type", "Air Type", "Station Name", "Broadcast Media Url"],
    "brandwatch_export_preferred",
    "null_if_missing",
    "Marca contenido con naturaleza broadcast.",
    "Alguna señal broadcast presente"
  ),
  define(
    "D100",
    "semantic_complexity_bucket",
    "Semantic Complexity Bucket",
    "semantic",
    "mention",
    "bucket",
    ["Full Text", "Hashtags", "Mentioned Authors", "Media URLs", "Entity Info"],
    "all_sources",
    "derived_from_available_inputs",
    "Bucket global de complejidad semántica.",
    "simple/standard/rich/complex"
  )
];

const internalDefinitions = [
  ...identityDefinitions,
  ...timeDefinitions,
  ...geoDefinitions,
  ...contentDefinitions,
  ...sentimentDefinitions,
  ...engagementDefinitions,
  ...platformDefinitions,
  ...authorityDefinitions,
  ...conversationDefinitions,
  ...semanticDefinitions
];

export const enrichmentDefinitions: EnrichmentDefinition[] =
  internalDefinitions.map((definition) => ({
    code: definition.code,
    slug: definition.slug,
    label: definition.label,
    category: definition.category,
    grain: definition.grain,
    valueType: definition.valueType,
    isEnabled: definition.isEnabled,
    dependsOn: definition.dependsOn,
    sourceCoverage: definition.sourceCoverage,
    nullPolicy: definition.nullPolicy,
    description: definition.description
  }));

export const enrichmentDefinitionDetails = internalDefinitions;

const definitionBySlug = new Map(
  internalDefinitions.map((definition) => [definition.slug, definition])
);

const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

const round = (value: number, digits = 4) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const enrichmentValueToString = (value: EnrichmentValue | undefined) => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return "unknown";
};

const toNumber = (value: string | number | boolean | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (!value) {
    return undefined;
  }

  const normalized = String(value)
    .replaceAll(",", "")
    .replace(/[^0-9.-]/g, "")
    .trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toBoolean = (value: string | number | boolean | null | undefined) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (!value) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "si", "sí"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  return undefined;
};

const normalizeText = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const listCount = (value: string | number | boolean | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 0;
  }

  return normalized
    .split(/[\n,;|]/g)
    .map((entry) => entry.trim())
    .filter(Boolean).length;
};

const safeDiv = (numerator?: number, denominator?: number) => {
  if (
    numerator === undefined ||
    denominator === undefined ||
    denominator === 0
  ) {
    return null;
  }
  return round(numerator / denominator);
};

const domainFromUrl = (value?: string) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
};

const pathDepthFromUrl = (value?: string) => {
  if (!value) {
    return 0;
  }
  try {
    return new URL(value).pathname.split("/").filter(Boolean).length;
  } catch {
    return 0;
  }
};

const hashValue = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24);

const getLocalParts = (isoDate: string) => {
  const date = new Date(isoDate);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "long"
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const localDate = `${get("year")}-${get("month")}-${get("day")}`;
  const localHour = Number(get("hour") || 0);
  const localWeekday = get("weekday").toLowerCase();
  const localDayPart =
    localHour < 6
      ? "madrugada"
      : localHour < 12
        ? "mañana"
        : localHour < 18
          ? "tarde"
          : "noche";

  return {
    localDate,
    localHour,
    localWeekday,
    localDayPart
  };
};

const getSourceClass = (pageType?: string, source?: string) => {
  const normalized = normalizeText(pageType)?.toLowerCase();
  if (normalized === "news") {
    return "news";
  }
  if (["blog", "forum"].includes(normalized ?? "")) {
    return "web";
  }
  if (normalized) {
    return "social";
  }
  return source ?? "social";
};

const getPlatformFamily = (pageType?: string, contentSourceName?: string) => {
  const normalized = (
    normalizeText(contentSourceName) ??
    normalizeText(pageType) ??
    "unknown"
  )
    .toLowerCase()
    .replaceAll("public", "")
    .replaceAll("__", "_")
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (normalized.includes("twitter") || normalized === "x") {
    return "X";
  }
  if (normalized.includes("facebook")) {
    return "Facebook";
  }
  if (normalized.includes("instagram")) {
    return "Instagram";
  }
  if (normalized.includes("reddit")) {
    return "Reddit";
  }
  if (normalized.includes("youtube")) {
    return "YouTube";
  }
  if (normalized.includes("bluesky")) {
    return "Bluesky";
  }
  if (normalized.includes("threads")) {
    return "Threads";
  }
  if (normalized.includes("tiktok")) {
    return "Tiktok";
  }
  if (normalized.includes("linkedin")) {
    return "Linkedin";
  }
  if (normalized.includes("news")) {
    return "News";
  }
  if (normalized.includes("blog")) {
    return "Blog";
  }
  if (normalized.includes("forum")) {
    return "Forum";
  }
  return "Other";
};

const normalizeSentimentScore = (sentiment: NormalizedMention["sentiment"]) => {
  switch (sentiment) {
    case "positive":
      return 1;
    case "negative":
      return -1;
    case "mixed":
      return -0.5;
    default:
      return 0;
  }
};

const bucketLength = (length: number) => {
  if (length < 80) {
    return "short";
  }
  if (length < 280) {
    return "medium";
  }
  if (length < 800) {
    return "long";
  }
  return "very_long";
};

const bucketScale = (value?: number) => {
  if (value === undefined) {
    return null;
  }
  if (value < 1000) {
    return "nano";
  }
  if (value < 10000) {
    return "micro";
  }
  if (value < 100000) {
    return "mid";
  }
  return "macro";
};

const stringSimilarity = (left?: string, right?: string) => {
  const leftTokens = new Set(
    normalizeText(left)
      ?.toLowerCase()
      .match(/[a-záéíóúñ0-9]+/gi) ?? []
  );
  const rightTokens = new Set(
    normalizeText(right)
      ?.toLowerCase()
      .match(/[a-záéíóúñ0-9]+/gi) ?? []
  );

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return null;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  return round(intersection / leftTokens.size);
};

const normalizeMarketBucket = (country?: string, language?: string) => {
  const normalizedCountry = normalizeText(country)?.toLowerCase();
  if (!normalizedCountry) {
    return language === "es" ? "LatAm" : "Unknown";
  }
  if (normalizedCountry === "puerto rico") {
    return "Puerto Rico";
  }
  if (normalizedCountry.includes("united states")) {
    return "US";
  }
  if (
    [
      "spain",
      "united kingdom",
      "netherlands",
      "france",
      "italy",
      "germany",
      "switzerland"
    ].includes(normalizedCountry)
  ) {
    return "Europe";
  }
  if (
    [
      "mexico",
      "panama",
      "ecuador",
      "costa rica",
      "honduras",
      "paraguay",
      "uruguay",
      "nicaragua",
      "brazil",
      "dominica",
      "canada"
    ].includes(normalizedCountry)
  ) {
    return "LatAm";
  }
  return "Other";
};

const getRollupWindowKey = (
  window: EnrichmentWindow,
  mention: EnrichedMention
) => {
  switch (window) {
    case "24h":
      return "rolling_24h";
    case "7d":
      return "rolling_7d";
    case "batch":
      return mention.enrichmentMeta?.batchId ?? "no-batch";
  }
};

const buildAggregateMaps = (records: MentionEnrichmentSeed[]) => {
  const authorDayCounts = new Map<string, number>();
  const domainDayCounts = new Map<string, number>();
  const queryPlatformHourCounts = new Map<string, number>();
  const threadCounts = new Map<string, number>();
  const threadEngagementTotals = new Map<string, number>();

  for (const record of records) {
    const { localDate, localHour } = getLocalParts(record.mention.occurredAt);
    const rawPayload = record.rawPayload ?? {};
    const authorKey = `${normalizeText(rawPayload["Full Name"]) ?? record.mention.authorName}|${localDate}`;
    const domainKey = `${normalizeText(rawPayload.Domain) ?? domainFromUrl(record.mention.url) ?? "unknown"}|${localDate}`;
    const queryPlatformKey = `${normalizeText(rawPayload["Query Id"]) ?? record.queryId ?? "unknown"}|${normalizeText(rawPayload["Page Type"]) ?? record.mention.channel}|${localDate}|${localHour}`;
    const threadKey =
      normalizeText(rawPayload["Thread Id"]) ??
      normalizeText(rawPayload["Thread URL"]) ??
      `no-thread|${record.mention.id}`;
    const totalInteractions =
      (record.mention.engagement.likes ?? 0) +
      (record.mention.engagement.comments ?? 0) +
      (record.mention.engagement.shares ?? 0);

    authorDayCounts.set(authorKey, (authorDayCounts.get(authorKey) ?? 0) + 1);
    domainDayCounts.set(domainKey, (domainDayCounts.get(domainKey) ?? 0) + 1);
    queryPlatformHourCounts.set(
      queryPlatformKey,
      (queryPlatformHourCounts.get(queryPlatformKey) ?? 0) + 1
    );
    threadCounts.set(threadKey, (threadCounts.get(threadKey) ?? 0) + 1);
    threadEngagementTotals.set(
      threadKey,
      (threadEngagementTotals.get(threadKey) ?? 0) + totalInteractions
    );
  }

  return {
    authorDayCounts,
    domainDayCounts,
    queryPlatformHourCounts,
    threadCounts,
    threadEngagementTotals
  };
};

const createContext = (
  record: MentionEnrichmentSeed,
  aggregateMaps: ReturnType<typeof buildAggregateMaps>
): MentionEnrichmentContext => {
  const rawPayload = record.rawPayload ?? {};
  const { localDate, localHour, localWeekday, localDayPart } = getLocalParts(
    record.mention.occurredAt
  );
  const authorKey = `${normalizeText(rawPayload["Full Name"]) ?? record.mention.authorName}|${localDate}`;
  const normalizedUrlHost =
    normalizeText(rawPayload.Domain) ?? domainFromUrl(record.mention.url);
  const domainKey = `${normalizedUrlHost ?? "unknown"}|${localDate}`;
  const queryPlatformKey = `${normalizeText(rawPayload["Query Id"]) ?? record.queryId ?? "unknown"}|${normalizeText(rawPayload["Page Type"]) ?? record.mention.channel}|${localDate}|${localHour}`;
  const threadKey =
    normalizeText(rawPayload["Thread Id"]) ??
    normalizeText(rawPayload["Thread URL"]) ??
    `no-thread|${record.mention.id}`;
  const currentInteractions =
    (record.mention.engagement.likes ?? 0) +
    (record.mention.engagement.comments ?? 0) +
    (record.mention.engagement.shares ?? 0);
  const threadTotal =
    aggregateMaps.threadEngagementTotals.get(threadKey) ?? currentInteractions;

  return {
    ...record,
    localDate,
    localHour,
    localWeekday,
    localDayPart,
    normalizedUrlHost,
    sameAuthorDayVolume: aggregateMaps.authorDayCounts.get(authorKey) ?? 0,
    sameDomainDayVolume: aggregateMaps.domainDayCounts.get(domainKey) ?? 0,
    sameQueryPlatformHourVolume:
      aggregateMaps.queryPlatformHourCounts.get(queryPlatformKey) ?? 0,
    sameThreadVolume: aggregateMaps.threadCounts.get(threadKey) ?? 0,
    threadEngagementShare: safeDiv(currentInteractions, threadTotal) ?? 1
  };
};

const rawText = (context: MentionEnrichmentContext, key: string) =>
  normalizeText(context.rawPayload?.[key]);

const rawNumber = (context: MentionEnrichmentContext, key: string) =>
  toNumber(context.rawPayload?.[key]);

const rawBoolean = (context: MentionEnrichmentContext, key: string) =>
  toBoolean(context.rawPayload?.[key]);

const canonicalTextBody = (context: MentionEnrichmentContext) =>
  rawText(context, "Full Text") ??
  rawText(context, "Snippet") ??
  context.mention.body;

const getNormalizedLikes = (context: MentionEnrichmentContext) =>
  rawNumber(context, "Likes") ??
  rawNumber(context, "Facebook Likes") ??
  rawNumber(context, "Instagram Likes") ??
  rawNumber(context, "X Likes") ??
  rawNumber(context, "Youtube Likes") ??
  rawNumber(context, "Threads Likes") ??
  rawNumber(context, "Bluesky Likes") ??
  context.mention.engagement.likes ??
  0;

const getNormalizedComments = (context: MentionEnrichmentContext) =>
  rawNumber(context, "Comments") ??
  rawNumber(context, "Facebook Comments") ??
  rawNumber(context, "Instagram Comments") ??
  rawNumber(context, "Youtube Comments") ??
  rawNumber(context, "Linkedin Comments") ??
  rawNumber(context, "Reddit Comments") ??
  rawNumber(context, "Threads Replies") ??
  context.mention.engagement.comments ??
  0;

const getNormalizedShares = (context: MentionEnrichmentContext) =>
  rawNumber(context, "Shares") ??
  rawNumber(context, "Facebook Shares") ??
  rawNumber(context, "X Reposts") ??
  rawNumber(context, "Threads Shares") ??
  rawNumber(context, "Threads Reposts") ??
  rawNumber(context, "Bluesky Reposts") ??
  context.mention.engagement.shares ??
  0;

const getNormalizedViews = (context: MentionEnrichmentContext) =>
  rawNumber(context, "Impressions") ??
  rawNumber(context, "Threads Views") ??
  rawNumber(context, "Tiktok Views") ??
  rawNumber(context, "Resource Views") ??
  context.mention.engagement.impressions ??
  0;

const getNormalizedFollowers = (context: MentionEnrichmentContext) =>
  rawNumber(context, "Instagram Followers") ??
  rawNumber(context, "X Followers") ??
  rawNumber(context, "Youtube Subscriber Count") ??
  rawNumber(context, "Bluesky Followers") ??
  0;

const getNormalizedPosts = (context: MentionEnrichmentContext) =>
  rawNumber(context, "Instagram Posts") ??
  rawNumber(context, "X Posts") ??
  rawNumber(context, "Bluesky Posts") ??
  rawNumber(context, "Youtube Video Count") ??
  0;

const computeEnrichmentValue = (
  context: MentionEnrichmentContext,
  slug: string
): EnrichmentValue => {
  const body = canonicalTextBody(context);
  const normalizedLikes = getNormalizedLikes(context);
  const normalizedComments = getNormalizedComments(context);
  const normalizedShares = getNormalizedShares(context);
  const normalizedViews = getNormalizedViews(context);
  const normalizedFollowers = getNormalizedFollowers(context);
  const normalizedPosts = getNormalizedPosts(context);
  const totalInteractions =
    normalizedLikes + normalizedComments + normalizedShares;
  const potentialAudience = rawNumber(context, "Potential Audience");
  const reach = rawNumber(context, "Reach (new)");
  const impact = rawNumber(context, "Impact");
  const engagementScore = rawNumber(context, "Engagement Score");
  const dailyVisitors = rawNumber(context, "Daily Visitors");
  const totalMonthlyVisitors = rawNumber(context, "Total Monthly Visitors");
  const country = rawText(context, "Country");
  const language = rawText(context, "Language") ?? context.mention.language;
  const sentimentScore = normalizeSentimentScore(context.mention.sentiment);
  const emotion = rawText(context, "Emotion")?.toLowerCase();
  const metadataDensity = [
    rawText(context, "Title"),
    rawText(context, "Snippet"),
    rawText(context, "Full Text"),
    rawText(context, "Hashtags"),
    rawText(context, "Emotion"),
    rawText(context, "Media URLs"),
    rawText(context, "Expanded URLs")
  ].filter(Boolean).length;

  switch (slug) {
    case "canonical_external_key":
      return (
        rawText(context, "Mention Id") ??
        rawText(context, "Resource Id") ??
        context.mention.url
      );
    case "external_key_source":
      return rawText(context, "Mention Id")
        ? "mention_id"
        : rawText(context, "Resource Id")
          ? "resource_id"
          : "url";
    case "mention_trace_key": {
      const canonicalExternalKey = computeEnrichmentValue(
        context,
        "canonical_external_key"
      );
      return `${rawText(context, "Query Id") ?? context.queryId ?? "unknown"}|${enrichmentValueToString(
        canonicalExternalKey
      )}`;
    }
    case "normalized_url_host":
      return context.normalizedUrlHost ?? null;
    case "normalized_url_path_depth":
      return pathDepthFromUrl(context.mention.url);
    case "has_original_url_flag":
      return Boolean(rawText(context, "Original Url"));
    case "has_thread_context_flag":
      return Boolean(
        rawText(context, "Thread Id") ?? rawText(context, "Thread URL")
      );
    case "has_publication_context_flag":
      return Boolean(
        rawText(context, "Publication Id") ??
        rawText(context, "Publication Name")
      );
    case "has_platform_author_id_flag":
      return Boolean(
        rawText(context, "Facebook Author ID") ??
        rawText(context, "X Author ID") ??
        rawText(context, "Bluesky Author Id")
      );
    case "dedup_fingerprint":
      return hashValue(
        [
          rawText(context, "Page Type") ?? context.mention.channel,
          rawText(context, "Author") ?? context.mention.authorName,
          context.localDate,
          context.normalizedUrlHost ?? "no-host",
          rawText(context, "Title") ?? context.mention.title ?? ""
        ].join("|")
      );
    case "occurred_hour_pr":
      return context.localHour;
    case "occurred_weekday_pr":
      return context.localWeekday;
    case "occurred_is_weekend_flag":
      return ["saturday", "sunday"].includes(context.localWeekday);
    case "occurred_daypart":
      return context.localDayPart;
    case "business_hours_flag":
      return context.localHour >= 8 && context.localHour < 18;
    case "capture_latency_minutes": {
      const occurredAt = new Date(context.mention.occurredAt).getTime();
      const receivedAt = new Date(context.mention.receivedAt).getTime();
      return round((receivedAt - occurredAt) / 60000, 2);
    }
    case "freshness_bucket": {
      const latency = Number(
        computeEnrichmentValue(context, "capture_latency_minutes") ?? 0
      );
      if (latency < 15) return "0-15m";
      if (latency < 60) return "15-60m";
      if (latency < 360) return "1-6h";
      if (latency < 1440) return "6-24h";
      return "24h+";
    }
    case "report_window_progress_pct": {
      const from = normalizeText(context.rawPayload?.From);
      const to = normalizeText(context.rawPayload?.To);
      if (!from || !to) {
        return null;
      }
      const denominator = new Date(to).getTime() - new Date(from).getTime();
      if (!denominator) {
        return null;
      }
      return round(
        (new Date(context.mention.occurredAt).getTime() -
          new Date(from).getTime()) /
          denominator
      );
    }
    case "same_platform_hour_bucket":
      return `${getPlatformFamily(rawText(context, "Page Type"), rawText(context, "Content Source Name"))}|${context.localDate}|${String(
        context.localHour
      ).padStart(2, "0")}`;
    case "same_query_day_bucket":
      return `${rawText(context, "Query Id") ?? context.queryId ?? "unknown"}|${context.localDate}`;
    case "geo_known_flag":
      return Boolean(
        country ??
        rawText(context, "Region") ??
        rawText(context, "City") ??
        rawNumber(context, "Latitude") ??
        rawNumber(context, "Longitude")
      );
    case "geo_granularity_level":
      return rawNumber(context, "Latitude") !== undefined &&
        rawNumber(context, "Longitude") !== undefined
        ? "latlon"
        : rawText(context, "City")
          ? "city"
          : rawText(context, "Region")
            ? "region"
            : country
              ? "country"
              : "unknown";
    case "is_puerto_rico_flag":
      return country?.toLowerCase() === "puerto rico";
    case "is_us_flag":
      return Boolean(country?.toLowerCase().includes("united states"));
    case "is_hispanic_market_flag":
      return (
        normalizeMarketBucket(country, language) === "LatAm" ||
        language === "es"
      );
    case "geo_market_bucket":
      return normalizeMarketBucket(country, language);
    case "country_region_city_key":
      return [
        country ?? "unknown",
        rawText(context, "Region") ?? "unknown",
        rawText(context, "City") ?? "unknown"
      ].join("|");
    case "has_coordinates_flag":
      return (
        rawNumber(context, "Latitude") !== undefined &&
        rawNumber(context, "Longitude") !== undefined
      );
    case "location_precision_score": {
      const granularity = computeEnrichmentValue(
        context,
        "geo_granularity_level"
      );
      return granularity === "latlon"
        ? 3
        : granularity === "city"
          ? 2
          : granularity === "region"
            ? 1
            : granularity === "country"
              ? 0.5
              : 0;
    }
    case "language_geo_alignment_flag":
      return country?.toLowerCase() === "spain" ||
        country?.toLowerCase() === "puerto rico" ||
        language !== "es"
        ? true
        : null;
    case "body_length_chars":
      return body.length;
    case "body_length_bucket":
      return bucketLength(body.length);
    case "title_present_flag":
      return Boolean(rawText(context, "Title") ?? context.mention.title);
    case "snippet_present_flag":
      return Boolean(rawText(context, "Snippet"));
    case "full_text_present_flag":
      return Boolean(
        rawText(context, "Full Text") ?? rawBoolean(context, "Has Full Text")
      );
    case "title_body_overlap_ratio":
      return stringSimilarity(
        rawText(context, "Title") ?? context.mention.title,
        body
      );
    case "hashtag_count":
      return listCount(rawText(context, "Hashtags"));
    case "mentioned_authors_count":
      return listCount(rawText(context, "Mentioned Authors"));
    case "media_urls_count":
      return listCount(rawText(context, "Media URLs"));
    case "expanded_urls_count":
      return listCount(rawText(context, "Expanded URLs"));
    case "sentiment_score":
      return sentimentScore;
    case "non_neutral_flag":
      return context.mention.sentiment !== "neutral";
    case "negative_flag":
      return context.mention.sentiment === "negative";
    case "positive_flag":
      return context.mention.sentiment === "positive";
    case "emotion_present_flag":
      return Boolean(emotion);
    case "emotion_category_normalized":
      return emotion ?? null;
    case "sentiment_emotion_alignment_flag":
      if (!emotion) return null;
      return (
        (context.mention.sentiment === "negative" &&
          ["fear", "anger", "sadness"].includes(emotion)) ||
        (context.mention.sentiment === "positive" &&
          ["joy", "trust", "surprise"].includes(emotion))
      );
    case "risk_base_score":
      return round(
        (context.mention.sentiment === "negative" ? 2 : 0) +
          (emotion ? 1 : 0) +
          (rawBoolean(context, "Reportable") ? 1 : 0),
        2
      );
    case "criticality_proxy_score":
      return round(
        Number(computeEnrichmentValue(context, "risk_base_score") ?? 0) +
          (context.mention.priority === "critical"
            ? 2
            : context.mention.priority === "high"
              ? 1
              : 0) +
          (engagementScore ?? 0) / 10,
        2
      );
    case "editorial_attention_flag":
      return Boolean(
        context.mention.sentiment === "negative" ||
        rawBoolean(context, "Reportable") ||
        rawBoolean(context, "Starred") ||
        rawBoolean(context, "Checked")
      );
    case "total_interactions_base":
      return totalInteractions;
    case "interaction_rate_impressions":
      return safeDiv(totalInteractions, normalizedViews);
    case "interaction_rate_reach":
      return safeDiv(totalInteractions, reach);
    case "interaction_rate_audience":
      return safeDiv(totalInteractions, potentialAudience);
    case "virality_ratio":
      return safeDiv(normalizedShares, normalizedComments);
    case "amplification_ratio":
      return safeDiv(normalizedShares, normalizedLikes);
    case "conversation_ratio":
      return safeDiv(normalizedComments, normalizedLikes);
    case "reach_efficiency_score":
      return safeDiv(reach, potentialAudience);
    case "impact_per_interaction":
      return safeDiv(impact, totalInteractions);
    case "earned_attention_index":
      return round(
        [
          normalizedViews > 0 ? clamp(normalizedViews / 100000) : null,
          reach !== undefined ? clamp(reach / 100000) : null,
          impact !== undefined ? clamp(impact / 100) : null,
          engagementScore !== undefined ? clamp(engagementScore / 100) : null
        ]
          .filter((value): value is number => value !== null)
          .reduce((sum, value, _, arr) => sum + value / arr.length, 0),
        4
      );
    case "source_class":
      return getSourceClass(
        rawText(context, "Page Type"),
        context.mention.source
      );
    case "platform_family":
      return getPlatformFamily(
        rawText(context, "Page Type"),
        rawText(context, "Content Source Name")
      );
    case "normalized_likes":
      return normalizedLikes;
    case "normalized_comments":
      return normalizedComments;
    case "normalized_shares":
      return normalizedShares;
    case "normalized_views":
      return normalizedViews;
    case "normalized_followers":
      return normalizedFollowers;
    case "normalized_posts":
      return normalizedPosts;
    case "platform_visibility_index":
      return round(
        [
          normalizedViews > 0 ? clamp(normalizedViews / 100000) : null,
          reach !== undefined ? clamp(reach / 100000) : null,
          potentialAudience !== undefined
            ? clamp(potentialAudience / 100000)
            : null
        ]
          .filter((value): value is number => value !== null)
          .reduce((sum, value, _, arr) => sum + value / arr.length, 0),
        4
      );
    case "platform_engagement_index":
      return round(
        [
          totalInteractions > 0 ? clamp(totalInteractions / 1000) : null,
          engagementScore !== undefined ? clamp(engagementScore / 100) : null
        ]
          .filter((value): value is number => value !== null)
          .reduce((sum, value, _, arr) => sum + value / arr.length, 0),
        4
      );
    case "author_display_name":
      return rawText(context, "Full Name") ?? context.mention.authorName;
    case "author_identity_completeness_score":
      return [
        rawText(context, "Author"),
        rawText(context, "Full Name"),
        rawText(context, "Avatar"),
        rawText(context, "Author Verified Type")
      ].filter(Boolean).length;
    case "author_scale_bucket":
      return bucketScale(normalizedFollowers);
    case "author_verified_or_authoritative_flag":
      return Boolean(
        rawBoolean(context, "X Verified") ??
        rawText(context, "Author Verified Type")
      );
    case "publication_scale_bucket":
      return bucketScale(totalMonthlyVisitors ?? dailyVisitors);
    case "publication_type_group":
      return (
        rawText(context, "Pub Type") ??
        rawText(context, "Subtype") ??
        rawText(context, "Media Type") ??
        rawText(context, "Broadcast Type") ??
        getPlatformFamily(rawText(context, "Page Type"))
      );
    case "publication_authority_score":
      return round(
        [
          dailyVisitors !== undefined ? clamp(dailyVisitors / 100000) : null,
          totalMonthlyVisitors !== undefined
            ? clamp(totalMonthlyVisitors / 1000000)
            : null,
          rawNumber(context, "Circulation") !== undefined
            ? clamp((rawNumber(context, "Circulation") ?? 0) / 100000)
            : null,
          rawNumber(context, "Viewership") !== undefined
            ? clamp((rawNumber(context, "Viewership") ?? 0) / 100000)
            : null
        ]
          .filter((value): value is number => value !== null)
          .reduce((sum, value, _, arr) => sum + value / arr.length, 0),
        4
      );
    case "sponsored_or_promoted_flag":
      return rawBoolean(context, "Linkedin Sponsored") ?? false;
    case "syndication_risk_flag":
      return (
        (rawBoolean(context, "Is Syndicated") ?? false) ||
        rawText(context, "Redacted Fields") !== undefined
      );
    case "source_quality_proxy":
      return round(
        [
          Number(
            computeEnrichmentValue(context, "publication_authority_score") ?? 0
          ),
          Number(
            computeEnrichmentValue(
              context,
              "author_identity_completeness_score"
            ) ?? 0
          ) / 4,
          computeEnrichmentValue(
            context,
            "author_verified_or_authoritative_flag"
          ) === true
            ? 1
            : 0
        ].reduce((sum, value) => sum + value, 0) / 3,
        4
      );
    case "is_root_post_flag":
      return (
        !rawText(context, "Parent Post Id") &&
        computeEnrichmentValue(context, "is_reply_flag") !== true
      );
    case "is_reply_flag":
      return (
        ["reply", "comment"].includes(
          rawText(context, "Thread Entry Type")?.toLowerCase() ?? ""
        ) || rawText(context, "X Reply to") !== undefined
      );
    case "is_repost_or_quote_flag":
      return (
        rawText(context, "X Repost of") !== undefined ||
        rawNumber(context, "Threads Reposts") !== undefined ||
        rawNumber(context, "Bluesky Quotes") !== undefined
      );
    case "thread_depth_proxy":
      return computeEnrichmentValue(context, "is_repost_or_quote_flag") === true
        ? 2
        : computeEnrichmentValue(context, "is_reply_flag") === true
          ? 1
          : 0;
    case "thread_context_completeness_score":
      return [
        rawText(context, "Thread Id"),
        rawText(context, "Thread URL"),
        rawText(context, "Thread Author"),
        rawText(context, "Thread Created Date")
      ].filter(Boolean).length;
    case "thread_engagement_share":
      return round(context.threadEngagementShare, 4);
    case "same_thread_volume":
      return context.sameThreadVolume;
    case "same_author_day_volume":
      return context.sameAuthorDayVolume;
    case "same_domain_day_volume":
      return context.sameDomainDayVolume;
    case "same_query_platform_hour_volume":
      return context.sameQueryPlatformHourVolume;
    case "topic_token_count":
      return (
        listCount(rawText(context, "Interest")) +
        listCount(rawText(context, "Professions")) +
        listCount(rawText(context, "Entity Info"))
      );
    case "hashtag_density":
      return safeDiv(
        Number(computeEnrichmentValue(context, "hashtag_count")),
        body.length
      );
    case "mention_density":
      return safeDiv(
        Number(computeEnrichmentValue(context, "mentioned_authors_count")),
        body.length
      );
    case "url_density":
      return safeDiv(
        Number(computeEnrichmentValue(context, "expanded_urls_count")) +
          Number(computeEnrichmentValue(context, "media_urls_count")),
        body.length
      );
    case "metadata_density_score":
      return metadataDensity;
    case "content_richness_score":
      return round(
        metadataDensity +
          clamp(body.length / 1000) +
          clamp(
            (Number(computeEnrichmentValue(context, "hashtag_count")) +
              Number(
                computeEnrichmentValue(context, "mentioned_authors_count")
              ) +
              Number(computeEnrichmentValue(context, "media_urls_count"))) /
              10
          ),
        4
      );
    case "structured_content_flag":
      return metadataDensity >= 3;
    case "multi_entity_flag":
      return (
        Number(computeEnrichmentValue(context, "mentioned_authors_count")) +
          Number(computeEnrichmentValue(context, "expanded_urls_count")) +
          Number(computeEnrichmentValue(context, "media_urls_count")) >
        1
      );
    case "broadcast_media_flag":
      return Boolean(
        rawText(context, "Broadcast Type") ??
        rawText(context, "Air Type") ??
        rawText(context, "Station Name") ??
        rawText(context, "Broadcast Media Url")
      );
    case "semantic_complexity_bucket": {
      const richness = Number(
        computeEnrichmentValue(context, "content_richness_score") ?? 0
      );
      if (richness < 2) return "simple";
      if (richness < 4) return "standard";
      if (richness < 6) return "rich";
      return "complex";
    }
    default:
      return null;
  }
};

const filterEnabledValues = (
  values: Record<string, EnrichmentValue>,
  includeDisabled = false
) => {
  if (includeDisabled) {
    return values;
  }

  const filteredEntries = Object.entries(values).filter(
    ([slug]) => definitionBySlug.get(slug)?.isEnabled
  );
  return Object.fromEntries(filteredEntries);
};

export const buildEnrichedMentions = (
  records: MentionEnrichmentSeed[],
  includeDisabled = false
): EnrichedMention[] => {
  const aggregateMaps = buildAggregateMaps(records);

  return records.map((record) => {
    const context = createContext(record, aggregateMaps);
    const enrichments = Object.fromEntries(
      internalDefinitions.map((definition) => [
        definition.slug,
        computeEnrichmentValue(context, definition.slug)
      ])
    );

    return {
      ...record.mention,
      enrichments: filterEnabledValues(enrichments, includeDisabled),
      enrichmentMeta: {
        batchId: record.batchId,
        queryId: record.queryId,
        windowKeys: {
          batch: record.batchId,
          "24h": `${context.localDate}|24h`,
          "7d": `${context.localDate}|7d`
        }
      }
    };
  });
};

export const buildEnrichmentRollups = (
  records: EnrichedMention[],
  filters: EnrichmentRollupFilters
): EnrichmentRollup[] => {
  const scoped = records.filter((record) => {
    if (filters.agencyId && record.agencyId !== filters.agencyId) {
      return false;
    }
    if (filters.window === "batch" && filters.batchId) {
      return record.enrichmentMeta?.batchId === filters.batchId;
    }
    const occurred = new Date(record.occurredAt).getTime();
    const nowValue = Date.now();
    if (filters.window === "24h") {
      return occurred >= nowValue - 24 * 60 * 60 * 1000;
    }
    if (filters.window === "7d") {
      return occurred >= nowValue - 7 * 24 * 60 * 60 * 1000;
    }
    return true;
  });

  const grouped = new Map<string, EnrichedMention[]>();
  for (const record of scoped) {
    const groupValue =
      filters.groupBy === "import_batch_id"
        ? (record.enrichmentMeta?.batchId ?? "no-batch")
        : filters.groupBy === "source_query_id"
          ? (record.enrichmentMeta?.queryId ?? "no-query")
          : enrichmentValueToString(record.enrichments[filters.groupBy]);
    const key = `${record.agencyId}|${filters.groupBy}|${groupValue}|${getRollupWindowKey(filters.window, record)}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(record);
    grouped.set(key, bucket);
  }

  const rollups: EnrichmentRollup[] = [];

  for (const [key, bucket] of grouped.entries()) {
    const [agencyId, groupBy, groupKey] = key.split("|");
    const riskValues = bucket
      .map((record) => Number(record.enrichments.risk_base_score ?? 0))
      .filter(Number.isFinite);
    const earnedAttentionValues = bucket
      .map((record) => Number(record.enrichments.earned_attention_index ?? 0))
      .filter(Number.isFinite);
    const latencyValues = bucket
      .map((record) => Number(record.enrichments.capture_latency_minutes ?? 0))
      .filter(Number.isFinite);
    const interactionValues = bucket
      .map((record) => Number(record.enrichments.total_interactions_base ?? 0))
      .filter(Number.isFinite);
    const visibilityValues = bucket
      .map((record) =>
        Number(record.enrichments.platform_visibility_index ?? 0)
      )
      .filter(Number.isFinite);

    const avg = (values: number[]) =>
      values.length === 0
        ? null
        : round(
            values.reduce((sum, value) => sum + value, 0) / values.length,
            4
          );

    rollups.push({
      agencyId,
      batchId:
        filters.window === "batch"
          ? bucket[0]?.enrichmentMeta?.batchId
          : undefined,
      queryId:
        filters.groupBy === "source_query_id"
          ? groupKey
          : bucket[0]?.enrichmentMeta?.queryId,
      groupBy: groupBy as EnrichmentGroupBy,
      groupKey,
      values: {
        mention_count: bucket.length,
        negative_count: bucket.filter(
          (record) => record.sentiment === "negative"
        ).length,
        positive_count: bucket.filter(
          (record) => record.sentiment === "positive"
        ).length,
        critical_count: bucket.filter((record) => record.isCritical).length,
        avg_risk_base_score: avg(riskValues),
        avg_earned_attention_index: avg(earnedAttentionValues),
        avg_capture_latency_minutes: avg(latencyValues),
        avg_total_interactions_base: avg(interactionValues),
        sum_total_interactions_base: round(
          interactionValues.reduce((sum, value) => sum + value, 0),
          4
        ),
        avg_platform_visibility_index: avg(visibilityValues)
      },
      window: filters.window
    });
  }

  return rollups.sort((left, right) =>
    left.groupKey.localeCompare(right.groupKey)
  );
};

export const renderEnrichmentCatalogMarkdown = () => {
  const categories = new Map<
    EnrichmentCategory,
    InternalEnrichmentDefinition[]
  >();
  for (const definition of internalDefinitions) {
    const bucket = categories.get(definition.category) ?? [];
    bucket.push(definition);
    categories.set(definition.category, bucket);
  }

  const lines = [
    "# Catálogo de Enrichments",
    "",
    `- Total de derivadas: \`${internalDefinitions.length}\``,
    `- Zona horaria de negocio: \`${TIME_ZONE}\``,
    ""
  ];

  for (const [category, definitions] of categories.entries()) {
    lines.push(`## ${category}`);
    lines.push("");
    lines.push(
      "| Code | Slug | Tipo | Grain | Coverage | Depends On | Descripción |"
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const definition of definitions) {
      lines.push(
        `| ${definition.code} | ${definition.slug} | ${definition.valueType} | ${definition.grain} | ${definition.sourceCoverage} | ${definition.dependsOn.join(", ")} | ${definition.description} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
};

export const renderEnrichmentFormulasMarkdown = () => {
  const lines = [
    "# Fórmulas de Enrichments",
    "",
    "| Code | Slug | Fórmula | Política de nulos |",
    "| --- | --- | --- | --- |"
  ];

  for (const definition of internalDefinitions) {
    lines.push(
      `| ${definition.code} | ${definition.slug} | ${definition.formulaSummary} | ${definition.nullPolicy} |`
    );
  }

  return lines.join("\n");
};

export const getRollupMetricSlugs = () => [...ROLLUP_METRICS];

const sqlTextFromRaw = (key: string) =>
  `NULLIF(raw.raw_payload->>'${key.replaceAll("'", "''")}', '')`;

const sqlNumberFromRaw = (key: string) =>
  `NULLIF(REGEXP_REPLACE(COALESCE(raw.raw_payload->>'${key.replaceAll("'", "''")}', ''), '[^0-9.\\-]', '', 'g'), '')::double precision`;

const sqlBooleanFromRaw = (key: string) =>
  `CASE
    WHEN LOWER(COALESCE(raw.raw_payload->>'${key.replaceAll("'", "''")}', '')) IN ('true','1','yes','y','si','sí') THEN TRUE
    WHEN LOWER(COALESCE(raw.raw_payload->>'${key.replaceAll("'", "''")}', '')) IN ('false','0','no','n') THEN FALSE
    ELSE NULL
  END`;

const sqlSafeDiv = (numerator: string, denominator: string) =>
  `CASE WHEN ${denominator} IS NULL OR ${denominator} = 0 THEN NULL ELSE ROUND(((${numerator})::numeric / NULLIF((${denominator})::numeric, 0)), 4) END`;

const sqlListCount = (expression: string) =>
  `CASE
    WHEN ${expression} IS NULL OR ${expression} = '' THEN 0
    ELSE CARDINALITY(REGEXP_SPLIT_TO_ARRAY(${expression}, E'[\\n,;|]+'))
  END`;

const sqlPlatformFamily = `
CASE
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%twitter%' OR LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) = 'x' THEN 'X'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%facebook%' THEN 'Facebook'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%instagram%' THEN 'Instagram'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%reddit%' THEN 'Reddit'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%youtube%' THEN 'YouTube'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%bluesky%' THEN 'Bluesky'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%threads%' THEN 'Threads'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%tiktok%' THEN 'Tiktok'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%linkedin%' THEN 'Linkedin'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%news%' THEN 'News'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%blog%' THEN 'Blog'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Content Source Name")}, ${sqlTextFromRaw("Page Type")}, m.channel, '')) LIKE '%forum%' THEN 'Forum'
  ELSE 'Other'
END`;

const sqlSourceClass = `
CASE
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Page Type")}, m.channel, '')) = 'news' THEN 'news'
  WHEN LOWER(COALESCE(${sqlTextFromRaw("Page Type")}, m.channel, '')) IN ('blog', 'forum') THEN 'web'
  ELSE COALESCE(m.source, 'social')
END`;

const sqlCanonicalExternalKey = `COALESCE(${sqlTextFromRaw("Mention Id")}, ${sqlTextFromRaw("Resource Id")}, m.external_id, m.url)`;
const sqlBodyCanonical = `COALESCE(${sqlTextFromRaw("Full Text")}, ${sqlTextFromRaw("Snippet")}, m.body, COALESCE(m.title, ''))`;
const sqlNormalizedUrlHost = `LOWER(COALESCE(p.domain, REGEXP_REPLACE(SPLIT_PART(REGEXP_REPLACE(m.url, '^https?://', ''), '/', 1), '^www\\.', '')))`;
const sqlNormalizedUrlPathDepth = `GREATEST(CARDINALITY(REGEXP_SPLIT_TO_ARRAY(TRIM(BOTH '/' FROM COALESCE(REGEXP_REPLACE(m.url, '^https?://[^/]+', ''), '')), '/')), 0)`;
const sqlOccurredAtPr = `TIMEZONE('${TIME_ZONE}', m.occurred_at)`;
const sqlLocalDate = `TO_CHAR(${sqlOccurredAtPr}, 'YYYY-MM-DD')`;
const sqlLocalHour = `EXTRACT(HOUR FROM ${sqlOccurredAtPr})::int`;
const sqlLocalWeekday = `LOWER(TRIM(TO_CHAR(${sqlOccurredAtPr}, 'Day')))`;
const sqlLocalDayPart = `CASE WHEN ${sqlLocalHour} < 6 THEN 'madrugada' WHEN ${sqlLocalHour} < 12 THEN 'mañana' WHEN ${sqlLocalHour} < 18 THEN 'tarde' ELSE 'noche' END`;

const sqlEnrichmentBaseExpressions: Record<string, string> = {
  canonical_external_key: sqlCanonicalExternalKey,
  external_key_source: `CASE WHEN ${sqlTextFromRaw("Mention Id")} IS NOT NULL THEN 'mention_id' WHEN ${sqlTextFromRaw("Resource Id")} IS NOT NULL THEN 'resource_id' ELSE 'url' END`,
  mention_trace_key: `COALESCE(raw.query_id, sq.external_id, 'unknown') || '|' || ${sqlCanonicalExternalKey}`,
  normalized_url_host: sqlNormalizedUrlHost,
  normalized_url_path_depth: sqlNormalizedUrlPathDepth,
  has_original_url_flag: `(${sqlTextFromRaw("Original Url")} IS NOT NULL)`,
  has_thread_context_flag: `(${sqlTextFromRaw("Thread Id")} IS NOT NULL OR ${sqlTextFromRaw("Thread URL")} IS NOT NULL)`,
  has_publication_context_flag: `(${sqlTextFromRaw("Publication Id")} IS NOT NULL OR COALESCE(p.name, ${sqlTextFromRaw("Publication Name")}) IS NOT NULL)`,
  has_platform_author_id_flag: `(${sqlTextFromRaw("Facebook Author ID")} IS NOT NULL OR ${sqlTextFromRaw("X Author ID")} IS NOT NULL OR ${sqlTextFromRaw("Bluesky Author Id")} IS NOT NULL)`,
  dedup_fingerprint: `SUBSTRING(MD5(COALESCE(${sqlTextFromRaw("Page Type")}, m.channel, '') || '|' || COALESCE(${sqlTextFromRaw("Author")}, m.author_name, '') || '|' || ${sqlLocalDate} || '|' || COALESCE(${sqlNormalizedUrlHost}, '') || '|' || COALESCE(${sqlTextFromRaw("Title")}, m.title, '')), 1, 24)`,
  occurred_hour_pr: sqlLocalHour,
  occurred_weekday_pr: sqlLocalWeekday,
  occurred_is_weekend_flag: `${sqlLocalWeekday} IN ('saturday', 'sunday')`,
  occurred_daypart: sqlLocalDayPart,
  business_hours_flag: `(${sqlLocalHour} >= 8 AND ${sqlLocalHour} < 18)`,
  capture_latency_minutes: `ROUND(EXTRACT(EPOCH FROM (m.received_at - m.occurred_at)) / 60.0, 2)`,
  freshness_bucket: `CASE WHEN ROUND(EXTRACT(EPOCH FROM (m.received_at - m.occurred_at)) / 60.0, 2) < 15 THEN '0-15m' WHEN ROUND(EXTRACT(EPOCH FROM (m.received_at - m.occurred_at)) / 60.0, 2) < 60 THEN '15-60m' WHEN ROUND(EXTRACT(EPOCH FROM (m.received_at - m.occurred_at)) / 60.0, 2) < 360 THEN '1-6h' WHEN ROUND(EXTRACT(EPOCH FROM (m.received_at - m.occurred_at)) / 60.0, 2) < 1440 THEN '6-24h' ELSE '24h+' END`,
  report_window_progress_pct: `NULL`,
  same_platform_hour_bucket: `${sqlPlatformFamily} || '|' || ${sqlLocalDate} || '|' || LPAD(${sqlLocalHour}::text, 2, '0')`,
  same_query_day_bucket: `COALESCE(raw.query_id, sq.external_id, 'unknown') || '|' || ${sqlLocalDate}`,
  geo_known_flag: `(COALESCE(g.country, ${sqlTextFromRaw("Country")}, g.region, ${sqlTextFromRaw("Region")}, g.city, ${sqlTextFromRaw("City")}) IS NOT NULL OR (COALESCE(g.latitude, ${sqlNumberFromRaw("Latitude")}) IS NOT NULL AND COALESCE(g.longitude, ${sqlNumberFromRaw("Longitude")}) IS NOT NULL))`,
  geo_granularity_level: `CASE WHEN COALESCE(g.latitude, ${sqlNumberFromRaw("Latitude")}) IS NOT NULL AND COALESCE(g.longitude, ${sqlNumberFromRaw("Longitude")}) IS NOT NULL THEN 'latlon' WHEN COALESCE(g.city, ${sqlTextFromRaw("City")}) IS NOT NULL THEN 'city' WHEN COALESCE(g.region, ${sqlTextFromRaw("Region")}) IS NOT NULL THEN 'region' WHEN COALESCE(g.country, ${sqlTextFromRaw("Country")}) IS NOT NULL THEN 'country' ELSE 'unknown' END`,
  is_puerto_rico_flag: `LOWER(COALESCE(g.country, ${sqlTextFromRaw("Country")}, '')) = 'puerto rico'`,
  is_us_flag: `LOWER(COALESCE(g.country, ${sqlTextFromRaw("Country")}, '')) LIKE '%united states%'`,
  is_hispanic_market_flag: `(LOWER(COALESCE(g.country, ${sqlTextFromRaw("Country")}, '')) IN ('puerto rico','mexico','panama','ecuador','costa rica','honduras','paraguay','uruguay','nicaragua','spain','brazil') OR COALESCE(m.language, ${sqlTextFromRaw("Language")}) = 'es')`,
  geo_market_bucket: `CASE WHEN LOWER(COALESCE(g.country, ${sqlTextFromRaw("Country")}, '')) = 'puerto rico' THEN 'Puerto Rico' WHEN LOWER(COALESCE(g.country, ${sqlTextFromRaw("Country")}, '')) LIKE '%united states%' THEN 'US' WHEN LOWER(COALESCE(g.country, ${sqlTextFromRaw("Country")}, '')) IN ('spain','united kingdom','netherlands','france','italy','germany','switzerland') THEN 'Europe' WHEN LOWER(COALESCE(g.country, ${sqlTextFromRaw("Country")}, '')) IN ('mexico','panama','ecuador','costa rica','honduras','paraguay','uruguay','nicaragua','brazil','dominica','canada') THEN 'LatAm' WHEN COALESCE(m.language, ${sqlTextFromRaw("Language")}) = 'es' THEN 'LatAm' ELSE 'Unknown' END`,
  country_region_city_key: `COALESCE(g.country, ${sqlTextFromRaw("Country")}, 'unknown') || '|' || COALESCE(g.region, ${sqlTextFromRaw("Region")}, 'unknown') || '|' || COALESCE(g.city, ${sqlTextFromRaw("City")}, 'unknown')`,
  has_coordinates_flag: `(COALESCE(g.latitude, ${sqlNumberFromRaw("Latitude")}) IS NOT NULL AND COALESCE(g.longitude, ${sqlNumberFromRaw("Longitude")}) IS NOT NULL)`,
  location_precision_score: `CASE WHEN COALESCE(g.latitude, ${sqlNumberFromRaw("Latitude")}) IS NOT NULL AND COALESCE(g.longitude, ${sqlNumberFromRaw("Longitude")}) IS NOT NULL THEN 3 WHEN COALESCE(g.city, ${sqlTextFromRaw("City")}) IS NOT NULL THEN 2 WHEN COALESCE(g.region, ${sqlTextFromRaw("Region")}) IS NOT NULL THEN 1 WHEN COALESCE(g.country, ${sqlTextFromRaw("Country")}) IS NOT NULL THEN 0.5 ELSE 0 END`,
  language_geo_alignment_flag: `CASE WHEN COALESCE(g.country, ${sqlTextFromRaw("Country")}) IS NULL THEN NULL ELSE TRUE END`,
  body_length_chars: `LENGTH(${sqlBodyCanonical})`,
  body_length_bucket: `CASE WHEN LENGTH(${sqlBodyCanonical}) < 80 THEN 'short' WHEN LENGTH(${sqlBodyCanonical}) < 280 THEN 'medium' WHEN LENGTH(${sqlBodyCanonical}) < 800 THEN 'long' ELSE 'very_long' END`,
  title_present_flag: `(COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NOT NULL)`,
  snippet_present_flag: `(${sqlTextFromRaw("Snippet")} IS NOT NULL)`,
  full_text_present_flag: `(${sqlTextFromRaw("Full Text")} IS NOT NULL OR ${sqlBooleanFromRaw("Has Full Text")} = TRUE)`,
  title_body_overlap_ratio: `CASE WHEN COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NULL THEN NULL WHEN POSITION(LOWER(COALESCE(${sqlTextFromRaw("Title")}, m.title)) IN LOWER(${sqlBodyCanonical})) > 0 THEN 1.0 ELSE 0.0 END`,
  hashtag_count: sqlListCount(sqlTextFromRaw("Hashtags")),
  mentioned_authors_count: sqlListCount(sqlTextFromRaw("Mentioned Authors")),
  media_urls_count: sqlListCount(sqlTextFromRaw("Media URLs")),
  expanded_urls_count: sqlListCount(sqlTextFromRaw("Expanded URLs")),
  sentiment_score: `CASE WHEN m.sentiment = 'positive' THEN 1 WHEN m.sentiment = 'negative' THEN -1 WHEN m.sentiment = 'mixed' THEN -0.5 ELSE 0 END`,
  non_neutral_flag: `(m.sentiment <> 'neutral')`,
  negative_flag: `(m.sentiment = 'negative')`,
  positive_flag: `(m.sentiment = 'positive')`,
  emotion_present_flag: `(${sqlTextFromRaw("Emotion")} IS NOT NULL)`,
  emotion_category_normalized: `LOWER(${sqlTextFromRaw("Emotion")})`,
  sentiment_emotion_alignment_flag: `CASE WHEN ${sqlTextFromRaw("Emotion")} IS NULL THEN NULL WHEN m.sentiment = 'negative' AND LOWER(${sqlTextFromRaw("Emotion")}) IN ('fear','anger','sadness') THEN TRUE WHEN m.sentiment = 'positive' AND LOWER(${sqlTextFromRaw("Emotion")}) IN ('joy','trust','surprise') THEN TRUE ELSE FALSE END`,
  risk_base_score: `ROUND(((CASE WHEN m.sentiment = 'negative' THEN 2 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlBooleanFromRaw("Reportable")} = TRUE THEN 1 ELSE 0 END))::numeric, 2)`,
  criticality_proxy_score: `ROUND((((CASE WHEN m.sentiment = 'negative' THEN 2 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlBooleanFromRaw("Reportable")} = TRUE THEN 1 ELSE 0 END)) + (CASE WHEN m.priority = 'critical' THEN 2 WHEN m.priority = 'high' THEN 1 ELSE 0 END) + COALESCE(${sqlNumberFromRaw("Engagement Score")}, 0) / 10.0)::numeric, 2)`,
  editorial_attention_flag: `(m.sentiment = 'negative' OR ${sqlBooleanFromRaw("Reportable")} = TRUE OR ${sqlBooleanFromRaw("Starred")} = TRUE OR ${sqlBooleanFromRaw("Checked")} = TRUE)`,
  total_interactions_base: `COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)`,
  interaction_rate_impressions: sqlSafeDiv(
    `COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)`,
    `COALESCE((m.engagement->>'impressions')::double precision, 0)`
  ),
  interaction_rate_reach: sqlSafeDiv(
    `COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)`,
    `${sqlNumberFromRaw("Reach (new)")}`
  ),
  interaction_rate_audience: sqlSafeDiv(
    `COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)`,
    `${sqlNumberFromRaw("Potential Audience")}`
  ),
  virality_ratio: sqlSafeDiv(
    `COALESCE((m.engagement->>'shares')::double precision, 0)`,
    `COALESCE((m.engagement->>'comments')::double precision, 0)`
  ),
  amplification_ratio: sqlSafeDiv(
    `COALESCE((m.engagement->>'shares')::double precision, 0)`,
    `COALESCE((m.engagement->>'likes')::double precision, 0)`
  ),
  conversation_ratio: sqlSafeDiv(
    `COALESCE((m.engagement->>'comments')::double precision, 0)`,
    `COALESCE((m.engagement->>'likes')::double precision, 0)`
  ),
  reach_efficiency_score: sqlSafeDiv(
    `${sqlNumberFromRaw("Reach (new)")}`,
    `${sqlNumberFromRaw("Potential Audience")}`
  ),
  impact_per_interaction: sqlSafeDiv(
    `${sqlNumberFromRaw("Impact")}`,
    `COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)`
  ),
  earned_attention_index: `ROUND(((COALESCE((m.engagement->>'impressions')::double precision, 0) / 100000.0) + (COALESCE(${sqlNumberFromRaw("Reach (new)")}, 0) / 100000.0) + (COALESCE(${sqlNumberFromRaw("Impact")}, 0) / 100.0) + (COALESCE(${sqlNumberFromRaw("Engagement Score")}, 0) / 100.0))::numeric / 4, 4)`,
  source_class: sqlSourceClass,
  platform_family: sqlPlatformFamily,
  normalized_likes: `COALESCE(${sqlNumberFromRaw("Likes")}, ${sqlNumberFromRaw("Facebook Likes")}, ${sqlNumberFromRaw("Instagram Likes")}, ${sqlNumberFromRaw("X Likes")}, ${sqlNumberFromRaw("Youtube Likes")}, ${sqlNumberFromRaw("Threads Likes")}, ${sqlNumberFromRaw("Bluesky Likes")}, (m.engagement->>'likes')::double precision, 0)`,
  normalized_comments: `COALESCE(${sqlNumberFromRaw("Comments")}, ${sqlNumberFromRaw("Facebook Comments")}, ${sqlNumberFromRaw("Instagram Comments")}, ${sqlNumberFromRaw("Youtube Comments")}, ${sqlNumberFromRaw("Linkedin Comments")}, ${sqlNumberFromRaw("Reddit Comments")}, ${sqlNumberFromRaw("Threads Replies")}, (m.engagement->>'comments')::double precision, 0)`,
  normalized_shares: `COALESCE(${sqlNumberFromRaw("Shares")}, ${sqlNumberFromRaw("Facebook Shares")}, ${sqlNumberFromRaw("X Reposts")}, ${sqlNumberFromRaw("Threads Shares")}, ${sqlNumberFromRaw("Threads Reposts")}, ${sqlNumberFromRaw("Bluesky Reposts")}, (m.engagement->>'shares')::double precision, 0)`,
  normalized_views: `COALESCE(${sqlNumberFromRaw("Impressions")}, ${sqlNumberFromRaw("Threads Views")}, ${sqlNumberFromRaw("Tiktok Views")}, ${sqlNumberFromRaw("Resource Views")}, (m.engagement->>'impressions')::double precision, 0)`,
  normalized_followers: `COALESCE(${sqlNumberFromRaw("Instagram Followers")}, ${sqlNumberFromRaw("X Followers")}, ${sqlNumberFromRaw("Youtube Subscriber Count")}, ${sqlNumberFromRaw("Bluesky Followers")}, 0)`,
  normalized_posts: `COALESCE(${sqlNumberFromRaw("Instagram Posts")}, ${sqlNumberFromRaw("X Posts")}, ${sqlNumberFromRaw("Bluesky Posts")}, ${sqlNumberFromRaw("Youtube Video Count")}, 0)`,
  platform_visibility_index: `ROUND(((COALESCE(${sqlNumberFromRaw("Impressions")}, (m.engagement->>'impressions')::double precision, 0) / 100000.0) + (COALESCE(${sqlNumberFromRaw("Reach (new)")}, 0) / 100000.0) + (COALESCE(${sqlNumberFromRaw("Potential Audience")}, 0) / 100000.0))::numeric / 3, 4)`,
  platform_engagement_index: `ROUND((((COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)) / 1000.0) + (COALESCE(${sqlNumberFromRaw("Engagement Score")}, 0) / 100.0))::numeric / 2, 4)`,
  author_display_name: `COALESCE(a.full_name, ${sqlTextFromRaw("Full Name")}, m.author_name)`,
  author_identity_completeness_score: `((CASE WHEN COALESCE(${sqlTextFromRaw("Author")}, m.author_name) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN COALESCE(a.full_name, ${sqlTextFromRaw("Full Name")}) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN COALESCE(a.avatar_url, ${sqlTextFromRaw("Avatar")}) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN COALESCE(a.verified_type, ${sqlTextFromRaw("Author Verified Type")}) IS NOT NULL THEN 1 ELSE 0 END))`,
  author_scale_bucket: `CASE WHEN COALESCE(${sqlNumberFromRaw("Instagram Followers")}, ${sqlNumberFromRaw("X Followers")}, ${sqlNumberFromRaw("Youtube Subscriber Count")}, ${sqlNumberFromRaw("Bluesky Followers")}) IS NULL THEN NULL WHEN COALESCE(${sqlNumberFromRaw("Instagram Followers")}, ${sqlNumberFromRaw("X Followers")}, ${sqlNumberFromRaw("Youtube Subscriber Count")}, ${sqlNumberFromRaw("Bluesky Followers")}) < 1000 THEN 'nano' WHEN COALESCE(${sqlNumberFromRaw("Instagram Followers")}, ${sqlNumberFromRaw("X Followers")}, ${sqlNumberFromRaw("Youtube Subscriber Count")}, ${sqlNumberFromRaw("Bluesky Followers")}) < 10000 THEN 'micro' WHEN COALESCE(${sqlNumberFromRaw("Instagram Followers")}, ${sqlNumberFromRaw("X Followers")}, ${sqlNumberFromRaw("Youtube Subscriber Count")}, ${sqlNumberFromRaw("Bluesky Followers")}) < 100000 THEN 'mid' ELSE 'macro' END`,
  author_verified_or_authoritative_flag: `(${sqlBooleanFromRaw("X Verified")} = TRUE OR COALESCE(a.verified_type, ${sqlTextFromRaw("Author Verified Type")}) IS NOT NULL)`,
  publication_scale_bucket: `CASE WHEN COALESCE(p.total_monthly_visitors, ${sqlNumberFromRaw("Total Monthly Visitors")}, p.daily_visitors, ${sqlNumberFromRaw("Daily Visitors")}) IS NULL THEN NULL WHEN COALESCE(p.total_monthly_visitors, ${sqlNumberFromRaw("Total Monthly Visitors")}, p.daily_visitors, ${sqlNumberFromRaw("Daily Visitors")}) < 1000 THEN 'nano' WHEN COALESCE(p.total_monthly_visitors, ${sqlNumberFromRaw("Total Monthly Visitors")}, p.daily_visitors, ${sqlNumberFromRaw("Daily Visitors")}) < 10000 THEN 'micro' WHEN COALESCE(p.total_monthly_visitors, ${sqlNumberFromRaw("Total Monthly Visitors")}, p.daily_visitors, ${sqlNumberFromRaw("Daily Visitors")}) < 100000 THEN 'mid' ELSE 'macro' END`,
  publication_type_group: `COALESCE(p.pub_type, ${sqlTextFromRaw("Pub Type")}, ${sqlTextFromRaw("Subtype")}, ${sqlTextFromRaw("Media Type")}, ${sqlTextFromRaw("Broadcast Type")}, ${sqlPlatformFamily})`,
  publication_authority_score: `ROUND(((COALESCE(p.daily_visitors, ${sqlNumberFromRaw("Daily Visitors")}, 0) / 100000.0) + (COALESCE(p.total_monthly_visitors, ${sqlNumberFromRaw("Total Monthly Visitors")}, 0) / 1000000.0) + (COALESCE(${sqlNumberFromRaw("Circulation")}, 0) / 100000.0) + (COALESCE(${sqlNumberFromRaw("Viewership")}, 0) / 100000.0))::numeric / 4, 4)`,
  sponsored_or_promoted_flag: `(${sqlBooleanFromRaw("Linkedin Sponsored")} = TRUE)`,
  syndication_risk_flag: `(${sqlBooleanFromRaw("Is Syndicated")} = TRUE OR ${sqlTextFromRaw("Redacted Fields")} IS NOT NULL)`,
  source_quality_proxy: `ROUND((((COALESCE(p.daily_visitors, ${sqlNumberFromRaw("Daily Visitors")}, 0) / 100000.0) + (COALESCE(p.total_monthly_visitors, ${sqlNumberFromRaw("Total Monthly Visitors")}, 0) / 1000000.0) + (COALESCE(${sqlNumberFromRaw("Circulation")}, 0) / 100000.0) + (COALESCE(${sqlNumberFromRaw("Viewership")}, 0) / 100000.0)) / 4 + (((CASE WHEN COALESCE(${sqlTextFromRaw("Author")}, m.author_name) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN COALESCE(a.full_name, ${sqlTextFromRaw("Full Name")}) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN COALESCE(a.avatar_url, ${sqlTextFromRaw("Avatar")}) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN COALESCE(a.verified_type, ${sqlTextFromRaw("Author Verified Type")}) IS NOT NULL THEN 1 ELSE 0 END)) / 4.0) + (CASE WHEN ${sqlBooleanFromRaw("X Verified")} = TRUE OR COALESCE(a.verified_type, ${sqlTextFromRaw("Author Verified Type")}) IS NOT NULL THEN 1 ELSE 0 END))::numeric / 3, 4)`,
  is_root_post_flag: `(${sqlTextFromRaw("Parent Post Id")} IS NULL AND NOT (LOWER(COALESCE(${sqlTextFromRaw("Thread Entry Type")}, '')) IN ('reply','comment') OR ${sqlTextFromRaw("X Reply to")} IS NOT NULL))`,
  is_reply_flag: `(LOWER(COALESCE(${sqlTextFromRaw("Thread Entry Type")}, '')) IN ('reply','comment') OR ${sqlTextFromRaw("X Reply to")} IS NOT NULL)`,
  is_repost_or_quote_flag: `(${sqlTextFromRaw("X Repost of")} IS NOT NULL OR ${sqlNumberFromRaw("Threads Reposts")} IS NOT NULL OR ${sqlNumberFromRaw("Bluesky Quotes")} IS NOT NULL)`,
  thread_depth_proxy: `CASE WHEN ${sqlTextFromRaw("X Repost of")} IS NOT NULL OR ${sqlNumberFromRaw("Threads Reposts")} IS NOT NULL OR ${sqlNumberFromRaw("Bluesky Quotes")} IS NOT NULL THEN 2 WHEN (LOWER(COALESCE(${sqlTextFromRaw("Thread Entry Type")}, '')) IN ('reply','comment') OR ${sqlTextFromRaw("X Reply to")} IS NOT NULL) THEN 1 ELSE 0 END`,
  thread_context_completeness_score: `((CASE WHEN ${sqlTextFromRaw("Thread Id")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Thread URL")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Thread Author")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Thread Created Date")} IS NOT NULL THEN 1 ELSE 0 END))`,
  thread_engagement_share: sqlSafeDiv(
    `COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)`,
    `SUM(COALESCE((m.engagement->>'likes')::double precision, 0) + COALESCE((m.engagement->>'comments')::double precision, 0) + COALESCE((m.engagement->>'shares')::double precision, 0)) OVER (PARTITION BY COALESCE(${sqlTextFromRaw("Thread Id")}, ${sqlTextFromRaw("Thread URL")}, m.id))`
  ),
  same_thread_volume: `COUNT(*) OVER (PARTITION BY COALESCE(${sqlTextFromRaw("Thread Id")}, ${sqlTextFromRaw("Thread URL")}, m.id))`,
  same_author_day_volume: `COUNT(*) OVER (PARTITION BY m.agency_id, COALESCE(a.full_name, m.author_name), ${sqlLocalDate})`,
  same_domain_day_volume: `COUNT(*) OVER (PARTITION BY m.agency_id, ${sqlNormalizedUrlHost}, ${sqlLocalDate})`,
  same_query_platform_hour_volume: `COUNT(*) OVER (PARTITION BY m.agency_id, COALESCE(raw.query_id, sq.external_id), ${sqlPlatformFamily}, ${sqlLocalDate}, ${sqlLocalHour})`,
  topic_token_count: `(${sqlListCount(sqlTextFromRaw("Interest"))} + ${sqlListCount(sqlTextFromRaw("Professions"))} + ${sqlListCount(sqlTextFromRaw("Entity Info"))})`,
  hashtag_density: sqlSafeDiv(
    `${sqlListCount(sqlTextFromRaw("Hashtags"))}`,
    `LENGTH(${sqlBodyCanonical})`
  ),
  mention_density: sqlSafeDiv(
    `${sqlListCount(sqlTextFromRaw("Mentioned Authors"))}`,
    `LENGTH(${sqlBodyCanonical})`
  ),
  url_density: sqlSafeDiv(
    `(${sqlListCount(sqlTextFromRaw("Expanded URLs"))} + ${sqlListCount(sqlTextFromRaw("Media URLs"))})`,
    `LENGTH(${sqlBodyCanonical})`
  ),
  metadata_density_score: `((CASE WHEN COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Snippet")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Full Text")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Hashtags")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Media URLs")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Expanded URLs")} IS NOT NULL THEN 1 ELSE 0 END))`,
  content_richness_score: `ROUND((((CASE WHEN COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Snippet")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Full Text")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Hashtags")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Media URLs")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Expanded URLs")} IS NOT NULL THEN 1 ELSE 0 END)) + LEAST(LENGTH(${sqlBodyCanonical}) / 1000.0, 1.0) + LEAST(((${sqlListCount(sqlTextFromRaw("Hashtags"))} + ${sqlListCount(sqlTextFromRaw("Mentioned Authors"))} + ${sqlListCount(sqlTextFromRaw("Media URLs"))}) / 10.0), 1.0))::numeric, 4)`,
  structured_content_flag: `(((CASE WHEN COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Snippet")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Full Text")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Hashtags")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Media URLs")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Expanded URLs")} IS NOT NULL THEN 1 ELSE 0 END)) >= 3)`,
  multi_entity_flag: `((${sqlListCount(sqlTextFromRaw("Mentioned Authors"))} + ${sqlListCount(sqlTextFromRaw("Expanded URLs"))} + ${sqlListCount(sqlTextFromRaw("Media URLs"))}) > 1)`,
  broadcast_media_flag: `(${sqlTextFromRaw("Broadcast Type")} IS NOT NULL OR ${sqlTextFromRaw("Air Type")} IS NOT NULL OR ${sqlTextFromRaw("Station Name")} IS NOT NULL OR ${sqlTextFromRaw("Broadcast Media Url")} IS NOT NULL)`,
  semantic_complexity_bucket: `CASE WHEN (((CASE WHEN COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Snippet")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Full Text")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Hashtags")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Media URLs")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Expanded URLs")} IS NOT NULL THEN 1 ELSE 0 END)) + LEAST(LENGTH(${sqlBodyCanonical}) / 1000.0, 1.0)) < 2 THEN 'simple' WHEN (((CASE WHEN COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Snippet")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Full Text")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Hashtags")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Media URLs")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Expanded URLs")} IS NOT NULL THEN 1 ELSE 0 END)) + LEAST(LENGTH(${sqlBodyCanonical}) / 1000.0, 1.0)) < 4 THEN 'standard' WHEN (((CASE WHEN COALESCE(${sqlTextFromRaw("Title")}, m.title) IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Snippet")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Full Text")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Hashtags")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Emotion")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Media URLs")} IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN ${sqlTextFromRaw("Expanded URLs")} IS NOT NULL THEN 1 ELSE 0 END)) + LEAST(LENGTH(${sqlBodyCanonical}) / 1000.0, 1.0)) < 6 THEN 'rich' ELSE 'complex' END`
};

export const buildMentionEnrichedViewSql = () => {
  const aliasSelects = internalDefinitions.map(
    (definition) =>
      `        ${sqlEnrichmentBaseExpressions[definition.slug] ?? "NULL"} AS ${definition.slug}`
  );
  const jsonPairs = internalDefinitions.flatMap((definition) => [
    `'${definition.slug}'`,
    `base.${definition.slug}`
  ]);

  return `
CREATE OR REPLACE VIEW mention_enriched_v1 AS
WITH raw_latest AS (
  SELECT DISTINCT ON (mention_id)
    mention_id,
    import_batch_id,
    query_id,
    page_type,
    content_source_name,
    raw_payload,
    created_at
  FROM mention_raw_rows
  ORDER BY mention_id, created_at DESC
),
base AS (
  SELECT
    m.id,
    m.agency_id,
    m.external_id,
    m.source,
    m.source_system,
    m.channel,
    m.title,
    m.body,
    m.url,
    m.language,
    m.sentiment,
    m.priority,
    m.author_name,
    m.author_handle,
    m.topics,
    m.keywords,
    m.is_critical,
    m.occurred_at,
    m.received_at,
    m.raw_object_key,
    m.engagement,
    COALESCE(raw.import_batch_id, m.import_batch_id) AS import_batch_id,
    COALESCE(raw.query_id, sq.external_id) AS source_query_id,
    COALESCE(g.country, ${sqlTextFromRaw("Country")}) AS country,
    ${sqlLocalDate} AS local_date_key,
    raw.raw_payload,
    a.full_name AS joined_author_full_name,
    a.avatar_url AS joined_author_avatar_url,
    a.verified_type AS joined_author_verified_type,
    p.name AS joined_publication_name,
    p.domain AS joined_domain,
    p.page_type AS joined_page_type,
    p.pub_type AS joined_pub_type,
    p.daily_visitors AS joined_daily_visitors,
    p.total_monthly_visitors AS joined_total_monthly_visitors,
    g.country AS joined_country,
    g.region AS joined_region,
    g.city AS joined_city,
    g.latitude AS joined_latitude,
    g.longitude AS joined_longitude,
${aliasSelects.join(",\n")}
  FROM mentions m
  LEFT JOIN raw_latest raw ON raw.mention_id = m.id
  LEFT JOIN source_queries sq ON sq.id = m.source_query_id
  LEFT JOIN authors a ON a.id = m.author_id
  LEFT JOIN publications p ON p.id = m.publication_id
  LEFT JOIN geographies g ON g.id = m.geography_id
)
SELECT
  base.id,
  base.agency_id,
  base.external_id,
  base.source,
  base.source_system,
  base.channel,
  base.title,
  base.body,
  base.url,
  base.language,
  base.sentiment,
  base.priority,
  base.author_name,
  base.author_handle,
  base.topics,
  base.keywords,
  base.is_critical,
  base.occurred_at,
  base.received_at,
  base.raw_object_key,
  base.engagement,
  base.import_batch_id,
  base.source_query_id,
  base.country,
  base.local_date_key,
  JSONB_STRIP_NULLS(JSONB_BUILD_OBJECT(${jsonPairs.join(", ")})) AS enrichments,
  JSONB_BUILD_OBJECT(
    'batchId', base.import_batch_id,
    'queryId', base.source_query_id,
    'windowKeys', JSONB_BUILD_OBJECT(
      'batch', base.import_batch_id,
      '24h', base.local_date_key || '|24h',
      '7d', base.local_date_key || '|7d'
    )
  ) AS enrichment_meta
FROM base;
`.trim();
};

const buildRollupViewSql = (window: EnrichmentWindow, whereClause: string) => {
  const groups: EnrichmentGroupBy[] = [
    "platform_family",
    "source_class",
    "sentiment",
    "language",
    "country",
    "import_batch_id",
    "source_query_id"
  ];

  const groupQueries = groups.map((groupBy) => {
    const groupExpression =
      groupBy === "platform_family"
        ? `COALESCE(enrichments->>'platform_family', 'unknown')`
        : groupBy === "source_class"
          ? `COALESCE(enrichments->>'source_class', 'unknown')`
          : groupBy === "country"
            ? `COALESCE(country, 'Unknown')`
            : groupBy === "import_batch_id"
              ? `COALESCE(import_batch_id, 'no-batch')`
              : groupBy === "source_query_id"
                ? `COALESCE(source_query_id, 'no-query')`
                : `COALESCE(${groupBy}, 'unknown')`;

    return `
    SELECT
      agency_id,
      import_batch_id AS batch_id,
      source_query_id AS query_id,
      '${groupBy}'::text AS group_by,
      ${groupExpression} AS group_key,
      JSONB_BUILD_OBJECT(
        'mention_count', COUNT(*),
        'negative_count', COUNT(*) FILTER (WHERE sentiment = 'negative'),
        'positive_count', COUNT(*) FILTER (WHERE sentiment = 'positive'),
        'critical_count', COUNT(*) FILTER (WHERE is_critical = TRUE),
        'avg_risk_base_score', ROUND(AVG(NULLIF(enrichments->>'risk_base_score', '')::double precision)::numeric, 4),
        'avg_earned_attention_index', ROUND(AVG(NULLIF(enrichments->>'earned_attention_index', '')::double precision)::numeric, 4),
        'avg_capture_latency_minutes', ROUND(AVG(NULLIF(enrichments->>'capture_latency_minutes', '')::double precision)::numeric, 4),
        'avg_total_interactions_base', ROUND(AVG(NULLIF(enrichments->>'total_interactions_base', '')::double precision)::numeric, 4),
        'sum_total_interactions_base', ROUND(SUM(NULLIF(enrichments->>'total_interactions_base', '')::double precision)::numeric, 4),
        'avg_platform_visibility_index', ROUND(AVG(NULLIF(enrichments->>'platform_visibility_index', '')::double precision)::numeric, 4)
      ) AS values
    FROM mention_enriched_v1
    ${whereClause}
    GROUP BY agency_id, import_batch_id, source_query_id, ${groupExpression}
    `;
  });

  return `
CREATE OR REPLACE VIEW mention_rollup_${window}_v1 AS
${groupQueries.join("\nUNION ALL\n")}
;`.trim();
};

export const buildRollup24hViewSql = () =>
  buildRollupViewSql("24h", `WHERE occurred_at >= NOW() - INTERVAL '24 hours'`);

export const buildRollup7dViewSql = () =>
  buildRollupViewSql("7d", `WHERE occurred_at >= NOW() - INTERVAL '7 days'`);

export const buildRollupBatchViewSql = () =>
  buildRollupViewSql("batch", `WHERE import_batch_id IS NOT NULL`);
