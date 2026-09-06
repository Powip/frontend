-- Vista: v_couriers_red
-- Autor: José Daniel
-- Latencia promedio en BD: Execution time: ~11 ms, Planning time: ~1.3 ms (probado con EXPLAIN ANALYZE)
-- Cold-Start: Execution time: ~152 ms, Planning time: ~47.7 ms (estimado - no probado con EXPLAIN ANALYZE primera vez)
-- Frecuencia de uso: oportunidades Superadmin
-- warning: Esta vista combina datos de dos tablas diferentes (couriers y shipping_guides) y realiza un conteo de guías por courier, así como el porcentaje de entregas y devoluciones.
-- Se recomienda revisar la estructura de la base de datos y considerar optimizaciones si la base de datos crece mucho.
CREATE OR REPLACE VIEW public.v_couriers_red AS
SELECT 
    COALESCE(c.name, sg."courierName", sg."courierId"::text, 'Sin Especificar') AS courier,
    COUNT(sg.id) AS total_guias,
    ROUND(
        (COUNT(CASE WHEN sg.status::text ILIKE '%entregad%' OR sg.status::text ILIKE '%deliver%' THEN 1 END)::numeric / NULLIF(COUNT(sg.id), 0)) * 100, 
        1
    ) AS pct_entrega,
    ROUND(
        (COUNT(CASE WHEN sg.status::text ILIKE '%devuelt%' OR sg.status::text ILIKE '%return%' OR sg.status::text ILIKE '%rechazad%' THEN 1 END)::numeric / NULLIF(COUNT(sg.id), 0)) * 100, 
        1
    ) AS pct_devolucion
FROM couriers.shipping_guides sg
LEFT JOIN couriers.couriers c ON sg."courierId" = c.id
GROUP BY COALESCE(c.name, sg."courierName", sg."courierId"::text, 'Sin Especificar')
ORDER BY total_guias DESC;