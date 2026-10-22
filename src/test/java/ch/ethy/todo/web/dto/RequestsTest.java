package ch.ethy.todo.web.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RequestsTest {

  /** Half past midnight in Zurich, when UTC is still on the day before. */
  private static final Clock AFTER_MIDNIGHT_IN_ZURICH =
      Clock.fixed(Instant.parse("2026-10-21T22:30:00Z"), ZoneId.of("Europe/Zurich"));

  @Test
  @DisplayName("a deferral by days counts from the app's day, which in Zurich starts before UTC's")
  void daysCountFromTheAppsDay() {
    assertThat(new Requests.Defer(null, 1).date(AFTER_MIDNIGHT_IN_ZURICH))
        .isEqualTo(LocalDate.of(2026, 10, 23));
    assertThat(new Requests.DeferSelection(List.of(1L), null, 7).date(AFTER_MIDNIGHT_IN_ZURICH))
        .isEqualTo(LocalDate.of(2026, 10, 29));
  }

  @Test
  @DisplayName("a deferral to a date is that date, whatever day it is")
  void aDateIsThatDate() {
    assertThat(new Requests.Defer(LocalDate.of(2027, 1, 1), null).date(AFTER_MIDNIGHT_IN_ZURICH))
        .isEqualTo(LocalDate.of(2027, 1, 1));
  }

  @Test
  @DisplayName("a deferral needs a date or a number of days, and not both")
  void exactlyOne() {
    assertThatThrownBy(() -> new Requests.Defer(null, null).date(AFTER_MIDNIGHT_IN_ZURICH))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> new Requests.Defer(LocalDate.of(2027, 1, 1), 1).date(AFTER_MIDNIGHT_IN_ZURICH))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
