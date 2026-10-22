package ch.ethy.todo.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

  @Bean
  Clock clock(@Value("${todo.time-zone}") ZoneId zone) {
    return Clock.system(zone);
  }
}
