package ch.ethy.todo.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;

class MidnightRefreshTest {

  @Test
  @DisplayName("runs just after midnight in the app's time zone, when a deferral ends")
  void justAfterTheAppsMidnight() throws NoSuchMethodException {
    Scheduled schedule =
        MidnightRefresh.class.getDeclaredMethod("deferralsComeBack").getAnnotation(Scheduled.class);
    assertThat(schedule.zone()).isEqualTo("${todo.time-zone}");

    ZoneId zurich = ZoneId.of("Europe/Zurich");
    ZonedDateTime lateEvening = LocalDateTime.of(2026, 11, 19, 23, 59).atZone(zurich);
    assertThat(CronExpression.parse(schedule.cron()).next(lateEvening))
        .isEqualTo(LocalDateTime.of(2026, 11, 20, 0, 0, 30).atZone(zurich));
  }

  @Test
  @DisplayName("looks at every device")
  void refreshesEveryDevice() {
    CriticalNowPusher pusher = mock(CriticalNowPusher.class);

    new MidnightRefresh(pusher).deferralsComeBack();

    verify(pusher).refreshAll();
  }

  @Test
  @DisplayName("looks at every device once the app is up: a midnight or a retry it was down for")
  void makesUpForADowntime() throws NoSuchMethodException {
    EventListener listener =
        MidnightRefresh.class.getDeclaredMethod("whatWasMissed").getAnnotation(EventListener.class);
    assertThat(listener.value()).containsExactly(ApplicationReadyEvent.class);
    CriticalNowPusher pusher = mock(CriticalNowPusher.class);

    new MidnightRefresh(pusher).whatWasMissed();

    verify(pusher).refreshAll();
  }
}
