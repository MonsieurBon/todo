package ch.ethy.todo.web.dto;

import static org.assertj.core.api.Assertions.assertThat;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ResponsesTest {

  private static final Instant NOW = Instant.parse("2026-09-03T10:00:00Z");
  private static final LocalDate TODAY = LocalDate.of(2026, 9, 3);

  /** A client reads a deferral it is sent as "out of sight", so a passed one must not arrive. */
  @Test
  @DisplayName("a task is sent with its deferral only while that still hides it")
  void deferUntilOnlyWhileHidden() {
    Task task = new Task("Renew passport", TaskZone.CRITICAL_NOW, NOW);
    task.deferUntil(TODAY.plusDays(3), TODAY, NOW);

    assertThat(Responses.TaskView.of(task, TODAY).deferUntil()).isEqualTo(TODAY.plusDays(3));
    assertThat(Responses.TaskView.of(task, TODAY.plusDays(3)).deferUntil()).isNull();
  }
}
