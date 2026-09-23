package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TaskListTest {

  private static final User OWNER = new User("owner-1", "owner@example.com", "Owner");

  private static TaskList list(String name) {
    return new TaskList(OWNER, name);
  }

  @Test
  @DisplayName("a list needs an owner and a name")
  void required() {
    assertThatThrownBy(() -> new TaskList(null, "Personal"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new TaskList(OWNER, null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> list("   ")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("a name as long as the column allows is accepted")
  void nameAtTheLimit() {
    String name = "n".repeat(TaskList.MAX_NAME_LENGTH);
    assertThat(list(name).name()).isEqualTo(name);
  }

  @Test
  @DisplayName("a longer name is refused, and the refusal names the limit")
  void nameTooLong() {
    assertThatThrownBy(() -> list("n".repeat(TaskList.MAX_NAME_LENGTH + 1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining(String.valueOf(TaskList.MAX_NAME_LENGTH));
  }

  @Test
  @DisplayName("renaming holds the same limit as creating")
  void renameTooLong() {
    TaskList list = list("Personal");
    assertThatThrownBy(() -> list.name("n".repeat(TaskList.MAX_NAME_LENGTH + 1)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> list.name("  ")).isInstanceOf(IllegalArgumentException.class);
    assertThat(list.name()).isEqualTo("Personal");
  }
}
