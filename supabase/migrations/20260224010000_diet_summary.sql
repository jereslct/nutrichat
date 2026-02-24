-- Add diet_summary column to diets table
-- Stores a compressed AI-generated summary (~500-800 tokens) used in chat context
-- instead of the full pdf_text, reducing token usage by ~88% per chat call.
ALTER TABLE diets ADD COLUMN diet_summary TEXT;
