package ch.ethy.todo.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

  /** Injected rather than read statically, so tests can pin "now" instead of sleeping. */
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }
}
