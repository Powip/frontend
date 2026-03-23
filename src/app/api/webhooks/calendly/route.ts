import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const payload = await request.json();
    const { event, payload: eventData } = payload;

    // 1. Log the webhook receipt
    const { data: log, error: logError } = await supabase.from("webhook_logs").insert({
      source: "calendly",
      event_type: event,
      payload: payload,
      status: "pending"
    }).select().single();

    if (logError) throw logError;

    // 2. Process only 'invitee.created' events
    if (event === "invitee.created") {
      const invitee = eventData.invitee;
      const questions = invitee.questions_and_answers || [];
      
      // Extract business name if it's in the custom questions
      const businessNameQuestion = questions.find((q: any) => 
        q.question.toLowerCase().includes("empresa") || q.question.toLowerCase().includes("negocio")
      );

      const newLead = {
        contact_name: invitee.name,
        email: invitee.email,
        phone_whatsapp: "", // Calendly doesn't always provide this unless asked
        business_name: businessNameQuestion?.answer || "Pendiente (Calendly)",
        source: "calendly",
        pipeline_stage: "nuevo",
        description: `Cita agendada via Calendly. Evento: ${eventData.event_type.name}`,
        demo_scheduled_at: eventData.start_time
      };

      const { error: leadError } = await supabase.from("leads").insert(newLead);
      
      if (leadError) {
        await supabase.from("webhook_logs").update({ 
          status: "failed", 
          error_message: leadError.message 
        }).eq("id", log.id);
        throw leadError;
      }

      // Mark as processed
      await supabase.from("webhook_logs").update({ 
        status: "processed", 
        processed_at: new Date().toISOString() 
      }).eq("id", log.id);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[CalendlyWebhook] Error processing webhook:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
