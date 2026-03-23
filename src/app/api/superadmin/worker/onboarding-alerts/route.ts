import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const now = new Date();
  
  // Cutoff dates
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Fetch businesses with their onboarding progress
    const { data: businesses, error } = await supabase
      .from("company")
      .select(`
        id,
        name,
        billing_email,
        created_at,
        onboarding:onboarding_progress(*)
      `)
      .eq("is_active", true);

    if (error) throw error;

    const results = {
      emails_enqueued: 0,
      alerts_generated: 0
    };

    for (const biz of businesses) {
      const steps = biz.onboarding || [];
      const totalSteps = steps.length || 6;
      const completedSteps = steps.filter((s: any) => s.completed).length;
      const completionPct = (completedSteps / totalSteps) * 100;
      const createdAt = new Date(biz.created_at).toISOString();

      // CASE A: 3 days + 0% completion
      if (createdAt <= threeDaysAgo && completionPct === 0) {
        // Enqueue email
        const { count: alreadyEnqueued } = await supabase
          .from("transactional_emails")
          .select("*", { count: "exact", head: true })
          .eq("business_id", biz.id)
          .eq("template_name", "onboarding_welcome_video");

        if (!alreadyEnqueued) {
          await supabase.from("transactional_emails").insert({
            business_id: biz.id,
            recipient_email: biz.billing_email,
            subject: "🚀 ¡Tu primera semana en PowIp! Mira este video tutorial",
            template_name: "onboarding_welcome_video",
            template_data: { business_name: biz.name },
            status: "pending"
          });
          results.emails_enqueued++;
        }
      }

      // CASE B: 7 days + < 50% completion
      if (createdAt <= sevenDaysAgo && completionPct < 50) {
        // Generate internal notification (for superadmin contact)
        const { count: alreadyNotified } = await supabase
          .from("webhook_logs")
          .select("*", { count: "exact", head: true })
          .eq("source", "internal_automation")
          .eq("event_type", "stagnant_onboarding_alert")
          .filter("payload->>business_id", "eq", biz.id);

        if (!alreadyNotified) {
          await supabase.from("webhook_logs").insert({
            source: "internal_automation",
            event_type: "stagnant_onboarding_alert",
            payload: {
              business_id: biz.id,
              business_name: biz.name,
              completion_pct: completionPct,
              days_since_activation: 7
            },
            status: "pending"
          });
          results.alerts_generated++;
        }
      }
    }

    return NextResponse.json({ message: "Worker completed successfully", results });
  } catch (err: any) {
    console.error("[Worker] Onboarding Alerts Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
