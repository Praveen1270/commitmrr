drop function if exists public.get_public_leaderboard();

create or replace function public.get_public_leaderboard()
returns table (
  user_id uuid,
  startup_slug text,
  commit_count bigint,
  mrr text,
  all_time_revenue text
)
language sql
security definer
set search_path = public
as $$
  select
    pc.user_id,
    coalesce(
      pc.config #>> '{selectedStartup,slug}',
      pc.config #>> '{matchedStartup,slug}'
    ) as startup_slug,
    coalesce(sum(dcm.commit_count), 0)::bigint as commit_count,
    coalesce(
      pc.config #>> '{selectedStartup,mrr}',
      pc.config #>> '{matchedStartup,mrr}'
    ) as mrr,
    coalesce(
      pc.config #>> '{selectedStartup,allTimeRevenue}',
      pc.config #>> '{matchedStartup,allTimeRevenue}'
    ) as all_time_revenue
  from public.provider_connections pc
  left join public.github_repositories gr
    on gr.user_id = pc.user_id
    and gr.is_tracked = true
  left join public.daily_commit_metrics dcm
    on dcm.user_id = pc.user_id
    and dcm.repository_id = gr.id
  where
    pc.provider = 'github'
    and coalesce(
      pc.config #>> '{selectedStartup,slug}',
      pc.config #>> '{matchedStartup,slug}'
    ) is not null
  group by pc.user_id, startup_slug, mrr, all_time_revenue
  order by commit_count desc;
$$;

grant execute on function public.get_public_leaderboard() to anon, authenticated;
