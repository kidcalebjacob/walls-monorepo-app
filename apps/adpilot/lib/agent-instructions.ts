/**
 * Client-safe agent-instruction primitives. This module must stay free of
 * server-only dependencies (Supabase server client, `next/headers`, etc.) so it
 * can be imported from Client Components. All database access lives in
 * `lib/agent-instructions-server.ts`.
 *
 * `active`    - currently in effect (within window + manually enabled).
 * `scheduled` - enabled but its start time is in the future.
 * `expired`   - its end time has passed.
 * `disabled`  - manually switched off, regardless of window.
 */
export type AgentInstructionStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "disabled";

export type AgentInstruction = {
  id: string;
  entityId: string;
  instructions: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  status: AgentInstructionStatus;
  createdAt: string;
  updatedAt: string | null;
};

export function resolveInstructionStatus(input: {
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  now?: Date;
}): AgentInstructionStatus {
  if (!input.isActive) return "disabled";
  const now = (input.now ?? new Date()).getTime();
  if (input.startsAt && now < new Date(input.startsAt).getTime()) {
    return "scheduled";
  }
  if (input.endsAt && now >= new Date(input.endsAt).getTime()) {
    return "expired";
  }
  return "active";
}
