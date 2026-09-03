-- One Minute To-Do List: initial schema.
--
-- utf8mb4 throughout. The previous version of this app declared utf8mb4 on the
-- connection but created its tables as 3-byte utf8, so emoji in a task title were
-- silently rejected by the database.

create table app_user
(
    id           bigint       not null auto_increment,
    -- The IdP's `sub` claim. Authentication is delegated, so there is deliberately
    -- no password column here and never will be.
    external_id  varchar(255) not null,
    email        varchar(255) not null,
    display_name varchar(255) not null,
    created_at   datetime(6)  not null,
    primary key (id),
    constraint uq_app_user_external_id unique (external_id)
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_0900_ai_ci;

create table task_list
(
    id         bigint       not null auto_increment,
    owner_id   bigint       not null,
    name       varchar(255) not null,
    slug       varchar(128) not null,
    -- Where a capture-only client files a task when it names no list. Such a client
    -- cannot read lists, so it cannot choose one.
    is_inbox   bit(1)       not null default b'0',
    created_at datetime(6)  not null,
    primary key (id),
    -- Unique per owner, not globally. The previous version made slugs globally
    -- non-unique and resolved them by scanning, so a list shared with you could
    -- shadow your own list of the same name.
    constraint uq_task_list_owner_slug unique (owner_id, slug),
    constraint uq_task_list_owner_name unique (owner_id, name),
    constraint fk_task_list_owner foreign key (owner_id) references app_user (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_0900_ai_ci;

create table task_list_member
(
    task_list_id bigint not null,
    user_id      bigint not null,
    primary key (task_list_id, user_id),
    constraint fk_tlm_task_list foreign key (task_list_id) references task_list (id) on delete cascade,
    constraint fk_tlm_user foreign key (user_id) references app_user (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_0900_ai_ci;

create table task
(
    id               bigint       not null auto_increment,
    task_list_id     bigint       not null,
    title            varchar(255) not null,
    notes            text,
    -- Zone and state are stored as strings, not ordinals, so reordering either enum
    -- cannot silently reinterpret every row already in the table.
    zone             varchar(32)  not null,
    state            varchar(16)  not null,
    -- When you want to see this again. Distinct from due_date, which is when it must
    -- be finished; most tasks have one without the other.
    defer_until      date,
    due_date         date,
    sort_order       integer      not null default 0,
    last_reviewed_at datetime(6),
    created_at       datetime(6)  not null,
    updated_at       datetime(6)  not null,
    primary key (id),
    constraint fk_task_task_list foreign key (task_list_id) references task_list (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_0900_ai_ci;

create index idx_task_list_zone_state on task (task_list_id, zone, state);
