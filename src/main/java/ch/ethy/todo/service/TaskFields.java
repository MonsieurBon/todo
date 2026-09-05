package ch.ethy.todo.service;

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
}
