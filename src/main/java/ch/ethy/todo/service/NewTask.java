package ch.ethy.todo.service;

import ch.ethy.todo.domain.TaskZone;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/**
 * A task about to be created, from whichever direction.
 *
 * <p>A record rather than a growing parameter list: capture and create differ only in whether a
 * list was named, and every field added to one was previously added to both signatures by hand —
 * which is how {@code notes} and {@code dueDate} came to be accepted by the API and then dropped on
 * the floor.
 *
 * @param clientRef the caller's own reference, which makes the create safe to replay; null for
 *     every caller without an offline queue
 */
public record NewTask(
    String title,
    TaskZone zone,
    String notes,
    LocalDate dueDate,
    Collection<String> labels,
    String clientRef) {

  public NewTask {
    labels = labels == null ? List.of() : List.copyOf(labels);
  }
}
