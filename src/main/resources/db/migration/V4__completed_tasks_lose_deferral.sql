update task
set defer_until = null
where state = 'DONE';
