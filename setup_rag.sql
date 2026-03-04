-- 1. Asegurar que la extensión vectorial esté activa
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Crear la tabla de Memoria de la IA
CREATE TABLE IF NOT EXISTS ai_memory (
  id BIGSERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(768)
);

-- 3. Crear la Función de Similitud (Búsqueda Vectorial)
CREATE OR REPLACE FUNCTION match_ai_memory (
  query_embedding vector(768),
  match_threshold float,
  match_count int
) RETURNS TABLE (id bigint, content text, similarity float) LANGUAGE sql STABLE AS $$
  SELECT 
    ai_memory.id, 
    ai_memory.content, 
    1 - (ai_memory.embedding <=> query_embedding) AS similarity 
  FROM ai_memory 
  WHERE 1 - (ai_memory.embedding <=> query_embedding) > match_threshold 
  ORDER BY similarity DESC 
  LIMIT match_count;
$$;
