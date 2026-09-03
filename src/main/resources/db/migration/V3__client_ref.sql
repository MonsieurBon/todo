-- A client's own reference for a task, so an offline capture can be replayed safely.
--
-- The web app queues captures made without a connection and flushes them when it returns.
-- A replay cannot distinguish "the request never arrived" from "the response never came
-- back", so without this column the second case silently files the task twice - the one
-- failure mode a user notices immediately.
--
-- Scoped per list rather than globally on purpose: the lookup that deduplicates resolves
-- the list first (and so the caller's access to it), and a unique constraint wider than
-- that lookup would turn one person's guessed reference into another person's constraint
-- violation. Nullable, because every other client - the API, the MCP tools - has no queue
-- and needs none; MySQL permits any number of nulls in a unique index.

alter table task
    add column client_ref varchar(64) null after task_list_id;

alter table task
    add constraint uq_task_list_client_ref unique (task_list_id, client_ref);
