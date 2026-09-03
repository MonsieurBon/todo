package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Labels are the topic axis. Lists are the sharing axis, and the two must not be conflated: eight
 * topic-shaped lists would enforce the Critical Now cap eight separate times, which is exactly the
 * forcing function the method depends on.
 */
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

  @ParameterizedTest(name = "\"{0}\" normalises to project-a")
  @ValueSource(strings = {"Project A", "project a", "project-a", "  PROJECT   A  ", "Projéct A"})
  @DisplayName("spelling variants collapse to one label")
  void normalised(String input) {
    Task task = task();
    task.addLabel(input);
    assertThat(task.labels()).containsExactly("project-a");
  }

  @Test
  @DisplayName("adding the same topic twice leaves one label")
  void deduplicates() {
    Task task = task();
    task.addLabel("House");
    task.addLabel("house");
    assertThat(task.labels()).containsExactly("house");
  }

  @Test
  @DisplayName("a label can be removed however it is spelled")
  void removeIsNormalisedToo() {
    Task task = task();
    task.addLabel("sports-club");
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

  @Test
  @DisplayName("the returned set cannot be used to mutate the task")
  void labelsAreDefensive() {
    Task task = task();
    task.addLabel("house");
    assertThatThrownBy(() -> task.labels().add("sneaky"))
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
