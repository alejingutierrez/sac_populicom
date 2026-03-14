# Catálogo de Enrichments

- Total de derivadas: `100`
- Zona horaria de negocio: `America/Puerto_Rico`

## identity_trace

| Code | Slug                         | Tipo    | Grain   | Coverage                    | Depends On                                         | Descripción                                         |
| ---- | ---------------------------- | ------- | ------- | --------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| D001 | canonical_external_key       | key     | mention | all_sources                 | Mention Id, Resource Id, Url                       | Clave técnica final de la mención.                  |
| D002 | external_key_source          | string  | mention | all_sources                 | Mention Id, Resource Id, Url                       | Origen de la clave externa final.                   |
| D003 | mention_trace_key            | key     | mention | all_sources                 | Query Id, Mention Id, Resource Id, Url             | Join técnico estable para auditoría.                |
| D004 | normalized_url_host          | string  | mention | all_sources                 | Url, Original Url, Domain                          | Dominio normalizado de navegación.                  |
| D005 | normalized_url_path_depth    | number  | mention | all_sources                 | Url                                                | Profundidad del path en la URL.                     |
| D006 | has_original_url_flag        | boolean | mention | brandwatch_export_preferred | Original Url                                       | Indica si vino URL original además de la principal. |
| D007 | has_thread_context_flag      | boolean | mention | thread_context_optional     | Thread Id, Thread URL                              | Presencia de contexto de hilo.                      |
| D008 | has_publication_context_flag | boolean | mention | brandwatch_export_preferred | Publication Id, Publication Name                   | Presencia de contexto editorial/publicación.        |
| D009 | has_platform_author_id_flag  | boolean | mention | brandwatch_export_preferred | Facebook Author ID, X Author ID, Bluesky Author Id | Presencia de identificador nativo de autor.         |
| D010 | dedup_fingerprint            | key     | mention | all_sources                 | Page Type, Author, Date, Url, Title                | Hash lógico para revisión manual de duplicados.     |

## time_freshness

| Code | Slug                       | Tipo    | Grain   | Coverage                    | Depends On           | Descripción                                        |
| ---- | -------------------------- | ------- | ------- | --------------------------- | -------------------- | -------------------------------------------------- |
| D011 | occurred_hour_pr           | number  | mention | all_sources                 | Date                 | Hora local en Puerto Rico.                         |
| D012 | occurred_weekday_pr        | string  | mention | all_sources                 | Date                 | Día de semana local.                               |
| D013 | occurred_is_weekend_flag   | boolean | mention | all_sources                 | Date                 | Marca si cayó en fin de semana.                    |
| D014 | occurred_daypart           | bucket  | mention | all_sources                 | Date                 | Franja horaria operacional.                        |
| D015 | business_hours_flag        | boolean | mention | all_sources                 | Date                 | Marca si ocurrió en horario laboral estándar.      |
| D016 | capture_latency_minutes    | number  | mention | brandwatch_export_preferred | Date, Updated, Added | Latencia entre ocurrencia y captura/actualización. |
| D017 | freshness_bucket           | bucket  | mention | all_sources                 | Date, Updated, Added | Bucket operativo de frescura.                      |
| D018 | report_window_progress_pct | number  | mention | brandwatch_export_preferred | Date, From, To       | Posición porcentual dentro del corte del reporte.  |
| D019 | same_platform_hour_bucket  | key     | mention | all_sources                 | Page Type, Date      | Llave por plataforma y hora local.                 |
| D020 | same_query_day_bucket      | key     | mention | brandwatch_export_preferred | Query Id, Date       | Llave por query y día.                             |

## geo

| Code | Slug                        | Tipo    | Grain   | Coverage                    | Depends On                                 | Descripción                                 |
| ---- | --------------------------- | ------- | ------- | --------------------------- | ------------------------------------------ | ------------------------------------------- |
| D021 | geo_known_flag              | boolean | mention | brandwatch_export_preferred | Country, Region, City, Latitude, Longitude | Hay al menos una señal geográfica útil.     |
| D022 | geo_granularity_level       | bucket  | mention | brandwatch_export_preferred | Country, Region, City, Latitude, Longitude | Nivel de precisión geográfica.              |
| D023 | is_puerto_rico_flag         | boolean | mention | brandwatch_export_preferred | Country                                    | Marca menciones atribuibles a Puerto Rico.  |
| D024 | is_us_flag                  | boolean | mention | brandwatch_export_preferred | Country                                    | Marca menciones de Estados Unidos.          |
| D025 | is_hispanic_market_flag     | boolean | mention | all_sources                 | Country, Language                          | Mercado hispano según país/idioma.          |
| D026 | geo_market_bucket           | bucket  | mention | brandwatch_export_preferred | Country                                    | Agrupación operativa de mercado geográfico. |
| D027 | country_region_city_key     | key     | mention | brandwatch_export_preferred | Country, Region, City                      | Dimensión compuesta de geografía.           |
| D028 | has_coordinates_flag        | boolean | mention | brandwatch_export_preferred | Latitude, Longitude                        | Marca si llegaron coordenadas.              |
| D029 | location_precision_score    | number  | mention | brandwatch_export_preferred | Country, Region, City, Latitude, Longitude | Score simple de calidad geográfica.         |
| D030 | language_geo_alignment_flag | boolean | mention | all_sources                 | Country, Language                          | Coherencia básica entre idioma y geografía. |

