package ch.ethy.todo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class UserTest {

  @Test
  @DisplayName("a user needs an external id")
  void externalIdRequired() {
    assertThatThrownBy(() -> new User("  ", "a@example.com", "A"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("an over-long external id is refused, never shortened into someone else's account")
  void externalIdRefused() {
    assertThatThrownBy(
            () -> new User("s".repeat(User.MAX_EXTERNAL_ID_LENGTH + 1), "a@example.com", "A"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining(String.valueOf(User.MAX_EXTERNAL_ID_LENGTH));
  }

  @Test
  @DisplayName("an over-long email is shortened rather than locking the person out")
  void emailTruncated() {
    User user = new User("sub-1", "e".repeat(User.MAX_EMAIL_LENGTH + 40), "A");
    assertThat(user.email()).hasSize(User.MAX_EMAIL_LENGTH);
  }

  @Test
  @DisplayName("an over-long display name is shortened too")
  void displayNameTruncated() {
    User user = new User("sub-2", "a@example.com", "n".repeat(User.MAX_DISPLAY_NAME_LENGTH + 40));
    assertThat(user.displayName()).hasSize(User.MAX_DISPLAY_NAME_LENGTH);
  }

  @Test
  @DisplayName("shortening cuts on a character boundary, never through one")
  void truncationKeepsCharactersWhole() {
    String broom = "\uD83E\uDDF9";
    User user = new User("sub-4", "a@example.com", broom.repeat(User.MAX_DISPLAY_NAME_LENGTH + 10));

    String name = user.displayName();
    assertThat(name.codePointCount(0, name.length())).isEqualTo(User.MAX_DISPLAY_NAME_LENGTH);
    assertThat(name)
        .as("a cut between the halves of a character would leave an unpaired surrogate")
        .isEqualTo(broom.repeat(User.MAX_DISPLAY_NAME_LENGTH));
  }

  @Test
  @DisplayName("values that fit are kept as they are")
  void shortEnoughIsUntouched() {
    User user = new User("sub-3", "a@example.com", "Fabian");
    assertThat(user.externalId()).isEqualTo("sub-3");
    assertThat(user.email()).isEqualTo("a@example.com");
    assertThat(user.displayName()).isEqualTo("Fabian");
  }
}
