-- A topic is identified by how it is spelled. Two spellings are two topics, and keeping them apart
-- is the user's to do - the capture form offers the topics already in use, which is what makes that
-- reasonable to ask.
--
-- Compared by code point, which is exactly what a Java Set means by two equal strings. Every other
-- collation folds something: ai_ci folds case and accents, and even as_cs still folds canonical
-- equivalence and every default-ignorable code point - a soft hyphen, a variation selector - so two
-- topics the domain keeps apart would be one key here and the second insert would be refused.
-- Getting that wrong is not cosmetic: the write is lost, and on a capture it is lost silently.
--
-- What the domain will store is narrow enough that nothing this distinguishes can arrive invisibly.
--
-- Tightening only splits groups, so nothing that fits today can collide tomorrow.
alter table task_label
    modify label varchar(64) collate utf8mb4_0900_bin not null;
