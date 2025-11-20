-- Migration: Add auto-save columns to contract_agreements table
-- Run this in your Supabase SQL editor

ALTER TABLE contract_agreements
ADD COLUMN IF NOT EXISTS content_html TEXT,
ADD COLUMN IF NOT EXISTS content_text TEXT,
ADD COLUMN IF NOT EXISTS last_auto_saved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_save_version INTEGER DEFAULT 0;

-- Initialize auto_save_version for existing rows
UPDATE contract_agreements
SET auto_save_version = 0
WHERE auto_save_version IS NULL;

-- Create index for faster queries on last_auto_saved_at
CREATE INDEX IF NOT EXISTS idx_contract_agreements_last_auto_saved_at
ON contract_agreements(last_auto_saved_at);

