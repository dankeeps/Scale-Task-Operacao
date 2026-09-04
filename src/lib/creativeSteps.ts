// Sequential creative task pipeline (replaced the old Kanban ad_status flow).
// When a creative document is created, ONLY the first step task is created.
// Concluding a step's task auto-creates the next step's task. Every auto-created
// task is due "today" and flagged high priority — EXCEPT "Esperando entrega do
// expert", whose due date is the expert's delivery date. That date is picked in a
// MANDATORY popup when the user concludes the previous step ("Enviar copy para
// expert") — see DATE_PROMPT_STEP_KEY.

export interface CreativeStep {
  key: string;
  label: string;
}

export const CREATIVE_STEPS: CreativeStep[] = [
  { key: "analisar_copy", label: "Analisar copy" },
  { key: "enviar_copy_expert", label: "Enviar copy para expert" },
  { key: "esperando_expert", label: "Esperando entrega do expert" },
  { key: "copy_analisar_bruto", label: "Copywriter analisar bruto" },
  { key: "enviar_edicao", label: "Enviar para edição" },
  { key: "copy_analisar_edicao", label: "Copywriter analisar edição" },
  { key: "gestor_subir", label: "Gestor subir anúncios" },
];

export const FIRST_STEP = CREATIVE_STEPS[0];

// Concluding this step ("Enviar copy para expert") opens a mandatory date popup;
// the picked date becomes the due date of the NEXT task created ("Esperando
// entrega do expert") instead of "today".
export const DATE_PROMPT_STEP_KEY = "enviar_copy_expert";

export function stepIndexByLabel(label: string): number {
  return CREATIVE_STEPS.findIndex((s) => s.label === label);
}

export function stepByLabel(label: string): CreativeStep | null {
  return CREATIVE_STEPS.find((s) => s.label === label) ?? null;
}

export function nextStepByLabel(label: string): CreativeStep | null {
  const idx = stepIndexByLabel(label);
  if (idx === -1 || idx >= CREATIVE_STEPS.length - 1) return null;
  return CREATIVE_STEPS[idx + 1];
}

// True if concluding a task at this label should ask for a date before creating
// the next task.
export function stepPromptsForDate(label: string): boolean {
  return stepByLabel(label)?.key === DATE_PROMPT_STEP_KEY;
}
