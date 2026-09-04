-- Vista: v_clientes_composicion
-- Autor: José Daniel
-- Latencia promedio en BD: Execution time: ~0.4 ms, Planning time: ~1.1 ms (probado con EXPLAIN ANALYZE)
-- Cold-Start: Execution time: ~7 ms, Planning time: ~12 ms (estimado - no probado con EXPLAIN ANALYZE primera vez)
-- Frecuencia de uso: Dashboard Superadmin
CREATE OR REPLACE VIEW public.v_clientes_composicion AS
WITH total_clientes AS (
    -- Contamos el total de registros para sacar el %
    SELECT COUNT(id) AS total 
    FROM subscription.subscriptions
),
segmentacion AS (
    SELECT 
        CASE 
            -- 1. Pago pendiente / en mora
            WHEN status = 'PENDING_PAYMENT' 
                THEN 'Pago pendiente / en mora'

            -- 2. Cancelado este mes (Cancelados o expirados en el mes en curso)
            WHEN status IN ('CANCELLED', 'EXPIRED') 
                 AND end_date >= DATE_TRUNC('month', CURRENT_DATE) 
                THEN 'Cancelado este mes'

            -- 3. Nuevo (Activo y su fecha de inicio es de este mes)
            WHEN status = 'ACTIVE' 
                 AND start_date >= DATE_TRUNC('month', CURRENT_DATE) 
                THEN 'Nuevo (alta este mes)'

            -- 4. Recurrente (Activo y su fecha de inicio fue antes de este mes)
            WHEN status = 'ACTIVE' 
                 AND start_date < DATE_TRUNC('month', CURRENT_DATE) 
                THEN 'Recurrente (>1 mes activo)'

            -- Fallback por si hay cancelados de meses anteriores o estados raros
            ELSE 'Otros / Inactivos antiguos'
        END AS segmento,
        COUNT(id) AS count
    FROM subscription.subscriptions
    GROUP BY segmento
)
SELECT 
    s.segmento,
    s.count,
    COALESCE(ROUND((s.count::numeric / NULLIF(t.total, 0)) * 100), 0) AS pct
FROM segmentacion s
CROSS JOIN total_clientes t
ORDER BY s.count DESC;