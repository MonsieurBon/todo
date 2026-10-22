package ch.ethy.todo.domain;

import java.time.LocalDate;

public enum RecurrenceUnit {
  DAYS,
  WEEKS,
  MONTHS;

  LocalDate plus(LocalDate date, int count) {
    return switch (this) {
      case DAYS -> date.plusDays(count);
      case WEEKS -> date.plusWeeks(count);
      case MONTHS -> date.plusMonths(count);
    };
  }
}
