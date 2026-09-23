-- The slug existed to serve one lookup endpoint that nothing ever called. Names are already unique
-- per owner under their own constraint, so the list keeps every rule it had.
alter table task_list
    drop index uq_task_list_owner_slug,
    drop column slug;
