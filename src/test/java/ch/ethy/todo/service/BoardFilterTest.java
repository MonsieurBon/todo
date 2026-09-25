package ch.ethy.todo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Where a string someone typed becomes a query argument. A filter says what to compare against, not
 * what a topic may be called, so anything unusable is a board with nothing on it - never a refusal,
 * because the board swallows one and quietly keeps showing what it already had.
 */
class BoardFilterTest {

  private static String labelOf(String filter) {
    return new BoardFilter(null, filter, null, false).label();
  }

  @Test
  @DisplayName("a label is tidied the way a stored one is, so it can match")
  void tidied() {
    assertThat(labelOf("  garden  ")).isEqualTo("garden");
  }

  @ParameterizedTest(name = "\"{0}\" is compared, not refused")
  @DisplayName("a value no topic may hold is a filter that matches nothing")
  @ValueSource(strings = {"a,b", "Fix Roof", " ", "🏠", "co­operate"})
  void unusableValuesNarrowToNothing(String filter) {
    assertThatCode(() -> labelOf(filter)).doesNotThrowAnyException();
    assertThat(labelOf(filter)).isNotNull();
  }

  @ParameterizedTest(name = "\"{0}\" narrows nothing")
  @DisplayName("a filter with nothing in it narrows nothing")
  @ValueSource(strings = {"   ", "\t", ""})
  void nothingAtAllIsNoFilter(String filter) {
    assertThat(labelOf(filter)).isNull();
  }

  @Test
  @DisplayName("no label at all narrows nothing")
  void absentIsNoFilter() {
    assertThat(labelOf(null)).isNull();
  }

  @Test
  @DisplayName("a composed and a combining accent are the same filter")
  void accentsAreNormalised() {
    assertThat(labelOf("Café")).isEqualTo(labelOf("Café"));
  }
}
