-- Migration: Rename tags to categories
-- This migration renames the tags table to categories and updates all related references

-- Rename the tags table to categories
ALTER TABLE tags RENAME TO categories;

-- Rename the tag_id column in tasks table to category_id
ALTER TABLE tasks RENAME COLUMN tag_id TO category_id;

-- Update the index name
ALTER INDEX idx_tags_workspace_id RENAME TO idx_categories_workspace_id;

-- Drop and recreate the foreign key constraint with the new name
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_tag_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- Drop and recreate the unique constraint with the new name
ALTER TABLE categories DROP CONSTRAINT IF EXISTS tags_name_workspace_id_key;
ALTER TABLE categories ADD CONSTRAINT categories_name_workspace_id_key UNIQUE(name, workspace_id); 