## content

| Code | Slug                     | Tipo    | Grain   | Coverage                    | Depends On                | Descripción                      |
| ---- | ------------------------ | ------- | ------- | --------------------------- | ------------------------- | -------------------------------- |
| D031 | body_length_chars        | number  | mention | all_sources                 | Full Text, Snippet, Title | Longitud del cuerpo disponible.  |
| D032 | body_length_bucket       | bucket  | mention | all_sources                 | Full Text, Snippet, Title | Bucket de extensión textual.     |
| D033 | title_present_flag       | boolean | mention | all_sources                 | Title                     | Hay título disponible.           |
| D034 | snippet_present_flag     | boolean | mention | brandwatch_export_preferred | Snippet                   | Hay snippet disponible.          |
| D035 | full_text_present_flag   | boolean | mention | all_sources                 | Full Text, Has Full Text  | Hay texto completo disponible.   |
| D036 | title_body_overlap_ratio | number  | mention | all_sources                 | Title, Full Text, Snippet | Similitud básica título-cuerpo.  |
| D037 | hashtag_count            | number  | mention | brandwatch_export_preferred | Hashtags                  | Cantidad de hashtags detectados. |
| D038 | mentioned_authors_count  | number  | mention | brandwatch_export_preferred | Mentioned Authors         | Cantidad de autores mencionados. |
| D039 | media_urls_count         | number  | mention | brandwatch_export_preferred | Media URLs                | Cantidad de URLs de media.       |
| D040 | expanded_urls_count      | number  | mention | brandwatch_export_preferred | Expanded URLs             | Cantidad de URLs expandidas.     |

## sentiment_risk

| Code | Slug                             | Tipo    | Grain   | Coverage                    | Depends On                                        | Descripción                                           |
| ---- | -------------------------------- | ------- | ------- | --------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| D041 | sentiment_score                  | number  | mention | all_sources                 | Sentiment                                         | Polaridad numérica básica.                            |
| D042 | non_neutral_flag                 | boolean | mention | all_sources                 | Sentiment                                         | Marca sentimiento no neutral.                         |
| D043 | negative_flag                    | boolean | mention | all_sources                 | Sentiment                                         | Marca sentimiento negativo.                           |
| D044 | positive_flag                    | boolean | mention | all_sources                 | Sentiment                                         | Marca sentimiento positivo.                           |
| D045 | emotion_present_flag             | boolean | mention | brandwatch_export_preferred | Emotion                                           | Existe emoción etiquetada.                            |
| D046 | emotion_category_normalized      | string  | mention | brandwatch_export_preferred | Emotion                                           | Emoción normalizada a minúsculas.                     |
| D047 | sentiment_emotion_alignment_flag | boolean | mention | brandwatch_export_preferred | Sentiment, Emotion                                | Coherencia simple entre emoción y polaridad.          |
| D048 | risk_base_score                  | number  | mention | all_sources                 | Sentiment, Emotion, Reportable                    | Score base de riesgo reputacional.                    |
| D049 | criticality_proxy_score          | number  | mention | all_sources                 | Sentiment, Priority, Engagement Score, Reportable | Score expandido de criticidad.                        |
| D050 | editorial_attention_flag         | boolean | mention | brandwatch_export_preferred | Sentiment, Reportable, Starred, Checked           | Marca casos que merecen atención editorial/analítica. |

## engagement

