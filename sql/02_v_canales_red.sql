-- Vista: v_canales_red
-- Autor: José Daniel
-- Latencia promedio en BD: Execution time: ~0.45 ms, Planning time: ~0.779 ms (probado con EXPLAIN ANALYZE)
-- Cold-Start: Execution time: ~7 ms, Planning time: ~12 ms (probado con EXPLAIN ANALYZE primera vez)
-- Frecuencia de uso: Dashboard Superadmin
CREATE OR REPLACE VIEW public.v_canales_red AS
WITH total_empresas AS (
    -- Contamos el total de empresas con al menos un canal para sacar el %
    SELECT COUNT(DISTINCT id) AS total 
    FROM company.company 
    WHERE sales_channels IS NOT NULL AND array_length(sales_channels, 1) > 0
),
conteo_canales AS (
    -- Desenrollamos el array de canales por empresa
    SELECT 
        UNNEST(sales_channels) AS canal,
        COUNT(id) AS count
    FROM company.company
    WHERE sales_channels IS NOT NULL
    GROUP BY canal
)
SELECT 
    c.canal,
    c.count,
    -- Calculamos el porcentaje redondeado
    ROUND((c.count::numeric / t.total) * 100) AS pct
FROM conteo_canales c
CROSS JOIN total_empresas t
ORDER BY c.count DESC;