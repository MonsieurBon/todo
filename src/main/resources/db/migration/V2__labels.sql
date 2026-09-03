-- Labels: the topic axis.
--
-- Lists are the sharing axis and labels are the topic axis, deliberately separated.
-- Topic-shaped lists would enforce the zone caps once per list, so "Critical Now at
-- most five" would quietly permit five per project - removing the one forcing function
-- the method depends on.
--
-- Plain strings rather than an entity: a label owned by a user has no clean answer on a
-- shared list (whose labels apply, and does the other person see yours?). Strings have no
-- owner, so anyone who can see the task sees its labels.

create table task_label
(
    task_id bigint      not null,
    label   varchar(64) not null,
    primary key (task_id, label),
    constraint fk_task_label_task foreign key (task_id) references task (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_0900_ai_ci;

-- Filtering the board by topic reads this column across every task the user can see.
create index idx_task_label_label on task_label (label);
