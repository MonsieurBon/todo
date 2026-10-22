-- How often a task repeats: both columns or neither, since an interval without its unit means
-- nothing. A completed task hands its setting on to the copy its completion adds.
alter table task
    add column recur_every int null,
    add column recur_unit varchar(8) null,
    add constraint ck_task_recurrence check ((recur_every is null) = (recur_unit is null));
