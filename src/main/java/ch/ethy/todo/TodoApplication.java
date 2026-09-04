package ch.ethy.todo;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * The API version is the contract's version, deliberately not the application's: the jar is
 * released continuously, and the shape the web app generates its types from changes far less often.
 */
@SpringBootApplication
@OpenAPIDefinition(info = @Info(title = "One Minute To-Do List", version = "1"))
public class TodoApplication {

  public static void main(String[] args) {
    SpringApplication.run(TodoApplication.class, args);
  }
}
