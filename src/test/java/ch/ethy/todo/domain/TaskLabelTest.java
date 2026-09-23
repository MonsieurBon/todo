package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TaskLabelTest {

  private static Task task() {
    return new Task("Fix the roof", TaskZone.OPPORTUNITY_NOW);
  }

  @Test
  @DisplayName("a task starts with no labels")
  void startsEmpty() {
    assertThat(task().labels()).isEmpty();
  }

  @Test
  @DisplayName("a task carries several topics at once")
  void multipleLabels() {
    Task task = task();
    task.addLabel("house");
    task.addLabel("project-a");

    assertThat(task.labels()).containsExactlyInAnyOrder("house", "project-a");
    assertThat(task.hasLabel("house")).isTrue();
    assertThat(task.hasLabel("politics")).isFalse();
  }

  @ParameterizedTest(name = "\"{0}\" is tidied to Project A")
  @ValueSource(strings = {"Project A", "  Project   A  ", "Project\tA", "Project\nA"})
  @DisplayName("only the spacing is tidied")
  void tidied(String input) {
    Task task = task();
    task.addLabel(input);
    assertThat(task.labels()).containsExactly("Project A");
  }

  /**
   * The point of the topic: a capital is not a typo to fix, and the column folds case and accents
   * itself, so two spellings already match each other without the domain rewriting either.
   */
  @ParameterizedTest(name = "\"{0}\" is kept as it was written")
  @ValueSource(strings = {"Küche", "Fix Roof", "🏠", "c++", "día", "PROJECT A"})
  @DisplayName("a topic keeps its capitals, accents and symbols")
  void keepsWhatWasTyped(String input) {
    Task task = task();
    task.addLabel(input);
    assertThat(task.labels()).containsExactly(input);
  }

  @Test
  @DisplayName("adding the identical topic twice leaves one label")
  void deduplicates() {
    Task task = task();
    task.addLabel("House");
    task.addLabel("House");
    assertThat(task.labels()).containsExactly("House");
  }

  @Test
  @DisplayName("a label is removed by the spelling it was added under")
  void removeUsesTheSameSpelling() {
    Task task = task();
    task.addLabel("Sports Club");
    task.removeLabel("Sports Club");
    assertThat(task.labels()).isEmpty();
  }

  @Test
  @DisplayName("replacing the set of labels drops the old ones")
  void replaceAll() {
    Task task = task();
    task.addLabel("house");
    task.labels(java.util.List.of("politics", "urgent"));
    assertThat(task.labels()).containsExactlyInAnyOrder("politics", "urgent");
  }

  @Test
  @DisplayName("a blank label is refused rather than stored as an empty string")
  void blankRefused() {
    assertThatThrownBy(() -> task().addLabel("   ")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> task().addLabel(null)).isInstanceOf(IllegalArgumentException.class);
  }

  /**
   * Pasting is the ordinary way to acquire one, and neither strip() nor isBlank() counts it as
   * whitespace - so without the Unicode flag it survives and quietly makes a second topic that
   * looks exactly like the first.
   */
  @Test
  @DisplayName("a non-breaking space is tidied like any other")
  void nonBreakingSpaceIsWhitespaceToo() {
    Task task = task();
    task.addLabel("\u00a0Fix\u00a0\u00a0Roof\u00a0");
    assertThat(task.labels()).containsExactly("Fix Roof");
  }

  @Test
  @DisplayName("a label of nothing but non-breaking spaces is refused, not stored empty")
  void nonBreakingSpacesAloneAreRefused() {
    assertThatThrownBy(() -> task().addLabel("\u00a0\u00a0"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("a label as long as the column allows is accepted")
  void labelAtTheLimit() {
    Task task = task();
    String label = "l".repeat(Task.MAX_LABEL_LENGTH);
    task.addLabel(label);
    assertThat(task.labels()).containsExactly(label);
  }

  @Test
  @DisplayName("a longer label is refused, and the refusal names the limit")
  void labelTooLong() {
    assertThatThrownBy(() -> task().addLabel("l".repeat(Task.MAX_LABEL_LENGTH + 1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining(String.valueOf(Task.MAX_LABEL_LENGTH));
  }

  @Test
  @DisplayName("the length that counts is the tidied one, not what was typed")
  void measuredAfterTidying() {
    Task task = task();
    String label = "l".repeat(Task.MAX_LABEL_LENGTH);
    task.addLabel("  " + label + "  ");
    assertThat(task.labels()).containsExactly(label);
  }

  @Test
  @DisplayName("the returned set cannot be used to mutate the task")
  void labelsAreDefensive() {
    Task task = task();
    task.addLabel("house");
    assertThatThrownBy(() -> task.labels().add("sneaky"))
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
