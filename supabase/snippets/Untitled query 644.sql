SELECT setval(
  'public.policy_number_seq',
  greatest(
    1000,
    coalesce(
      (
        select max(
          nullif(regexp_replace(p.policy_number, '\D', '', 'g'), '')::bigint
        )
        from public.policy p
      ),
      1000
    )
  )
);