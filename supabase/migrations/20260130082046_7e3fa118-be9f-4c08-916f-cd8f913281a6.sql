-- Create function to get database storage statistics
CREATE OR REPLACE FUNCTION public.get_database_storage_stats()
RETURNS TABLE (
  total_size text,
  tables_size text,
  generation_history_size text,
  zip_data_size text,
  table_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_size_pretty(pg_database_size(current_database())) as total_size,
    (SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)::regclass))) 
     FROM pg_tables WHERE schemaname = 'public') as tables_size,
    pg_size_pretty(pg_total_relation_size('generation_history')) as generation_history_size,
    COALESCE(
      (SELECT pg_size_pretty(SUM(LENGTH(zip_data))) FROM generation_history WHERE zip_data IS NOT NULL),
      '0 bytes'
    ) as zip_data_size,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as table_count;
END;
$$;