| Code | Slug                         | Tipo   | Grain   | Coverage                    | Depends On                                         | Descripción                                     |
| ---- | ---------------------------- | ------ | ------- | --------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| D051 | total_interactions_base      | number | mention | all_sources                 | Likes, Comments, Shares                            | Interacciones básicas homologadas.              |
| D052 | interaction_rate_impressions | number | mention | all_sources                 | Impressions, Likes, Comments, Shares               | Tasa de interacción sobre impresiones.          |
| D053 | interaction_rate_reach       | number | mention | brandwatch_export_preferred | Reach (new), Likes, Comments, Shares               | Tasa de interacción sobre reach.                |
| D054 | interaction_rate_audience    | number | mention | brandwatch_export_preferred | Potential Audience, Likes, Comments, Shares        | Tasa de interacción sobre audiencia potencial.  |
| D055 | virality_ratio               | number | mention | all_sources                 | Shares, Comments                                   | Virality simple de shares a comentarios.        |
| D056 | amplification_ratio          | number | mention | all_sources                 | Shares, Likes                                      | Amplificación de shares sobre likes.            |
| D057 | conversation_ratio           | number | mention | all_sources                 | Comments, Likes                                    | Conversación sobre likes.                       |
| D058 | reach_efficiency_score       | number | mention | brandwatch_export_preferred | Reach (new), Potential Audience                    | Eficiencia de reach versus audiencia potencial. |
| D059 | impact_per_interaction       | number | mention | brandwatch_export_preferred | Impact, Likes, Comments, Shares                    | Impacto por interacción base.                   |
| D060 | earned_attention_index       | number | mention | all_sources                 | Impressions, Reach (new), Impact, Engagement Score | Score combinado de atención ganada.             |

## platform

| Code | Slug                      | Tipo   | Grain   | Coverage                    | Depends On                                                        | Descripción                             |
| ---- | ------------------------- | ------ | ------- | --------------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| D061 | source_class              | string | mention | all_sources                 | Page Type                                                         | Clase operativa de fuente.              |
| D062 | platform_family           | string | mention | all_sources                 | Page Type, Content Source Name                                    | Familia de plataforma homologada.       |
| D063 | normalized_likes          | number | mention | all_sources                 | Likes, Facebook Likes, Instagram Likes, X Likes                   | Likes homologados por plataforma.       |
| D064 | normalized_comments       | number | mention | all_sources                 | Comments, Facebook Comments, Instagram Comments, Youtube Comments | Comentarios homologados por plataforma. |
| D065 | normalized_shares         | number | mention | all_sources                 | Shares, Facebook Shares, X Reposts, Threads Shares                | Shares/reposts homologados.             |
| D066 | normalized_views          | number | mention | all_sources                 | Impressions, Threads Views, Tiktok Views, Resource Views          | Views/impressions homologadas.          |
| D067 | normalized_followers      | number | mention | brandwatch_export_preferred | Instagram Followers, X Followers, Youtube Subscriber Count        | Seguidores homologados.                 |
| D068 | normalized_posts          | number | mention | brandwatch_export_preferred | Instagram Posts, X Posts, Bluesky Posts, Youtube Video Count      | Posts/vídeos homologados por cuenta.    |
| D069 | platform_visibility_index | number | mention | all_sources                 | Impressions, Reach (new), Potential Audience                      | Score comparable de visibilidad.        |
| D070 | platform_engagement_index | number | mention | all_sources                 | Likes, Comments, Shares, Engagement Score                         | Score comparable de interacción.        |

## authority

| Code | Slug                                  | Tipo    | Grain   | Coverage                    | Depends On                                                               | Descripción                                  |
| ---- | ------------------------------------- | ------- | ------- | --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| D071 | author_display_name                   | string  | mention | all_sources                 | Full Name, Author                                                        | Nombre preferido para mostrar autor.         |
| D072 | author_identity_completeness_score    | number  | mention | brandwatch_export_preferred | Author, Full Name, Avatar, Author Verified Type                          | Score de completitud de identidad del autor. |
| D073 | author_scale_bucket                   | bucket  | mention | brandwatch_export_preferred | Instagram Followers, X Followers, Youtube Subscriber Count               | Bucket de escala del autor.                  |
| D074 | author_verified_or_authoritative_flag | boolean | mention | brandwatch_export_preferred | X Verified, Author Verified Type                                         | Marca cuentas con señal de verificación.     |
| D075 | publication_scale_bucket              | bucket  | mention | brandwatch_export_preferred | Daily Visitors, Total Monthly Visitors                                   | Bucket de escala editorial.                  |
| D076 | publication_type_group                | string  | mention | brandwatch_export_preferred | Pub Type, Subtype, Media Type, Broadcast Type                            | Agrupación editorial de tipo de publicación. |
| D077 | publication_authority_score           | number  | mention | brandwatch_export_preferred | Daily Visitors, Total Monthly Visitors, Circulation, Viewership          | Score de autoridad del medio.                |
| D078 | sponsored_or_promoted_flag            | boolean | mention | brandwatch_export_preferred | Linkedin Sponsored                                                       | Marca contenido patrocinado/promovido.       |
| D079 | syndication_risk_flag                 | boolean | mention | brandwatch_export_preferred | Is Syndicated, Redacted Fields                                           | Marca riesgo de sindicación o edición.       |
| D080 | source_quality_proxy                  | number  | mention | all_sources                 | Daily Visitors, Total Monthly Visitors, X Verified, Author Verified Type | Proxy compuesto de calidad de fuente.        |

