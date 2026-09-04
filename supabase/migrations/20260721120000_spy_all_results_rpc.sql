-- "Todos os resultados": função que agrega no servidor (sem o limite de 1000 linhas
-- do PostgREST) e inclui páginas ENCONTRADAS em buscas mesmo que ainda não medidas.
-- Antes o front lia só spy_page_snapshots, escondendo páginas sem medição e sujeito
-- ao teto de linhas. Datas interpretadas no fuso informado (padrão America/Sao_Paulo)
-- para "período exato".
CREATE OR REPLACE FUNCTION public.spy_all_results(
  p_from date,
  p_to date,
  p_tz text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE (
  spy_page_id uuid,
  page_id text,
  page_name text,
  ad_library_url text,
  latest_active integer,
  max_active integer,
  potential text,
  measurements bigint,
  ads_count bigint,
  last_checked_at timestamptz,
  is_favorite boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH b AS (
    SELECT
      ((p_from::text || ' 00:00:00')::timestamp AT TIME ZONE p_tz)     AS ts_from,
      ((p_to::text   || ' 23:59:59.999')::timestamp AT TIME ZONE p_tz) AS ts_to
  ),
  found AS (
    SELECT a.page_id, count(*)::bigint AS ads_count, max(a.collected_at) AS last_found
    FROM spy_ads a, b
    WHERE a.page_id IS NOT NULL
      AND a.collected_at >= b.ts_from AND a.collected_at <= b.ts_to
    GROUP BY a.page_id
  ),
  snaps AS (
    SELECT p.page_id,
      count(*)::bigint AS measurements,
      max(s.active_ads) AS max_active,
      max(s.checked_at) AS last_checked
    FROM spy_page_snapshots s
    JOIN spy_pages p ON p.id = s.spy_page_id, b
    WHERE s.checked_at >= b.ts_from AND s.checked_at <= b.ts_to
    GROUP BY p.page_id
  ),
  ids AS (
    SELECT page_id FROM found
    UNION
    SELECT page_id FROM snaps
  )
  SELECT
    p.id AS spy_page_id,
    ids.page_id,
    p.page_name,
    p.ad_library_url,
    COALESCE(ls.active_ads, p.current_active_ads)  AS latest_active,
    COALESCE(sn.max_active, p.current_active_ads)  AS max_active,
    COALESCE(ls.potential, p.current_potential)    AS potential,
    COALESCE(sn.measurements, 0)                   AS measurements,
    COALESCE(f.ads_count, 0)                        AS ads_count,
    COALESCE(sn.last_checked, p.last_checked_at)    AS last_checked_at,
    COALESCE(p.is_favorite, false)                  AS is_favorite
  FROM ids
  LEFT JOIN spy_pages p ON p.page_id = ids.page_id
  LEFT JOIN found f     ON f.page_id = ids.page_id
  LEFT JOIN snaps sn    ON sn.page_id = ids.page_id
  LEFT JOIN LATERAL (
    SELECT s2.active_ads, s2.potential
    FROM spy_page_snapshots s2
    JOIN spy_pages p2 ON p2.id = s2.spy_page_id, b
    WHERE p2.page_id = ids.page_id
      AND s2.checked_at >= b.ts_from AND s2.checked_at <= b.ts_to
    ORDER BY s2.checked_at DESC
    LIMIT 1
  ) ls ON true;
$$;

GRANT EXECUTE ON FUNCTION public.spy_all_results(date, date, text) TO authenticated;
