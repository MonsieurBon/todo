package ch.ethy.todo.domain;

import java.time.Duration;
import java.util.Optional;

public enum TaskZone {
  CRITICAL_NOW(5, Duration.ofHours(1)),
  OPPORTUNITY_NOW(20, Duration.ofDays(1)),
  OVER_THE_HORIZON(null, Duration.ofDays(7));

  private final Integer softCap;
  private final Duration reviewInterval;

  TaskZone(Integer softCap, Duration reviewInterval) {
    this.softCap = softCap;
    this.reviewInterval = reviewInterval;
  }

  public Optional<Integer> softCap() {
    return Optional.ofNullable(softCap);
  }

  public Duration reviewInterval() {
    return reviewInterval;
  }

  public boolean isOverSoftCap(int count) {
    return softCap != null && count > softCap;
  }
}
