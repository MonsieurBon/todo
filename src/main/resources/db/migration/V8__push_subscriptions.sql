-- A device that asked for Critical Now as a notification. The endpoint is the push service's URL
-- for that one device, so it is the device's identity here: one row per endpoint, whoever
-- registered it last.
create table push_subscription
(
    id         bigint        not null auto_increment,
    user_id    bigint        not null,
    -- ascii, so a URL this long still fits a unique index.
    endpoint   varchar(2048) character set ascii collate ascii_bin not null,
    p256dh     varchar(88)   character set ascii collate ascii_bin not null,
    auth       varchar(24)   character set ascii collate ascii_bin not null,
    -- SHA-256 of the last payload the push service accepted, hex: what the device shows now.
    last_sent  char(64)      character set ascii null,
    created_at datetime(6)   not null,
    primary key (id),
    constraint uq_push_subscription_endpoint unique (endpoint),
    constraint fk_push_subscription_user foreign key (user_id) references app_user (id) on delete cascade
) engine = InnoDB
  default charset = utf8mb4
  collate = utf8mb4_0900_ai_ci;
