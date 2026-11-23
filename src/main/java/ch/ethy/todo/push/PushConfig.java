package ch.ethy.todo.push;

import ch.ethy.todo.repository.PushSubscriptionRepository;
import ch.ethy.todo.service.TaskService;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestClient;

@Configuration
@EnableScheduling
class PushConfig {

  /** About as long as a push service takes to know a subscription it has just handed out. */
  private static final List<Duration> WELCOME_RETRIES =
      List.of(Duration.ofSeconds(2), Duration.ofSeconds(5), Duration.ofSeconds(15));

  /** A push service having a bad minute, then a bad few. After that the next change tries. */
  private static final List<Duration> FAILURE_RETRIES =
      List.of(Duration.ofSeconds(30), Duration.ofMinutes(2), Duration.ofMinutes(10));

  /**
   * Off unless both keys are set; one without the other is a mistake worth failing the start over,
   * rather than a server that quietly sends nothing.
   */
  @Bean
  PushGateway pushGateway(
      @Value("${todo.push.public-key:}") String publicKey,
      @Value("${todo.push.private-key:}") String privateKey,
      @Value("${spring.security.oauth2.resourceserver.jwt.audiences}") String canonicalUri,
      Clock clock) {
    if (publicKey.isBlank() && privateKey.isBlank()) {
      return PushGateway.OFF;
    }
    if (publicKey.isBlank() || privateKey.isBlank()) {
      throw new IllegalStateException(
          "Set both TODO_PUSH_PUBLIC_KEY and TODO_PUSH_PRIVATE_KEY, or neither");
    }
    return new WebPushGateway(new Vapid(publicKey, privateKey, canonicalUri), http(), clock);
  }

  /** Bounded, so a push service that hangs does not hold every other device's push behind it. */
  private static RestClient http() {
    var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    var requests = new JdkClientHttpRequestFactory(client);
    requests.setReadTimeout(Duration.ofSeconds(10));
    return RestClient.builder().requestFactory(requests).build();
  }

  /**
   * The thread is the pusher's own, not a bean: Spring would take a lone scheduled executor in the
   * context as the one every scheduled job runs on.
   */
  @Bean
  CriticalNowPusher criticalNowPusher(
      PushSubscriptionRepository subscriptions, TaskService tasks, PushGateway gateway) {
    ScheduledExecutorService thread =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().name("critical-now-push").daemon().factory());
    return new CriticalNowPusher(
        subscriptions, tasks, gateway, thread, WELCOME_RETRIES, FAILURE_RETRIES);
  }
}
