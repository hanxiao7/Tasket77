-- Migration: Add hidden column to tags table
-- This migration adds a hidden column to the tags table to support hiding tags

-- Add hidden column to tags table with default value false
ALTER TABLE tags ADD COLUMN hidden BOOLEAN DEFAULT false;

-- Create index for hidden column for better performance
CREATE INDEX idx_tags_hidden ON tags(hidden); 