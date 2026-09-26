-- TMDB movie and TV ids are separate namespaces (movie 1399 is not tv 1399),
-- so a title is identified by (source, kind, external_id).
alter table public.titles drop constraint titles_source_external_id_key;
alter table public.titles add constraint titles_source_kind_external_id_key unique (source, kind, external_id);
