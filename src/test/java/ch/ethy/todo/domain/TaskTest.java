package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class TaskTest {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 3);
  private static final Instant NOW = Instant.parse("2026-09-03T10:00:00Z");

  private static Task task() {
    return new Task("Renew passport", TaskZone.OPPORTUNITY_NOW, NOW);
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
    @DisplayName("choosing its zone at capture is a review, so the sweep waits a full interval")
    void captureIsReviewing() {
      Task task = task();

      assertThat(task.lastReviewedAt()).isEqualTo(NOW);
      assertThat(task.isReviewDue(NOW.plus(Duration.ofHours(23)))).isFalse();
      assertThat(task.isReviewDue(NOW.plus(Duration.ofDays(1)))).isTrue();
    }

    @Test
    @DisplayName("a task needs a title")
    void titleRequired() {
      assertThatThrownBy(() -> new Task("  ", TaskZone.CRITICAL_NOW, NOW))
          .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("a task needs a zone")
    void zoneRequired() {
      assertThatThrownBy(() -> new Task("Renew passport", null, NOW))
          .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("a title as long as the column allows is accepted")
    void titleAtTheLimit() {
      String title = "t".repeat(Task.MAX_TITLE_LENGTH);
      assertThat(new Task(title, TaskZone.OPPORTUNITY_NOW, NOW).title()).isEqualTo(title);
    }

    @Test
    @DisplayName("a longer title is refused, and the refusal names the limit")
    void titleTooLong() {
      assertThatThrownBy(
              () -> new Task("t".repeat(Task.MAX_TITLE_LENGTH + 1), TaskZone.OPPORTUNITY_NOW, NOW))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining(String.valueOf(Task.MAX_TITLE_LENGTH));
    }

    @Test
    @DisplayName("a title of emoji is measured in characters, as the column counts them")
    void titleMeasuredInCharacters() {
      String title = "\uD83E\uDDF9".repeat(Task.MAX_TITLE_LENGTH);
      assertThat(title.length())
          .as("two UTF-16 code units each, so measuring those would refuse this")
          .isEqualTo(Task.MAX_TITLE_LENGTH * 2);
      assertThat(new Task(title, TaskZone.OPPORTUNITY_NOW, NOW).title()).isEqualTo(title);
    }

    @Test
    @DisplayName("one character too many is refused however wide the characters are")
    void titleOfEmojiStillHasALimit() {
      assertThatThrownBy(
              () ->
                  new Task(
                      "\uD83E\uDDF9".repeat(Task.MAX_TITLE_LENGTH + 1),
                      TaskZone.OPPORTUNITY_NOW,
                      NOW))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining(String.valueOf(Task.MAX_TITLE_LENGTH + 1));
    }

    @Test
    @DisplayName("surrounding whitespace does not count towards the limit")
    void titleTrimmedBeforeMeasuring() {
      String title = "t".repeat(Task.MAX_TITLE_LENGTH);
      assertThat(new Task("  " + title + "  ", TaskZone.OPPORTUNITY_NOW, NOW).title())
          .isEqualTo(title);
    }
  }

  @Nested
  @DisplayName("completion")
  class Completion {

    @Test
    @DisplayName("completing a task closes it")
    void complete() {
      Task task = task();
      task.complete(TODAY, NOW);
      assertThat(task.state()).isEqualTo(TaskState.DONE);
      assertThat(task.isOpen()).isFalse();
    }

    @Test
    @DisplayName("reopening a completed task makes it open again")
    void reopen() {
      Task task = task();
      task.complete(TODAY, NOW);
      task.reopen();
      assertThat(task.state()).isEqualTo(TaskState.TODO);
      assertThat(task.isOpen()).isTrue();
    }

    @Test
    @DisplayName("completing a deferred task clears the deferral, so reopening shows it again")
    void completingClearsDeferral() {
      Task task = task();
      task.deferUntil(TODAY.plusWeeks(2), TODAY, NOW);
      task.complete(TODAY, NOW);

      assertThat(task.deferUntil()).isNull();
      task.reopen();
      assertThat(task.isVisibleOn(TODAY)).isTrue();
    }

    @Test
    @DisplayName("completing twice is harmless")
    void completeIsIdempotent() {
      Task task = task();
      task.complete(TODAY, NOW);
      task.complete(TODAY, NOW);
      assertThat(task.state()).isEqualTo(TaskState.DONE);
    }
  }

  @Nested
  @DisplayName("a repeating task")
  class Repeating {

    private static final Recurrence WEEKLY = new Recurrence(1, RecurrenceUnit.WEEKS);
    private static final Instant LATER = NOW.plus(Duration.ofDays(2));

    private static Task weekly() {
      Task task = task();
      task.recurrence(WEEKLY);
      return task;
    }

    @Test
    @DisplayName("completing it adds a copy that carries everything but the completion")
    void copies() {
      Task task = weekly();
      task.notes("Both of them");
      task.labels(List.of("house", "paperwork"));
      task.moveTo(TaskZone.CRITICAL_NOW, NOW);
      task.clientRef("offline-1");

      Task copy = task.complete(TODAY, LATER).orElseThrow();

      assertThat(copy.title()).isEqualTo("Renew passport");
      assertThat(copy.notes()).isEqualTo("Both of them");
      assertThat(copy.labels()).containsExactly("house", "paperwork");
      assertThat(copy.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
      assertThat(copy.recurrence()).isEqualTo(WEEKLY);
      assertThat(copy.isOpen()).isTrue();
      assertThat(copy.lastReviewedAt()).isEqualTo(LATER);
      // Unique per list: the copy is not the capture that reference identifies.
      assertThat(copy.clientRef()).isNull();
    }

    @Test
    @DisplayName("without a due date, the copy is hidden for one interval from today")
    void withoutDueDateDeferred() {
      Task copy = weekly().complete(TODAY, NOW).orElseThrow();

      assertThat(copy.deferUntil()).isEqualTo(TODAY.plusWeeks(1));
      assertThat(copy.dueDate()).isNull();
    }

    @Test
    @DisplayName("with a due date, the copy is due one interval later and not hidden")
    void withDueDateNotDeferred() {
      Task task = weekly();
      task.dueDate(TODAY.plusDays(3));

      Task copy = task.complete(TODAY, NOW).orElseThrow();

      assertThat(copy.dueDate()).isEqualTo(TODAY.plusDays(3).plusWeeks(1));
      assertThat(copy.deferUntil()).isNull();
    }

    @Test
    @DisplayName("a copy of a task completed late is due when the interval says, even if past")
    void lateCopyStaysOverdue() {
      Task task = weekly();
      task.dueDate(TODAY.minusWeeks(3));

      assertThat(task.complete(TODAY, NOW).orElseThrow().dueDate()).isEqualTo(TODAY.minusWeeks(2));
    }

    @Test
    @DisplayName("completing it clears the setting, so reopening it does not bring it back")
    void settingMovesToTheCopy() {
      Task task = weekly();
      task.complete(TODAY, NOW);

      assertThat(task.recurrence()).isNull();
      task.reopen();
      assertThat(task.recurrence()).isNull();
    }

    @Test
    @DisplayName("completing it twice adds one copy, so a replayed completion is harmless")
    void oneCopyPerCompletion() {
      Task task = weekly();

      assertThat(task.complete(TODAY, NOW)).isPresent();
      assertThat(task.complete(TODAY, NOW)).isEmpty();
    }

    @Test
    @DisplayName(
        "completing it is refused when the copy would fall due past the last date the column holds,"
            + " and changes nothing")
    void noCopyBeyondTheColumn() {
      Task last = weekly();
      last.dueDate(Task.LAST_DATE.minusWeeks(1));
      assertThat(last.complete(TODAY, NOW).orElseThrow().dueDate()).isEqualTo(Task.LAST_DATE);

      Task task = weekly();
      task.dueDate(Task.LAST_DATE.minusDays(6));
      assertThatThrownBy(() -> task.complete(TODAY, NOW))
          .isInstanceOf(TaskStateException.class)
          .hasMessageContaining(Task.LAST_DATE.toString());
      assertThat(task.isOpen()).isTrue();
      assertThat(task.recurrence()).isEqualTo(WEEKLY);
    }

    @Test
    @DisplayName("a task that does not repeat adds nothing when completed")
    void noRecurrenceNoCopy() {
      assertThat(task().complete(TODAY, NOW)).isEmpty();
    }

    @Test
    @DisplayName(
        "changing the setting is not a review: it says nothing about where the task belongs")
    void settingIsNotReviewing() {
      Task task = task();
      task.recurrence(WEEKLY);
      task.recurrence(null);

      assertThat(task.lastReviewedAt()).isEqualTo(NOW);
    }
  }

  @Nested
  @DisplayName("a completed task is read-only")
  class CompletedIsReadOnly {

    private static Task completed() {
      Task task = task();
      task.complete(TODAY, NOW);
      return task;
    }

    @Test
    @DisplayName("it cannot be retitled, renoted, given a due date or set to repeat")
    void noEditing() {
      assertThatThrownBy(() -> completed().title("Renew passport urgently"))
          .isInstanceOf(TaskCompletedException.class);
      assertThatThrownBy(() -> completed().notes("Booked an appointment"))
          .isInstanceOf(TaskCompletedException.class);
      assertThatThrownBy(() -> completed().dueDate(TODAY.plusDays(7)))
          .isInstanceOf(TaskCompletedException.class);
      assertThatThrownBy(() -> completed().recurrence(new Recurrence(1, RecurrenceUnit.DAYS)))
          .isInstanceOf(TaskCompletedException.class);
    }

    @Test
    @DisplayName("it cannot be moved to another zone")
    void noMoving() {
      assertThatThrownBy(() -> completed().moveTo(TaskZone.CRITICAL_NOW, NOW))
          .isInstanceOf(TaskCompletedException.class);
    }

    @Test
    @DisplayName("it cannot be deferred, or brought back from a deferral")
    void noDeferring() {
      assertThatThrownBy(() -> completed().deferUntil(TODAY.plusWeeks(2), TODAY, NOW))
          .isInstanceOf(TaskCompletedException.class);
      assertThatThrownBy(() -> completed().undefer(NOW)).isInstanceOf(TaskCompletedException.class);
    }

    @Test
    @DisplayName(
        "it cannot be marked reviewed: the queue excludes it, but the endpoints take any id")
    void noReviewing() {
      assertThatThrownBy(() -> completed().markReviewed(NOW))
          .isInstanceOf(TaskCompletedException.class);
    }

    @Test
    @DisplayName("every other setter refuses too, so a new one is not judged case by case")
    void noOtherChanges() {
      assertThatThrownBy(() -> completed().position(3)).isInstanceOf(TaskCompletedException.class);
      assertThatThrownBy(() -> completed().clientRef("abc"))
          .isInstanceOf(TaskCompletedException.class);
    }

    @Test
    @DisplayName("it cannot be relabelled")
    void noRelabelling() {
      assertThatThrownBy(() -> completed().labels(List.of("passport")))
          .isInstanceOf(TaskCompletedException.class);
      assertThatThrownBy(() -> completed().addLabel("passport"))
          .isInstanceOf(TaskCompletedException.class);
      assertThatThrownBy(() -> completed().removeLabel("passport"))
          .isInstanceOf(TaskCompletedException.class);
    }

    @Test
    @DisplayName("a refused deferral leaves the task where it was, hiding nothing")
    void refusedDeferralChangesNothing() {
      Task task = task();
      task.moveTo(TaskZone.CRITICAL_NOW, NOW);
      task.complete(TODAY, NOW);

      assertThatThrownBy(() -> task.deferUntil(TODAY.plusWeeks(2), TODAY, NOW))
          .isInstanceOf(TaskCompletedException.class);

      assertThat(task.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
      assertThat(task.deferUntil()).isNull();
      task.reopen();
      assertThat(task.isVisibleOn(TODAY)).isTrue();
    }

    @Test
    @DisplayName("reopening is the way back: afterwards it takes changes again")
    void reopeningRestoresIt() {
      Task task = completed();
      task.reopen();

      task.title("Renew passport urgently");
      task.moveTo(TaskZone.CRITICAL_NOW, NOW);
      task.labels(List.of("passport"));

      assertThat(task.title()).isEqualTo("Renew passport urgently");
      assertThat(task.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
      assertThat(task.labels()).containsExactly("passport");
    }
  }

  @Nested
  @DisplayName("moving between zones")
  class Moving {

    @Test
    @DisplayName("a task can be promoted to Critical Now")
    void promote() {
      Task task = task();
      task.moveTo(TaskZone.CRITICAL_NOW, NOW);
      assertThat(task.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
    }

    @Test
    @DisplayName("promoting a deferred task clears the deferral")
    void promotingClearsDeferral() {
      Task task = task();
      task.deferUntil(TODAY.plusWeeks(2), TODAY, NOW);
      task.moveTo(TaskZone.CRITICAL_NOW, NOW);

      assertThat(task.deferUntil()).isNull();
      assertThat(task.isVisibleOn(TODAY)).isTrue();
    }

    @Test
    @DisplayName("a zone is required")
    void zoneRequired() {
      assertThatThrownBy(() -> task().moveTo(null, NOW))
          .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("deciding where a task belongs is a review, so it leaves the sweep")
    void movingIsReviewing() {
      Task task = task();
      task.moveTo(TaskZone.CRITICAL_NOW, NOW);

      assertThat(task.lastReviewedAt()).isEqualTo(NOW);
      assertThat(task.isReviewDue(NOW)).isFalse();
    }
  }

  @Nested
  @DisplayName("deferral")
  class Deferral {

    @Test
    @DisplayName("deferring hides the task in its own zone, so it comes back where it was")
    void deferKeepsTheZone() {
      Task task = new Task("Call the landlord", TaskZone.CRITICAL_NOW, NOW);
      task.deferUntil(TODAY.plusDays(10), TODAY, NOW);

      assertThat(task.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
      assertThat(task.deferUntil()).isEqualTo(TODAY.plusDays(10));
    }

    @Test
    @DisplayName("a deferred task is hidden until its date arrives")
    void hiddenUntilDue() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(3), TODAY, NOW);

      assertThat(task.isVisibleOn(TODAY)).isFalse();
      assertThat(task.isVisibleOn(TODAY.plusDays(2))).isFalse();
    }

    @Test
    @DisplayName("a deferred task resurfaces on the day it is due, not after")
    void resurfacesOnTheDay() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(3), TODAY, NOW);

      assertThat(task.isVisibleOn(TODAY.plusDays(3))).isTrue();
      assertThat(task.isVisibleOn(TODAY.plusDays(4))).isTrue();
    }

    @Test
    @DisplayName("bringing a deferred task back shows it now, in its zone, and is a review")
    void undeferring() {
      Task task = new Task("Call the landlord", TaskZone.CRITICAL_NOW, NOW);
      task.deferUntil(TODAY.plusDays(10), TODAY, NOW);
      Instant later = NOW.plusSeconds(3600);

      task.undefer(later);

      assertThat(task.deferUntil()).isNull();
      assertThat(task.isVisibleOn(TODAY)).isTrue();
      assertThat(task.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
      assertThat(task.lastReviewedAt()).isEqualTo(later);
    }

    @Test
    @DisplayName("a deferral has a date to say only while the task is out of sight")
    void deferredUntilOnlyWhileHidden() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(3), TODAY, NOW);

      assertThat(task.deferredUntil(TODAY.plusDays(2))).isEqualTo(TODAY.plusDays(3));
      assertThat(task.deferredUntil(TODAY.plusDays(3))).isNull();
      assertThat(task().deferredUntil(TODAY)).isNull();
    }

    @Test
    @DisplayName("deciding when to see a task again is a review, so it leaves the sweep")
    void deferringIsReviewing() {
      Task task = task();
      task.deferUntil(TODAY.plusDays(3), TODAY, NOW);

      assertThat(task.lastReviewedAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("deferral cannot be set in the past")
    void noBackdating() {
      assertThatThrownBy(() -> task().deferUntil(TODAY.minusDays(1), TODAY, NOW))
          .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("a deferral past the last date the column holds is refused, and changes nothing")
    void noFurtherThanTheColumn() {
      Task task = task();
      task.deferUntil(Task.LAST_DATE, TODAY, NOW);
      assertThat(task.deferUntil()).isEqualTo(Task.LAST_DATE);

      Task other = task();
      assertThatThrownBy(() -> other.deferUntil(Task.LAST_DATE.plusDays(1), TODAY, NOW))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining(Task.LAST_DATE.toString());
      assertThat(other.deferUntil()).isNull();
    }
  }

  @Nested
  @DisplayName("due date")
  class DueDate {

    @Test
    @DisplayName("a due date past the last date the column holds is refused, and changes nothing")
    void noFurtherThanTheColumn() {
      Task task = task();
      task.dueDate(Task.LAST_DATE);
      assertThat(task.dueDate()).isEqualTo(Task.LAST_DATE);

      assertThatThrownBy(() -> task.dueDate(Task.LAST_DATE.plusDays(1)))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining(Task.LAST_DATE.toString());
      assertThat(task.dueDate()).isEqualTo(Task.LAST_DATE);
    }
  }

  @Nested
  @DisplayName("notes")
  class Notes {

    @Test
    @DisplayName("notes as long as the limit allows are kept")
    void atTheLimit() {
      Task task = task();
      String notes = "n".repeat(Task.MAX_NOTES_LENGTH);
      task.notes(notes);
      assertThat(task.notes()).isEqualTo(notes);
    }

    @Test
    @DisplayName("longer notes are refused, and the refusal names the limit")
    void tooLong() {
      assertThatThrownBy(() -> task().notes("n".repeat(Task.MAX_NOTES_LENGTH + 1)))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining(String.valueOf(Task.MAX_NOTES_LENGTH));
    }

    @Test
    @DisplayName("a task may have no notes at all")
    void absent() {
      Task task = task();
      task.notes(null);
      assertThat(task.notes()).isNull();
    }
  }

  @Nested
  @DisplayName("client reference")
  class ClientRef {

    @Test
    @DisplayName("a reference longer than the column is refused")
    void tooLong() {
      assertThatThrownBy(() -> task().clientRef("r".repeat(Task.MAX_CLIENT_REF_LENGTH + 1)))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining(String.valueOf(Task.MAX_CLIENT_REF_LENGTH));
    }

    @Test
    @DisplayName("a blank reference is absent, not an empty string")
    void blankIsAbsent() {
      Task task = task();
      task.clientRef("   ");
      assertThat(task.clientRef()).isNull();
    }
  }
}
