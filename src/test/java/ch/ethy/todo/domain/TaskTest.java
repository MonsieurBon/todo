package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class TaskTest {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 3);

  private static Task task() {
    return new Task("Renew passport", TaskZone.OPPORTUNITY_NOW);
  }

  @Nested
  @DisplayName("creation")
  class Creation {

    @Test
    @DisplayName("a new task is open and undeferred")
    void defaults() {
      Task task = task();
      assertThat(task.state()).isEqualTo(TaskState.TODO);
      assertThat(task.zone()).isEqualTo(TaskZone.OPPORTUNITY_NOW);
      assertThat(task.deferUntil()).isNull();
      assertThat(task.isVisibleOn(TODAY)).isTrue();
    }

    @Test
    @DisplayName("a task needs a title")
    void titleRequired() {
      assertThatThrownBy(() -> new Task("  ", TaskZone.CRITICAL_NOW))
          .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("a task needs a zone")
    void zoneRequired() {
      assertThatThrownBy(() -> new Task("Renew passport", null))
          .isInstanceOf(IllegalArgumentException.class);
    }
  }

  @Nested
  @DisplayName("completion")
  class Completion {

    @Test
    @DisplayName("completing a task closes it")
    void complete() {
      Task task = task();
      task.complete();
      assertThat(task.state()).isEqualTo(TaskState.DONE);
      assertThat(task.isOpen()).isFalse();
    }

    @Test
    @DisplayName("reopening a completed task makes it open again")
    void reopen() {
      Task task = task();
      task.complete();
      task.reopen();
      assertThat(task.state()).isEqualTo(TaskState.TODO);
      assertThat(task.isOpen()).isTrue();
    }

    @Test
    @DisplayName("completing twice is harmless")
    void completeIsIdempotent() {
      Task task = task();
      task.complete();
      task.complete();
      assertThat(task.state()).isEqualTo(TaskState.DONE);
    }
  }

  @Nested
  @DisplayName("moving between zones")
  class Moving {

    @Test
    @DisplayName("a task can be promoted to Critical Now")
    void promote() {
      Task task = task();
      task.moveTo(TaskZone.CRITICAL_NOW);
      assertThat(task.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
    }

    @Test
    @DisplayName("promoting a deferred task clears the deferral")
    void promotingClearsDeferral() {
      Task task = task();
      task.deferUntil(TODAY.plusWeeks(2), TODAY);
      task.moveTo(TaskZone.CRITICAL_NOW);

      assertThat(task.deferUntil()).isNull();
      assertThat(task.isVisibleOn(TODAY)).isTrue();
    }

    @Test
    @DisplayName("a zone is required")
    void zoneRequired() {
      assertThatThrownBy(() -> task().moveTo(null)).isInstanceOf(IllegalArgumentException.class);
    }
  }

  @Nested
  @DisplayName("deferral")
  class Deferral {

    @Test
    @DisplayName("deferring pushes the task over the horizon")
    void deferMovesOverTheHorizon() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(10), TODAY);

      assertThat(task.zone()).isEqualTo(TaskZone.OVER_THE_HORIZON);
      assertThat(task.deferUntil()).isEqualTo(TODAY.plusDays(10));
    }

    @Test
    @DisplayName("a deferred task is hidden until its date arrives")
    void hiddenUntilDue() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(3), TODAY);

      assertThat(task.isVisibleOn(TODAY)).isFalse();
      assertThat(task.isVisibleOn(TODAY.plusDays(2))).isFalse();
    }

    @Test
    @DisplayName("a deferred task resurfaces on the day it is due, not after")
    void resurfacesOnTheDay() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(3), TODAY);

      assertThat(task.isVisibleOn(TODAY.plusDays(3))).isTrue();
      assertThat(task.isVisibleOn(TODAY.plusDays(4))).isTrue();
    }

    @Test
    @DisplayName("deferral cannot be set in the past")
    void noBackdating() {
      assertThatThrownBy(() -> task().deferUntil(TODAY.minusDays(1), TODAY))
          .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("clearing a deferral makes the task visible again")
    void clearDeferral() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(5), TODAY);
      task.clearDeferral();

      assertThat(task.deferUntil()).isNull();
      assertThat(task.isVisibleOn(TODAY)).isTrue();
    }
  }
}
