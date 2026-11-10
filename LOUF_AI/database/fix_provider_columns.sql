-- Run only against the database configured in your project's .env.
-- These statements are for the two common tables that may store provider.
-- If a column already exists, skip its ALTER TABLE statement.

ALTER TABLE conversations
ADD COLUMN provider VARCHAR(40) NOT NULL DEFAULT 'openai';

ALTER TABLE messages
ADD COLUMN provider VARCHAR(40) NULL AFTER role;
