package ch.ethy.todo.push;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * A deferral ends with a date, not with a write, so nothing else would tell a device that a task is
 * back in its Critical Now. Half a minute in, so a clock a little behind is still past midnight.
 *
 * <p>Also once the app is up, for a midnight it was down for, and for pushes it was still to retry
 * when it stopped. Only a device that shows something else is sent anything.
 */
@Component
class MidnightRefresh {

  private final CriticalNowPusher pusher;

  MidnightRefresh(CriticalNowPusher pusher) {
    this.pusher = pusher;
  }

  @Scheduled(cron = "30 0 0 * * *", zone = "${todo.time-zone}")
  void deferralsComeBack() {
    pusher.refreshAll();
  }

  @EventListener(ApplicationReadyEvent.class)
  void whatWasMissed() {
    pusher.refreshAll();
  }
}
