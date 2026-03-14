# Fórmulas de Enrichments

| Code | Slug                                  | Fórmula                                                      | Política de nulos             |
| ---- | ------------------------------------- | ------------------------------------------------------------ | ----------------------------- | ---- | --------------- |
| D001 | canonical_external_key                | COALESCE(Mention Id, Resource Id, Url)                       | fallback_to_canonical         |
| D002 | external_key_source                   | Etiqueta cuál fallback produjo la clave                      | fallback_to_canonical         |
| D003 | mention_trace_key                     | Query Id + canonical_external_key                            | fallback_to_canonical         |
| D004 | normalized_url_host                   | Host canonizado desde URL                                    | fallback_to_canonical         |
| D005 | normalized_url_path_depth             | Conteo de segmentos en path                                  | fallback_to_zero              |
| D006 | has_original_url_flag                 | Original Url no vacío                                        | null_if_missing               |
| D007 | has_thread_context_flag               | Thread Id o Thread URL presentes                             | derived_from_available_inputs |
| D008 | has_publication_context_flag          | Publication Id o Publication Name presentes                  | derived_from_available_inputs |
| D009 | has_platform_author_id_flag           | Cualquier author id por plataforma                           | derived_from_available_inputs |
| D010 | dedup_fingerprint                     | Hash de plataforma, autor, fecha, host y título              | fallback_to_canonical         |
| D011 | occurred_hour_pr                      | EXTRACT(HOUR FROM occurred_at at America/Puerto_Rico)        | fallback_to_canonical         |
| D012 | occurred_weekday_pr                   | Nombre de weekday local                                      | fallback_to_canonical         |
| D013 | occurred_is_weekend_flag              | Weekday en sábado/domingo                                    | fallback_to_canonical         |
| D014 | occurred_daypart                      | Bucket madrugada/mañana/tarde/noche                          | fallback_to_canonical         |
| D015 | business_hours_flag                   | Hora local entre 08 y 18                                     | fallback_to_canonical         |
| D016 | capture_latency_minutes               | Minutos entre occurredAt y receivedAt                        | fallback_to_canonical         |
| D017 | freshness_bucket                      | 0-15m, 15-60m, 1-6h, 6-24h, 24h+                             | fallback_to_canonical         |
| D018 | report_window_progress_pct            | (Date-From)/(To-From)                                        | null_if_missing               |
| D019 | same_platform_hour_bucket             | Page Type + YYYY-MM-DD HH                                    | fallback_to_canonical         |
| D020 | same_query_day_bucket                 | Query Id + fecha local                                       | null_if_missing               |
| D021 | geo_known_flag                        | Algún campo geo no nulo                                      | derived_from_available_inputs |
| D022 | geo_granularity_level                 | country/region/city/latlon/unknown                           | null_if_missing               |
| D023 | is_puerto_rico_flag                   | Country = Puerto Rico                                        | derived_from_available_inputs |
| D024 | is_us_flag                            | Country contiene United States                               | derived_from_available_inputs |
| D025 | is_hispanic_market_flag               | País hispano o idioma es                                     | derived_from_available_inputs |
| D026 | geo_market_bucket                     | Puerto Rico/US/LatAm/Europe/Other/Unknown                    | derived_from_available_inputs |
| D027 | country_region_city_key               | Country                                                      | Region                        | City | null_if_missing |
| D028 | has_coordinates_flag                  | Latitude y Longitude presentes                               | null_if_missing               |
| D029 | location_precision_score              | 0 a 3 según precisión                                        | derived_from_available_inputs |
| D030 | language_geo_alignment_flag           | Idioma compatible con mercado dominante                      | derived_from_available_inputs |
| D031 | body_length_chars                     | LEN(body canónico)                                           | fallback_to_canonical         |
| D032 | body_length_bucket                    | short/medium/long/very_long                                  | fallback_to_canonical         |
| D033 | title_present_flag                    | Title no vacío                                               | fallback_to_canonical         |
| D034 | snippet_present_flag                  | Snippet no vacío                                             | derived_from_available_inputs |
| D035 | full_text_present_flag                | Full Text o flag Has Full Text                               | derived_from_available_inputs |
| D036 | title_body_overlap_ratio              | Tokens compartidos / tokens de título                        | null_if_missing               |
| D037 | hashtag_count                         | Conteo de Hashtags                                           | fallback_to_zero              |
| D038 | mentioned_authors_count               | Conteo de Mentioned Authors                                  | fallback_to_zero              |
| D039 | media_urls_count                      | Conteo de Media URLs                                         | fallback_to_zero              |
| D040 | expanded_urls_count                   | Conteo de Expanded URLs                                      | fallback_to_zero              |
| D041 | sentiment_score                       | positive=1 neutral=0 negative=-1                             | fallback_to_canonical         |
| D042 | non_neutral_flag                      | Sentiment != neutral                                         | fallback_to_canonical         |
| D043 | negative_flag                         | Sentiment = negative                                         | fallback_to_canonical         |
| D044 | positive_flag                         | Sentiment = positive                                         | fallback_to_canonical         |
| D045 | emotion_present_flag                  | Emotion no vacío                                             | null_if_missing               |
| D046 | emotion_category_normalized           | Lower(trim(Emotion))                                         | null_if_missing               |
| D047 | sentiment_emotion_alignment_flag      | negative con fear/anger, positive con joy/trust              | null_if_missing               |
| D048 | risk_base_score                       | negative + emotion + reportable                              | derived_from_available_inputs |
| D049 | criticality_proxy_score               | risk_base + prioridad + engagement                           | derived_from_available_inputs |
| D050 | editorial_attention_flag              | negative o reportable o starred/checked                      | derived_from_available_inputs |
| D051 | total_interactions_base               | likes + comments + shares                                    | fallback_to_zero              |
| D052 | interaction_rate_impressions          | total_interactions / impressions                             | null_if_missing               |
| D053 | interaction_rate_reach                | total_interactions / reach                                   | null_if_missing               |
| D054 | interaction_rate_audience             | total_interactions / audience                                | null_if_missing               |
| D055 | virality_ratio                        | shares / comments                                            | null_if_missing               |
| D056 | amplification_ratio                   | shares / likes                                               | null_if_missing               |
| D057 | conversation_ratio                    | comments / likes                                             | null_if_missing               |
| D058 | reach_efficiency_score                | reach / audience                                             | null_if_missing               |
| D059 | impact_per_interaction                | impact / total_interactions                                  | null_if_missing               |
| D060 | earned_attention_index                | Promedio ponderado de visibility/impact/engagement           | derived_from_available_inputs |
| D061 | source_class                          | social/news/web                                              | fallback_to_canonical         |
| D062 | platform_family                       | X/Facebook/Instagram/...                                     | fallback_to_canonical         |
| D063 | normalized_likes                      | Coalesce likes específicos/core                              | fallback_to_zero              |
| D064 | normalized_comments                   | Coalesce comments específicos/core                           | fallback_to_zero              |
| D065 | normalized_shares                     | Coalesce shares/reposts                                      | fallback_to_zero              |
| D066 | normalized_views                      | Coalesce views/impressions                                   | fallback_to_zero              |
| D067 | normalized_followers                  | Coalesce followers/subscribers                               | fallback_to_zero              |
| D068 | normalized_posts                      | Coalesce posts/video count                                   | fallback_to_zero              |
| D069 | platform_visibility_index             | Promedio disponible de impressions/reach/audience            | derived_from_available_inputs |
| D070 | platform_engagement_index             | Promedio disponible de interactions + engagement             | derived_from_available_inputs |
| D071 | author_display_name                   | Full Name fallback Author                                    | fallback_to_canonical         |
| D072 | author_identity_completeness_score    | Suma de señales de perfil                                    | derived_from_available_inputs |
| D073 | author_scale_bucket                   | nano/micro/mid/macro                                         | null_if_missing               |
| D074 | author_verified_or_authoritative_flag | X verified o verified type                                   | derived_from_available_inputs |
| D075 | publication_scale_bucket              | small/medium/large/major                                     | null_if_missing               |
| D076 | publication_type_group                | news/blog/forum/broadcast/social                             | null_if_missing               |
| D077 | publication_authority_score           | Promedio de señales de tamaño                                | derived_from_available_inputs |
| D078 | sponsored_or_promoted_flag            | Linkedin Sponsored                                           | null_if_missing               |
| D079 | syndication_risk_flag                 | Is Syndicated o Redacted Fields                              | derived_from_available_inputs |
| D080 | source_quality_proxy                  | Promedio de authority + verification                         | derived_from_available_inputs |
| D081 | is_root_post_flag                     | No parent y no reply                                         | derived_from_available_inputs |
| D082 | is_reply_flag                         | reply/comment o X Reply to                                   | derived_from_available_inputs |
| D083 | is_repost_or_quote_flag               | Alguna señal de repost/quote                                 | derived_from_available_inputs |
| D084 | thread_depth_proxy                    | 0 root, 1 reply, 2 deeper                                    | derived_from_available_inputs |
| D085 | thread_context_completeness_score     | Suma de campos thread disponibles                            | derived_from_available_inputs |
| D086 | thread_engagement_share               | interactions / total interactions thread                     | null_if_missing               |
| D087 | same_thread_volume                    | COUNT sobre Thread Id                                        | null_if_missing               |
| D088 | same_author_day_volume                | COUNT author/day                                             | fallback_to_zero              |
| D089 | same_domain_day_volume                | COUNT domain/day                                             | fallback_to_zero              |
| D090 | same_query_platform_hour_volume       | COUNT query/platform/hour                                    | null_if_missing               |
| D091 | topic_token_count                     | Conteo de items en Interest/Professions/Entity Info          | fallback_to_zero              |
| D092 | hashtag_density                       | hashtag_count / body_length_chars                            | null_if_missing               |
| D093 | mention_density                       | mentioned_authors_count / body_length_chars                  | null_if_missing               |
| D094 | url_density                           | (expanded_urls_count + media_urls_count) / body_length_chars | null_if_missing               |
| D095 | metadata_density_score                | Conteo de señales no nulas                                   | derived_from_available_inputs |
| D096 | content_richness_score                | Suma de longitud + metadatos + media                         | derived_from_available_inputs |
| D097 | structured_content_flag               | metadata_density_score >= 3                                  | derived_from_available_inputs |
| D098 | multi_entity_flag                     | Suma de counts > 1                                           | derived_from_available_inputs |
| D099 | broadcast_media_flag                  | Alguna señal broadcast presente                              | null_if_missing               |
| D100 | semantic_complexity_bucket            | simple/standard/rich/complex                                 | derived_from_available_inputs |
