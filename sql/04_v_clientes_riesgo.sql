-- Vista: v_clientes_riesgo
-- Autor: José Daniel
-- Latencia promedio en BD: Execution time: ~1 ms, Planning time: ~2 ms (probado con EXPLAIN ANALYZE)
-- Cold-Start: Execution time: ~1 ms, Planning time: ~4 ms (estimado - no probado con EXPLAIN ANALYZE primera vez)
-- Frecuencia de uso: Dashboard Superadmin
CREATE OR REPLACE VIEW public.v_clientes_riesgo AS
SELECT 
    c.id AS "empresaId",
    c.name AS "empresaNombre",
    CASE 
        WHEN s.status = 'PENDING_PAYMENT' 
            THEN 'Factura vencida / Pago pendiente de procesar'
        WHEN s.status IN ('CANCELLED', 'EXPIRED') 
            THEN 'Suscripción cancelada o vencida recientemente'
        ELSE 'Riesgo detectado por inactividad de pago'
    END AS "motivo",
    s.updated_at AS fecha_riesgo
FROM subscription.subscriptions s
JOIN company.company c ON c.id = s.company_id
WHERE s.status IN ('PENDING_PAYMENT', 'CANCELLED', 'EXPIRED')
ORDER BY s.updated_at DESC;