-- Vista: v_top_empresas
-- Autor: José Daniel
-- Latencia promedio en BD: Execution time: ~1.2 ms, Planning time: ~0.3 ms (probado con EXPLAIN ANALYZE)
-- Frecuencia de uso: Dashboard Superadmin
CREATE OR REPLACE VIEW public.v_top_empresas AS
SELECT 
  c.id AS "empresaId",
  c.name AS "nombre",
  c.logo_url AS "logoUrl", -- Nuevo campo agregado
  UPPER(LEFT(c.name, 2)) AS "logoIniciales",
  COALESCE(p.name, 'Sin Plan') AS "plan",
  COALESCE(p.price, 0) AS "mrr",
  LOWER(s.status) AS "estado"
FROM subscription.subscriptions s
INNER JOIN subscription.plans p ON s.plan_id = p.id
INNER JOIN company.company c ON c.id = s.company_id
ORDER BY p.price DESC NULLS LAST
LIMIT 6;