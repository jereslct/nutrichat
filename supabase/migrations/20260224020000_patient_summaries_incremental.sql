-- Add last_summarized_at to patient_summaries for incremental summary generation.
-- When set, generate-patient-summary only processes messages newer than this timestamp,
-- avoiding re-analyzing the full chat history on every doctor refresh.
ALTER TABLE patient_summaries ADD COLUMN last_summarized_at TIMESTAMPTZ;

-- Backfill existing rows so they're treated as already summarized up to their last update.
UPDATE patient_summaries SET last_summarized_at = COALESCE(updated_at, generated_at);
