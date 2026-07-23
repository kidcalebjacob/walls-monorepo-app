import { createClient } from "@walls/supabase/server";

import { type AdDataScope, adScopeFields, withAdScope } from "@/lib/ad-scope";
import {
  normalizeProfileAgentInstructions,
  parseProfileAgentInstructions,
  resolveInstructionStatus,
  type AgentInstruction,
  type AgentInstructionStatus,
  type ProfileAgentInstruction,
} from "@/lib/agent-instructions";

export {
  normalizeProfileAgentInstructions,
  parseProfileAgentInstructions,
  resolveInstructionStatus,
  type AgentInstruction,
  type AgentInstructionStatus,
  type ProfileAgentInstruction,
};

const INSTRUCTION_COLUMNS =
  "id, entity_id, instructions, starts_at, ends_at, is_active, created_at, updated_at";

function normalizeInstructions(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function mapInstruction(row: Record<string, unknown>): AgentInstruction {
  const startsAt = normalizeTimestamp(row.starts_at);
  const endsAt = normalizeTimestamp(row.ends_at);
  const isActive = Boolean(row.is_active);

  return {
    id: row.id as string,
    entityId: row.entity_id as string,
    instructions: row.instructions as string,
    startsAt,
    endsAt,
    isActive,
    status: resolveInstructionStatus({ startsAt, endsAt, isActive }),
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

/** Sort: active first, then scheduled, then expired/disabled; newest within a group. */
function sortInstructions(rows: AgentInstruction[]): AgentInstruction[] {
  const rank: Record<AgentInstructionStatus, number> = {
    active: 0,
    scheduled: 1,
    expired: 2,
    disabled: 3,
  };
  return [...rows].sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status];
    if (byStatus !== 0) return byStatus;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function listEntityAgentInstructions(input: {
  scope: AdDataScope;
  entityId: string;
}): Promise<AgentInstruction[]> {
  const supabase = await createClient();

  const { data, error } = await withAdScope(
    supabase.from("ad_agent_instructions").select(INSTRUCTION_COLUMNS),
    input.scope,
  ).eq("entity_id", input.entityId);

  if (error) throw error;
  return sortInstructions((data ?? []).map(mapInstruction));
}

async function assertAutomatableEntity(input: {
  scope: AdDataScope;
  entityId: string;
}): Promise<{ accountConnectionId: string }> {
  const supabase = await createClient();

  const { data: entity, error } = await withAdScope(
    supabase
      .from("ad_entities")
      .select("id, entity_type, account_connection_id")
      .eq("id", input.entityId),
    input.scope,
  ).maybeSingle();

  if (error) throw error;
  if (!entity) throw new Error("Entity not found");
  if (entity.entity_type !== "campaign" && entity.entity_type !== "ad_group") {
    throw new Error("Only campaigns and ad sets support agent instructions.");
  }

  return { accountConnectionId: entity.account_connection_id as string };
}

export async function createEntityAgentInstruction(input: {
  scope: AdDataScope;
  entityId: string;
  instructions: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}): Promise<AgentInstruction> {
  const instructions = normalizeInstructions(input.instructions);
  if (!instructions) throw new Error("Instructions cannot be empty.");

  const startsAt = normalizeTimestamp(input.startsAt);
  const endsAt = normalizeTimestamp(input.endsAt);
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new Error("End time must be after the start time.");
  }

  const { accountConnectionId } = await assertAutomatableEntity({
    scope: input.scope,
    entityId: input.entityId,
  });

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ad_agent_instructions")
    .insert({
      ...adScopeFields(input.scope),
      account_connection_id: accountConnectionId,
      entity_id: input.entityId,
      instructions,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: input.isActive ?? true,
      created_by_user_id: input.scope.userId,
    })
    .select(INSTRUCTION_COLUMNS)
    .single();

  if (error) throw error;
  return mapInstruction(data);
}

export async function updateEntityAgentInstruction(input: {
  scope: AdDataScope;
  instructionId: string;
  patch: {
    instructions?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
  };
}): Promise<AgentInstruction> {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await withAdScope(
    supabase
      .from("ad_agent_instructions")
      .select(INSTRUCTION_COLUMNS)
      .eq("id", input.instructionId),
    input.scope,
  ).maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error("Instruction not found");

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.patch.instructions !== undefined) {
    const instructions = normalizeInstructions(input.patch.instructions);
    if (!instructions) throw new Error("Instructions cannot be empty.");
    row.instructions = instructions;
  }
  if (input.patch.startsAt !== undefined) {
    row.starts_at = normalizeTimestamp(input.patch.startsAt);
  }
  if (input.patch.endsAt !== undefined) {
    row.ends_at = normalizeTimestamp(input.patch.endsAt);
  }
  if (input.patch.isActive !== undefined) {
    row.is_active = input.patch.isActive;
  }

  const nextStartsAt =
    row.starts_at !== undefined
      ? (row.starts_at as string | null)
      : normalizeTimestamp(existing.starts_at);
  const nextEndsAt =
    row.ends_at !== undefined
      ? (row.ends_at as string | null)
      : normalizeTimestamp(existing.ends_at);
  if (nextStartsAt && nextEndsAt && new Date(nextEndsAt) <= new Date(nextStartsAt)) {
    throw new Error("End time must be after the start time.");
  }

  const { data, error } = await withAdScope(
    supabase
      .from("ad_agent_instructions")
      .update(row)
      .eq("id", input.instructionId),
    input.scope,
  )
    .select(INSTRUCTION_COLUMNS)
    .single();

  if (error) throw error;
  return mapInstruction(data);
}

export async function deleteEntityAgentInstruction(input: {
  scope: AdDataScope;
  instructionId: string;
}): Promise<void> {
  const supabase = await createClient();

  const { error } = await withAdScope(
    supabase
      .from("ad_agent_instructions")
      .delete()
      .eq("id", input.instructionId),
    input.scope,
  );

  if (error) throw error;
}

/**
 * Replace an entity's agent instructions with templates from a preset.
 * Clears existing rows, then inserts the template texts as immediately-active
 * instructions (no schedule window).
 */
export async function replaceEntityAgentInstructionsFromProfile(input: {
  scope: AdDataScope;
  entityId: string;
  templates: ProfileAgentInstruction[];
}): Promise<AgentInstruction[]> {
  const templates = normalizeProfileAgentInstructions(input.templates);
  const { accountConnectionId } = await assertAutomatableEntity({
    scope: input.scope,
    entityId: input.entityId,
  });

  const supabase = await createClient();

  const { error: deleteError } = await withAdScope(
    supabase.from("ad_agent_instructions").delete().eq("entity_id", input.entityId),
    input.scope,
  );
  if (deleteError) throw deleteError;

  if (templates.length === 0) return [];

  const { data, error } = await supabase
    .from("ad_agent_instructions")
    .insert(
      templates.map((template) => ({
        ...adScopeFields(input.scope),
        account_connection_id: accountConnectionId,
        entity_id: input.entityId,
        instructions: template.instructions,
        starts_at: null,
        ends_at: null,
        is_active: true,
        created_by_user_id: input.scope.userId,
      })),
    )
    .select(INSTRUCTION_COLUMNS);

  if (error) throw error;
  return sortInstructions((data ?? []).map(mapInstruction));
}
