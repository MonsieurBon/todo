package ch.ethy.todo.domain;

import java.time.Duration;
import java.util.Optional;

/**
 * The three urgency zones of Michael Linenberger's One Minute To-Do List.
 *
 * <p>The zones alone are not the method — the previous version of this app had them and was still
 * just a task list. What makes it work is the discipline attached to each zone: a cap on how many
 * items may sit there, and how often the zone is swept.
 *
 * <p>Caps are deliberately <em>soft</em>. Exceeding one is a prompt to triage, never a validation
 * error, so nothing here rejects a write. Declaration order is urgency order, most urgent first.
 */
public enum TaskZone {

  /** Must be done today. Worked continuously rather than swept, so it has no review interval. */
  CRITICAL_NOW(5, null),

  /** Do soon, whenever the opportunity arises. Swept daily. */
  OPPORTUNITY_NOW(20, Duration.ofDays(1)),

  /** Not now. Unbounded, because the whole point is somewhere to put things. Swept weekly. */
  OVER_THE_HORIZON(null, Duration.ofDays(7));

  private final Integer softCap;
  private final Duration reviewInterval;

  TaskZone(Integer softCap, Duration reviewInterval) {
    this.softCap = softCap;
    this.reviewInterval = reviewInterval;
  }

  /** The number of items this zone is meant to hold, or empty if it is unbounded. */
  public Optional<Integer> softCap() {
    return Optional.ofNullable(softCap);
  }

  /** How often this zone should be swept, or empty if it is worked continuously instead. */
  public Optional<Duration> reviewInterval() {
    return Optional.ofNullable(reviewInterval);
  }

  /** Whether {@code count} items is more than this zone is meant to hold. */
  public boolean isOverSoftCap(int count) {
    return softCap != null && count > softCap;
  }
}
