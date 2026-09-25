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

  /**
   * A topic is kept exactly as it was written. The slug this replaced rewrote silently, which is
   * how "Fix Roof" became "fix-roof" and an emoji became the word "list".
   */
  @ParameterizedTest(name = "\"{0}\" is kept as it was written")
  @DisplayName("capitals, accents and other scripts are kept")
  @ValueSource(strings = {"Küche", "día", "日本語", "project-a", "3D-Druck", "STRASSE", "straße"})
  void keptAsWritten(String topic) {
    Task task = task();
    task.addLabel(topic);
    assertThat(task.labels()).containsExactly(topic);
  }

  @Test
  @DisplayName("surrounding whitespace is removed, since it is not part of the name")
  void trimmed() {
    Task task = task();
    task.addLabel("  garden  ");
    assertThat(task.labels()).containsExactly("garden");
  }

  /**
   * Letters, digits and hyphens, and everything else refused out loud. The narrowness is what keeps
   * identity simple: nothing invisible can arrive in a paste and make two topics that look alike.
   */
  @ParameterizedTest(name = "\"{0}\" is refused")
  @DisplayName("anything but letters, digits and hyphens is refused, and the refusal says so")
  @ValueSource(
      strings = {"Fix Roof", "home,garden", "Haus & Garten", "c++", "🏠", "co­operate", "a‌b"})
  void refusedOutright(String topic) {
    assertThatThrownBy(() -> task().addLabel(topic))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("letters, digits and hyphens");
  }

  /**
   * Decided, not overlooked. A script that writes a letter as a base plus a combining mark needs
   * marks to be allowed, and allowing marks lets a keycap emoji back in - a digit, a variation
   * selector and an enclosing mark are each legal on their own. The narrowness buys a topic whose
   * identity is obvious at a glance, and it costs nothing elsewhere: a title and notes take any
   * language.
   */
  @ParameterizedTest(name = "\"{0}\" is refused, deliberately")
  @DisplayName("a script that writes a letter with a combining mark is outside what a topic holds")
  @ValueSource(strings = {"हिन्दी", "தமிழ்", "น้ำ", "1\ufe0f\u20e3"})
  void combiningScriptsAreOutsideTheRule(String topic) {
    assertThatThrownBy(() -> task().addLabel(topic))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("letters, digits and hyphens");
  }

  /**
   * The one rewriting a topic gets, and the reason it is safe: these two are the same text by
   * Unicode's own definition. Left alone they would be two topics that look identical.
   */
  @Test
  @DisplayName("a composed and a combining accent are one topic, held composed")
  void canonicallyEquivalentSpellingsAreOneTopic() {
    Task task = task();
    task.labels(java.util.List.of("Café", "Café"));
    assertThat(task.labels()).containsExactly("Café");
  }

  @Test
  @DisplayName("two spellings of one word are two topics")
  void spellingsAreTheirOwnTopics() {
    Task task = task();
    task.labels(java.util.List.of("Garden", "garden"));
    assertThat(task.labels()).containsExactlyInAnyOrder("Garden", "garden");
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
    task.addLabel("sports-club");
    task.removeLabel("sports-club");
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

  @ParameterizedTest(name = "\"{0}\" is not a name")
  @DisplayName("a label of nothing at all is refused rather than stored empty")
  @ValueSource(strings = {"   ", "\t", ""})
  void blankRefused(String blank) {
    assertThatThrownBy(() -> task().addLabel(blank))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("needs a name");
  }

  @Test
  @DisplayName("no label at all is refused the same way")
  void nullRefused() {
    assertThatThrownBy(() -> task().addLabel(null)).isInstanceOf(IllegalArgumentException.class);
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
