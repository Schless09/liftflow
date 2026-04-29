-- Generator often emits "Bent-Over Row"; hyphen vs space broke alias match before norm() treated "-" as space.
update public.exercises
set aliases = (
  select coalesce(array_agg(x order by x), '{}')
  from (
    select distinct unnest(
      aliases || array['bent-over row', 'barbell bent-over row']
    ) as x
  ) s
)
where canonical_name = 'Barbell Row';
