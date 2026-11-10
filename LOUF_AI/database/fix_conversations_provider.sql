-- Run this in phpMyAdmin against the database configured by DB_NAME in .env.
-- Do not run it against a different database.
ALTER TABLE conversations
ADD COLUMN provider VARCHAR(40) NOT NULL DEFAULT 'openai' AFTER title;
