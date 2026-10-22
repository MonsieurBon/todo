package ch.ethy.todo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.time.LocalDate;

@Embeddable
public record Recurrence(
    @Column(name = "recur_every") int every,
    @Enumerated(EnumType.STRING) @Column(name = "recur_unit", length = 8) RecurrenceUnit unit) {

  public static final int MAX_EVERY = 999;

  public Recurrence {
    if (every < 1 || every > MAX_EVERY) {
      throw new IllegalArgumentException(
          "A task repeats every 1 to " + MAX_EVERY + " days, weeks or months, not " + every);
    }
    if (unit == null) {
      throw new IllegalArgumentException("A repeat needs days, weeks or months");
    }
  }

  /** Months are calendar months, so the 31st comes back on the last day of a shorter month. */
  public LocalDate after(LocalDate date) {
    return unit.plus(date, every);
  }
}
