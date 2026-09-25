package ch.ethy.todo.service;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;

public record BoardFilter(Long listId, String label, TaskZone zone, boolean includeDone) {

  public static BoardFilter everything() {
    return new BoardFilter(null, null, null, false);
  }

  public static BoardFilter forList(Long listId) {
    return new BoardFilter(listId, null, null, false);
  }

  /**
   * Tidied the way a stored label is, so a filter can match one - but held to none of the rules
   * about what a topic may be called. Those decide whether a name is allowed; this only decides
   * what is being compared against, and a filter nothing can match is an empty board rather than a
   * refusal. That distinction matters because the board swallows a refusal and quietly keeps
   * showing whatever it had.
   */
  public BoardFilter {
    String tidied = Task.tidyLabel(label);
    label = tidied.isEmpty() ? null : tidied;
  }
}
