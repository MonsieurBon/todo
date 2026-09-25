package ch.ethy.todo;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * The real clock, pushed forward on request: a task is not due for review until its zone's interval
 * has passed since it was filed, so a test that wants a sweep has to let time go by.
 */
public class TestClock extends Clock {

  private final Clock real = Clock.systemUTC();
  private volatile Duration ahead = Duration.ZERO;

  public void advance(Duration by) {
    ahead = ahead.plus(by);
  }

  void reset() {
    ahead = Duration.ZERO;
  }

  @Override
  public ZoneId getZone() {
    return real.getZone();
  }

  @Override
  public Clock withZone(ZoneId zone) {
    throw new UnsupportedOperationException("The application reads one zone");
  }

  @Override
  public Instant instant() {
    return real.instant().plus(ahead);
  }
}
