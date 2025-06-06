create index on public.vectors using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

analyze public.vectors;

ALTER TABLE public.vectors DISABLE ROW LEVEL SECURITY;




-- Enable RLS if it's not already
ALTER TABLE public.vectors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow INSERTs
CREATE POLICY "Allow insert"
ON public.vectors
FOR INSERT
WITH CHECK (true);

alter table public.vectors enable row level security;

create extension if not exists vector;

-- create table if not exists vectors (
--   id uuid primary key default gen_random_uuid(),
--   content text,
--   embedding vector(1536),
--   file_url text
-- );

CREATE TABLE vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text,
  embedding vector(1536), -- or 3072 for 'text-embedding-3-large'
  file_url text,
  file_name text,
  chunk_index integer,
  total_chunks integer,
  uploaded_at timestamp,
  source_type text
);



CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  content text,
  file_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vectors.id,
    vectors.content,
    vectors.file_url,
    1 - (vectors.embedding <=> query_embedding) AS similarity
  FROM vectors
  WHERE 1 - (vectors.embedding <=> query_embedding) > match_threshold
  ORDER BY vectors.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- Add memory storage 

-- Add to your existing supabase-scripts.sql file

-- Conversation sessions table
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  session_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  metadata jsonb
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_history_session_id ON conversation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_timestamp ON conversation_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);

-- Enable RLS
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on conversation_sessions" ON conversation_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on conversation_history" ON conversation_history FOR ALL USING (true);