## conversation

| Code | Slug                              | Tipo    | Grain               | Coverage                    | Depends On                                                | Descripción                                                    |
| ---- | --------------------------------- | ------- | ------------------- | --------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| D081 | is_root_post_flag                 | boolean | mention             | brandwatch_export_preferred | Parent Post Id, Thread Entry Type                         | Marca si parece post raíz.                                     |
| D082 | is_reply_flag                     | boolean | mention             | all_sources                 | Thread Entry Type, X Reply to                             | Marca si parece reply/comentario.                              |
| D083 | is_repost_or_quote_flag           | boolean | mention             | all_sources                 | X Repost of, Threads Reposts, Bluesky Quotes              | Marca si parece repost/quote.                                  |
| D084 | thread_depth_proxy                | number  | mention             | brandwatch_export_preferred | Parent Post Id, Root Post Id, Thread Entry Type           | Profundidad aproximada del hilo.                               |
| D085 | thread_context_completeness_score | number  | mention             | thread_context_optional     | Thread Id, Thread URL, Thread Author, Thread Created Date | Completitud del contexto de hilo.                              |
| D086 | thread_engagement_share           | number  | thread              | aggregate                   | Thread Id, Likes, Comments, Shares                        | Participación de la fila dentro del engagement total del hilo. |
| D087 | same_thread_volume                | number  | thread              | aggregate                   | Thread Id                                                 | Volumen de menciones en el mismo hilo.                         |
| D088 | same_author_day_volume            | number  | author_day          | aggregate                   | Author, Full Name, Date                                   | Volumen mismo autor y día local.                               |
| D089 | same_domain_day_volume            | number  | domain_day          | aggregate                   | Domain, Url, Date                                         | Volumen mismo dominio y día local.                             |
| D090 | same_query_platform_hour_volume   | number  | query_platform_hour | aggregate                   | Query Id, Page Type, Date                                 | Volumen query+plataforma+hora.                                 |

## semantic

| Code | Slug                       | Tipo    | Grain   | Coverage                    | Depends On                                                         | Descripción                                            |
| ---- | -------------------------- | ------- | ------- | --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| D091 | topic_token_count          | number  | mention | brandwatch_export_preferred | Interest, Professions, Entity Info                                 | Cantidad de tokens temáticos disponibles.              |
| D092 | hashtag_density            | number  | mention | brandwatch_export_preferred | Hashtags, Full Text                                                | Densidad de hashtags en el cuerpo.                     |
| D093 | mention_density            | number  | mention | brandwatch_export_preferred | Mentioned Authors, Full Text                                       | Densidad de menciones de autores.                      |
| D094 | url_density                | number  | mention | brandwatch_export_preferred | Expanded URLs, Media URLs, Full Text                               | Densidad de URLs sobre cuerpo.                         |
| D095 | metadata_density_score     | number  | mention | all_sources                 | Title, Snippet, Full Text, Hashtags, Emotion                       | Cuánta metadata útil llegó con la fila.                |
| D096 | content_richness_score     | number  | mention | all_sources                 | Title, Snippet, Full Text, Hashtags, Mentioned Authors, Media URLs | Score de riqueza de contenido.                         |
| D097 | structured_content_flag    | boolean | mention | all_sources                 | Title, Snippet, Full Text, Hashtags, Media URLs                    | Marca filas con suficiente estructura analítica.       |
| D098 | multi_entity_flag          | boolean | mention | brandwatch_export_preferred | Mentioned Authors, Expanded URLs, Media URLs                       | Marca contenido con múltiples entidades referenciadas. |
| D099 | broadcast_media_flag       | boolean | mention | brandwatch_export_preferred | Broadcast Type, Air Type, Station Name, Broadcast Media Url        | Marca contenido con naturaleza broadcast.              |
| D100 | semantic_complexity_bucket | bucket  | mention | all_sources                 | Full Text, Hashtags, Mentioned Authors, Media URLs, Entity Info    | Bucket global de complejidad semántica.                |
