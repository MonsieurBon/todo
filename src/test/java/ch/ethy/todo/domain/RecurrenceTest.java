package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RecurrenceTest {

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 3);

  @Test
  @DisplayName("every N days, weeks or months counts that many of them on")
  void countsOn() {
    assertThat(new Recurrence(3, RecurrenceUnit.DAYS).after(TODAY))
        .isEqualTo(LocalDate.of(2026, 9, 6));
    assertThat(new Recurrence(2, RecurrenceUnit.WEEKS).after(TODAY))
        .isEqualTo(LocalDate.of(2026, 9, 17));
    assertThat(new Recurrence(1, RecurrenceUnit.MONTHS).after(TODAY))
        .isEqualTo(LocalDate.of(2026, 10, 3));
  }

  @Test
  @DisplayName("a month is a calendar month, so the 31st of January comes back on the 28th")
  void calendarMonths() {
    assertThat(new Recurrence(1, RecurrenceUnit.MONTHS).after(LocalDate.of(2027, 1, 31)))
        .isEqualTo(LocalDate.of(2027, 2, 28));
  }

  @Test
  @DisplayName("an interval runs from one to the limit")
  void bounds() {
    assertThat(new Recurrence(1, RecurrenceUnit.DAYS).every()).isEqualTo(1);
    assertThat(new Recurrence(Recurrence.MAX_EVERY, RecurrenceUnit.DAYS).every())
        .isEqualTo(Recurrence.MAX_EVERY);
    assertThatThrownBy(() -> new Recurrence(0, RecurrenceUnit.DAYS))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new Recurrence(Recurrence.MAX_EVERY + 1, RecurrenceUnit.DAYS))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining(String.valueOf(Recurrence.MAX_EVERY));
  }

  @Test
  @DisplayName("an interval needs a unit")
  void unitRequired() {
    assertThatThrownBy(() -> new Recurrence(1, null)).isInstanceOf(IllegalArgumentException.class);
  }
}
