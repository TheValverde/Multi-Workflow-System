-- Migration: Create artifact_extracts table for text extraction from artifacts
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS artifact_extracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES estimate_artifacts(id) ON DELETE CASCADE,
  content_text TEXT,
  content_html TEXT,
  summary TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'ready', 'failed')),
  error_message TEXT,
  extracted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by artifact_id
CREATE INDEX IF NOT EXISTS idx_artifact_extracts_artifact_id
ON artifact_extracts(artifact_id);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_artifact_extracts_status
ON artifact_extracts(extraction_status);

-- Enable Row Level Security
ALTER TABLE artifact_extracts ENABLE ROW LEVEL SECURITY;

-- Create policy (allow read access for all users)
CREATE POLICY "Enable read access for all users" ON artifact_extracts
  FOR SELECT USING (true);

-- Create policy (allow insert/update for service role)
CREATE POLICY "Enable insert/update for service role" ON artifact_extracts
  FOR ALL USING (true);

