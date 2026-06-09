import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const budgetStatusSchema = z.enum(["draft", "active", "closed"]);

const budgetPeriodInputSchema = z.object({
  name: z.string().trim().min(1, "Nama budget wajib diisi"),
  description: z.string().optional().default(""),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
  status: budgetStatusSchema.optional().default("active"),
});

const inviteInputSchema = z.object({
  budgetPeriodId: z.string().uuid(),
  email: z.string().trim().email("Email tidak valid"),
  role: z.enum(["collaborator", "viewer"]),
});

export const createBudgetPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => budgetPeriodInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.startDate > data.endDate) throw new Error("Tanggal mulai harus sebelum tanggal selesai");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("budget_periods")
      .insert({
        owner_user_id: context.userId,
        name: data.name,
        description: data.description ?? "",
        start_date: data.startDate,
        end_date: data.endDate,
        status: data.status,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const inviteBudgetCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: budget, error: budgetError } = await supabaseAdmin
      .from("budget_periods")
      .select("id, owner_user_id")
      .eq("id", data.budgetPeriodId)
      .single();
    if (budgetError) throw new Error(budgetError.message);
    if (budget.owner_user_id !== context.userId) throw new Error("Hanya owner yang bisa mengundang kolaborator");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    const { data: row, error } = await supabaseAdmin
      .from("budget_collaborators")
      .insert({
        budget_period_id: data.budgetPeriodId,
        invited_email: email,
        user_id: prof?.id ?? null,
        role: data.role,
        status: prof?.id ? "accepted" : "pending",
        accepted_at: prof?.id ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });