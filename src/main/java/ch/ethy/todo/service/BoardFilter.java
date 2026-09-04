package ch.ethy.todo.service;

import ch.ethy.todo.domain.Slug;
import ch.ethy.todo.domain.TaskZone;

/**
 * What to narrow the board to. Every field is optional; all null means "everything I can see",
 * which is the default view.
 *
 * @param listId restrict to one list — the sharing axis
 * @param label restrict to one topic — the axis that cuts across lists
 * @param zone restrict to one zone; the zone loads ignore this so all three stay visible
 * @param includeDone show completed tasks as well as open ones
 */
public record BoardFilter(Long listId, String label, TaskZone zone, boolean includeDone) {

  public static BoardFilter everything() {
    return new BoardFilter(null, null, null, false);
  }

  public static BoardFilter forList(Long listId) {
    return new BoardFilter(listId, null, null, false);
  }

  /** Labels are stored normalised, so a filter has to be normalised the same way to match. */
  public BoardFilter {
    label = (label == null || label.isBlank()) ? null : Slug.of(label);
  }
}
