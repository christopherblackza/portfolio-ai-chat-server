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

create table if not exists vectors (
  id uuid primary key default gen_random_uuid(),
  content text,
  embedding vector(1536),
  file_url text
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