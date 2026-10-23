package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;

import ch.ethy.todo.domain.TaskStateException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ApiExceptionHandlerTest {

  @Test
  @DisplayName("a state refusal answers 409 under its own code, so a client can tell them apart")
  void stateRefusalKeepsItsCode() {
    var response =
        new ApiExceptionHandler()
            .stateRefused(new TaskStateException("repeat_out_of_range", "Repeats too far"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody().error()).isEqualTo("repeat_out_of_range");
    assertThat(response.getBody().message()).isEqualTo("Repeats too far");
  }
}
