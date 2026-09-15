package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SlugTest {

  @ParameterizedTest(name = "\"{0}\" slugs to {1}")
  @CsvSource({
    "Personal, personal",
    "'  Family  List  ', family-list",
    "Küche & Bad, kuche-bad",
    "'📓', list"
  })
  @DisplayName("a name becomes a URL-safe slug")
  void slugs(String name, String expected) {
    assertThat(Slug.of(name)).isEqualTo(expected);
  }

  @Test
  @DisplayName("a slug asked to fit is shortened to the length given")
  void fits() {
    assertThat(Slug.of("n".repeat(300), 128)).hasSize(128);
  }

  @Test
  @DisplayName("shortening never leaves a trailing separator")
  void fitsWithoutTrailingSeparator() {
    assertThat(Slug.of("ab cd ef", 3)).isEqualTo("ab");
  }

  @Test
  @DisplayName("a slug already short enough is left alone")
  void shortEnoughIsUntouched() {
    assertThat(Slug.of("personal", 128)).isEqualTo("personal");
  }
}
