-- Vista: v_radar_upsell
-- Autor: José Daniel
-- Latencia promedio en BD: Execution time: ~70 ms, Planning time: ~1.8 ms (probado con EXPLAIN ANALYZE)
-- Cold-Start: Execution time: ~808 ms, Planning time: ~1.7 ms (estimado - no probado con EXPLAIN ANALYZE primera vez)
-- Frecuencia de uso: oportunidades Superadmin
-- warning: Esta vista analiza las órdenes de los últimos 30 días para identificar oportunidades de upsell basadas en el volumen de pedidos.
-- Se recomienda revisar la estructura de la base de datos y considerar optimizaciones si el volumen de datos crece significativamente.
-- Esto debido a que la vista es pesada a nivel de base de datos. Dónde poco o nada se puede hacer para optimizarla. Se recomienda revisar la estructura de la base de datos y considerar optimizaciones si el volumen de datos crece significativamente.

CREATE OR REPLACE VIEW public.v_radar_upsell AS
WITH ordenes_30d AS (
    SELECT 
        "storeId" AS empresa_id,
        COUNT(id) AS total_pedidos,
        COALESCE(SUM("grandTotal"), 0) AS total_facturado,
        MAX(created_at) AS ultima_venta
    FROM ventas."orderHeader"
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY "storeId"
)
SELECT 
    o.empresa_id,
    o.total_pedidos,
    o.total_facturado,
    CASE 
        WHEN o.total_pedidos >= 300 THEN true
        ELSE false
    END AS caliente,
    CASE 
        WHEN o.total_pedidos >= 300 THEN 'Superó los 300 pedidos/mes. Recomendada migración a Plan Pro.'
        WHEN o.total_pedidos >= 150 THEN 'Volumen alto constante. Potencial módulo de automatización.'
        ELSE 'Volumen dentro del límite de plan actual.'
    END AS motivo,
    CASE 
        WHEN o.total_pedidos >= 300 THEN 120
        WHEN o.total_pedidos >= 150 THEN 60
        ELSE 0
    END AS mrr_potencial
FROM ordenes_30d o
ORDER BY mrr_potencial DESC, total_pedidos DESC;