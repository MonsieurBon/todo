package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * The three urgency zones of the One Minute To-Do List, and the discipline that makes the method
 * work: the item caps and the review cadences.
 */
class TaskZoneTest {

  @Nested
  @DisplayName("soft caps")
  class SoftCaps {

    @Test
    @DisplayName("Critical Now holds about five items")
    void criticalNowCap() {
      assertThat(TaskZone.CRITICAL_NOW.softCap()).contains(5);
    }

    @Test
    @DisplayName("Opportunity Now holds about twenty items")
    void opportunityNowCap() {
      assertThat(TaskZone.OPPORTUNITY_NOW.softCap()).contains(20);
    }

    @Test
    @DisplayName("Over The Horizon is unlimited")
    void overTheHorizonUncapped() {
      assertThat(TaskZone.OVER_THE_HORIZON.softCap()).isEmpty();
      assertThat(TaskZone.OVER_THE_HORIZON.isOverSoftCap(10_000)).isFalse();
    }

    @ParameterizedTest(name = "{0} with {1} items over cap: {2}")
    @CsvSource({
      "CRITICAL_NOW, 4, false",
      "CRITICAL_NOW, 5, false",
      "CRITICAL_NOW, 6, true",
      "OPPORTUNITY_NOW, 20, false",
      "OPPORTUNITY_NOW, 21, true",
      "OVER_THE_HORIZON, 999, false"
    })
    @DisplayName("the cap is exceeded only strictly above it")
    void capBoundary(TaskZone zone, int count, boolean expected) {
      assertThat(zone.isOverSoftCap(count)).isEqualTo(expected);
    }
  }

  @Nested
  @DisplayName("review cadence")
  class ReviewCadence {

    @Test
    @DisplayName("Opportunity Now is reviewed daily")
    void opportunityNowDaily() {
      assertThat(TaskZone.OPPORTUNITY_NOW.reviewInterval()).contains(Duration.ofDays(1));
    }

    @Test
    @DisplayName("Over The Horizon is reviewed weekly")
    void overTheHorizonWeekly() {
      assertThat(TaskZone.OVER_THE_HORIZON.reviewInterval()).contains(Duration.ofDays(7));
    }

    @Test
    @DisplayName("Critical Now is worked continuously, not swept")
    void criticalNowHasNoSweep() {
      assertThat(TaskZone.CRITICAL_NOW.reviewInterval()).isEmpty();
    }
  }

  @Nested
  @DisplayName("invariants")
  class Invariants {

    @ParameterizedTest
    @EnumSource(TaskZone.class)
    @DisplayName("every zone answers both questions without throwing")
    void totality(TaskZone zone) {
      Optional<Integer> cap = zone.softCap();
      Optional<Duration> interval = zone.reviewInterval();
      assertThat(cap).isNotNull();
      assertThat(interval).isNotNull();
    }

    @Test
    @DisplayName("zones are ordered by urgency, most urgent first")
    void declarationOrderIsUrgency() {
      assertThat(TaskZone.values())
          .containsExactly(
              TaskZone.CRITICAL_NOW, TaskZone.OPPORTUNITY_NOW, TaskZone.OVER_THE_HORIZON);
    }
  }
}
