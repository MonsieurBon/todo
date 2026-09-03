package ch.ethy.todo.web.dto;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskState;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.domain.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Response bodies. Entities are never serialised directly, so nothing leaks by accident. */
public final class Responses {

  private Responses() {}

  public record TaskListSummary(
      Long id, String name, String slug, boolean inbox, boolean owned, List<String> sharedWith) {

    public static TaskListSummary of(TaskList list, User viewer) {
      return new TaskListSummary(
          list.id(),
          list.name(),
          list.slug(),
          list.isInbox(),
          list.isOwnedBy(viewer),
          list.members().stream().map(User::email).sorted().toList());
    }
  }

  public record TaskView(
      Long id,
      String title,
      String notes,
      TaskZone zone,
      TaskState state,
      LocalDate deferUntil,
      LocalDate dueDate,
      Instant lastReviewedAt) {

    public static TaskView of(Task task) {
      return new TaskView(
          task.id(),
          task.title(),
          task.notes(),
          task.zone(),
          task.state(),
          task.deferUntil(),
          task.dueDate(),
          task.lastReviewedAt());
    }
  }

  /**
   * How full a zone is against what the method says it should hold. {@code overSoftCap} is advice,
   * not an error — the API never refuses a write for being over a cap.
   */
  public record ZoneLoad(TaskZone zone, long open, Integer softCap, boolean overSoftCap) {

    public static List<ZoneLoad> of(Map<TaskZone, Long> counts) {
      return java.util.Arrays.stream(TaskZone.values())
          .map(
              zone -> {
                long open = counts.getOrDefault(zone, 0L);
                return new ZoneLoad(
                    zone, open, zone.softCap().orElse(null), zone.isOverSoftCap((int) open));
              })
          .toList();
    }
  }

  public record TaskListDetail(TaskListSummary list, List<ZoneLoad> zones, List<TaskView> tasks) {}

  public record ApiError(String error, String message, Map<String, String> fields) {}
}
