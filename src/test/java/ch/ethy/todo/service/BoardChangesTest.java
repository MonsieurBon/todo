package ch.ethy.todo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronizationUtils;

class BoardChangesTest {

  private final List<Object> published = new ArrayList<>();
  private final BoardChanges changes = new BoardChanges(published::add);

  @BeforeEach
  void begin() {
    TransactionSynchronizationManager.initSynchronization();
  }

  @AfterEach
  void end() {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.clearSynchronization();
    }
  }

  private static void commit() {
    List<TransactionSynchronization> registered =
        TransactionSynchronizationManager.getSynchronizations();
    TransactionSynchronizationUtils.invokeAfterCommit(registered);
    TransactionSynchronizationUtils.invokeAfterCompletion(
        registered, TransactionSynchronization.STATUS_COMMITTED);
  }

  private static void rollBack() {
    TransactionSynchronizationUtils.invokeAfterCompletion(
        TransactionSynchronizationManager.getSynchronizations(),
        TransactionSynchronization.STATUS_ROLLED_BACK);
  }

  @Test
  @DisplayName("everything one transaction touched is announced once, after it commits")
  void announcesOnceAfterCommit() {
    changes.listChanged(1L);
    changes.listChanged(2L);
    changes.listChanged(1L);
    changes.usersAffected(Set.of(7L));
    assertThat(published).isEmpty();

    commit();

    assertThat(published).containsExactly(new BoardChanges.Changed(Set.of(1L, 2L), Set.of(7L)));
  }

  @Test
  @DisplayName("a transaction that rolls back announces nothing")
  void nothingOnRollback() {
    changes.listChanged(1L);

    rollBack();

    assertThat(published).isEmpty();
  }

  @Test
  @DisplayName("the next transaction starts with nothing touched")
  void startsAfresh() {
    changes.listChanged(1L);
    commit();
    TransactionSynchronizationManager.clearSynchronization();
    TransactionSynchronizationManager.initSynchronization();

    changes.listChanged(2L);
    commit();

    assertThat(published)
        .containsExactly(
            new BoardChanges.Changed(Set.of(1L), Set.of()),
            new BoardChanges.Changed(Set.of(2L), Set.of()));
  }

  @Test
  @DisplayName("a write outside a transaction is a mistake, not something to announce at once")
  void needsATransaction() {
    TransactionSynchronizationManager.clearSynchronization();

    assertThatThrownBy(() -> changes.listChanged(1L)).isInstanceOf(IllegalStateException.class);
  }
}
