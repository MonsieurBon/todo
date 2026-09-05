package ch.ethy.todo.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ethy.todo.domain.TaskZone;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * The field bounds, enforced where both entry points meet.
 *
 * <p>The REST DTOs carry {@code @Size}, so an oversized title or note is refused at the boundary
 * with a 400. The MCP tools build these records straight from tool parameters and never touch a
 * DTO, so without a bound here the same input reaches MySQL and comes back as a truncation or a
 * flush-time integrity error — the wrong answer to give a caller that could act on a clear one.
 * Putting the limit in the record is the move this codebase already makes for authorization: make
 * it structural rather than repeat it per surface.
 */
class TaskFieldLimitsTest {

  private static String of(int length) {
    return "x".repeat(length);
  }

  @Nested
  @DisplayName("a new task")
  class Creating {

    @Test
    @DisplayName("refuses a title past the column width")
    void titleTooLong() {
      assertThatThrownBy(
              () -> new NewTask(of(256), TaskZone.OPPORTUNITY_NOW, null, null, List.of(), null))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("255");
    }

    @Test
    @DisplayName("refuses notes past what the API accepts")
    void notesTooLong() {
      assertThatThrownBy(
              () ->
                  new NewTask("Fine", TaskZone.OPPORTUNITY_NOW, of(10_001), null, List.of(), null))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("10000");
    }

    @Test
    @DisplayName("accepts both at exactly the limit")
    void atTheLimit() {
      assertThatCode(
              () ->
                  new NewTask(of(255), TaskZone.OPPORTUNITY_NOW, of(10_000), null, List.of(), null))
          .doesNotThrowAnyException();
    }
  }

  @Nested
  @DisplayName("an edit")
  class Editing {

    @Test
    @DisplayName("refuses a title past the column width")
    void titleTooLong() {
      assertThatThrownBy(() -> new TaskEdit(of(256), null, null))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("255");
    }

    @Test
    @DisplayName("refuses notes past what the API accepts")
    void notesTooLong() {
      assertThatThrownBy(() -> new TaskEdit(null, of(10_001), null))
          .isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("10000");
    }

    @Test
    @DisplayName("leaves a null field alone, since null means no change")
    void nullsAreFine() {
      assertThatCode(() -> new TaskEdit(null, null, null)).doesNotThrowAnyException();
    }
  }
}
