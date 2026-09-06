package ch.ethy.todo.service;

import java.util.Collection;

/**
 * The bounds on a task's free text, in one place because two entry points reach it.
 *
 * <p>The REST DTOs declare the same numbers as {@code @Size} and so refuse an oversized field at
 * the boundary with a 400. The MCP tools build {@link NewTask} and {@link TaskEdit} straight from
 * tool parameters, with no DTO and no {@code @Valid} in between, so the check has to exist where
 * both paths meet or the second one reaches the database unchecked — and answers a truncation or a
 * flush-time integrity error instead of something the caller can act on.
 */
final class TaskFields {

  /** Matches {@code varchar(255)} in the schema. */
  static final int MAX_TITLE = 255;

  /** Well inside the {@code text} column; the number the API has always advertised. */
  static final int MAX_NOTES = 10_000;

  /** Matches {@code varchar(64)} in the schema, and {@code Requests.SetLabels}. */
  static final int MAX_LABEL = 64;

  /** No column forces this one — it is what keeps one call from writing unbounded rows. */
  static final int MAX_LABELS = 25;

  private TaskFields() {}

  static void checkTitle(String title) {
    if (title != null && title.length() > MAX_TITLE) {
      throw new IllegalArgumentException("A title is at most " + MAX_TITLE + " characters");
    }
  }

  static void checkNotes(String notes) {
    if (notes != null && notes.length() > MAX_NOTES) {
      throw new IllegalArgumentException("Notes are at most " + MAX_NOTES + " characters");
    }
  }

  /**
   * Bounds a label set both ways: each entry against its column, and the set against nothing in
   * particular — a task with hundreds of topics is not a task anyone can read, and one create call
   * should not be able to write unbounded rows.
   *
   * <p>Checked before {@code Slug.of} normalises, which is deliberate: the slug is shorter than
   * what was sent, so bounding the output would silently accept an entry the caller should have
   * been told about.
   */
  static void checkLabels(Collection<String> labels) {
    if (labels == null) {
      return;
    }
    if (labels.size() > MAX_LABELS) {
      throw new IllegalArgumentException("A task carries at most " + MAX_LABELS + " topics");
    }
    for (String label : labels) {
      if (label != null && label.length() > MAX_LABEL) {
        throw new IllegalArgumentException("A topic is at most " + MAX_LABEL + " characters");
      }
    }
  }
}
