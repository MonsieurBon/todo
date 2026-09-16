package ch.ethy.todo.service;

import ch.ethy.todo.domain.Slug;
import ch.ethy.todo.domain.TaskZone;

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
