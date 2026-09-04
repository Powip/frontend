-- Vista: v_clientes_riesgo
-- Autor: José Daniel
-- Latencia promedio en BD: Execution time: ~1 ms, Planning time: ~1 ms (probado con EXPLAIN ANALYZE)
-- Cold-Start: Execution time: ~6 ms, Planning time: ~9 ms (estimado - no probado con EXPLAIN ANALYZE primera vez)
-- Frecuencia de uso: Dashboard Superadmin
-- warning: Esta vista combina datos de dos tablas diferentes (leads y landing_leads) y realiza una deduplicación basada en el teléfono
-- Pero, convertimos los ids a texto, esto debido a probelmas en la base de datos debido a diferencia de tipos de datos.
-- Aunque soluciona el problema de compatibilidad, puede generar problemas de performance en el futuro si la base de datos crece mucho.
-- Se recomienda revisar la estructura de la base de datos y considerar unificar los tipos de datos para los ids en ambas tablas.

CREATE OR REPLACE VIEW public.v_all_leads AS
WITH combined AS (
    -- 1. Leads de la tabla principal CRM
    SELECT 
        id::text AS id,
        contact_name,
        business_name,
        phone_whatsapp,
        email,
        source,
        pipeline_stage,
        assigned_to::text AS assigned_to, -- Convertimos a text para asegurar compatibilidad
        created_at,
        COALESCE(updated_at, created_at) AS updated_at,
        false AS is_landing
    FROM public.leads

    UNION ALL

    -- 2. Leads de la Landing Page (Normalizados)
    SELECT 
        id::text AS id,
        full_name AS contact_name,
        company AS business_name,
        phone AS phone_whatsapp,
        email,
        'landing' AS source,
        'nuevo' AS pipeline_stage,
        NULL::text AS assigned_to, -- Mismo tipo text que el bloque superior
        created_at,
        created_at AS updated_at,
        true AS is_landing
    FROM public.landing_leads
),
deduped AS (
    -- 3. Deduplicación en BD por teléfono (Prioriza registros de 'leads' y la fecha más reciente)
    SELECT 
        id,
        contact_name,
        business_name,
        phone_whatsapp,
        email,
        source,
        pipeline_stage,
        assigned_to,
        created_at,
        updated_at,
        is_landing,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(NULLIF(phone_whatsapp, ''), id) 
            ORDER BY is_landing ASC, created_at DESC
        ) AS rn
    FROM combined
)
SELECT 
    id,
    contact_name,
    business_name,
    phone_whatsapp,
    email,
    source,
    pipeline_stage,
    assigned_to,
    created_at,
    updated_at,
    is_landing
FROM deduped
WHERE rn = 1;