package ch.ethy.todo.service;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Whose board a transaction changed, announced once it has committed, so that whoever reads the
 * boards again reads what was written. Tasks report themselves (see {@link TaskWrites}); a change
 * to a list that alters who sees its tasks names the people it affects.
 */
@Component
public class BoardChanges {

  /** The lists whose tasks changed, and the people whose view changed some other way. */
  public record Changed(Set<Long> listIds, Set<Long> userIds) {}

  private final ApplicationEventPublisher events;

  public BoardChanges(ApplicationEventPublisher events) {
    this.events = events;
  }

  public void listChanged(Long listId) {
    touched().listIds.add(listId);
  }

  public void usersAffected(Collection<Long> userIds) {
    touched().userIds.addAll(userIds);
  }

  private Touched touched() {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      throw new IllegalStateException("A board changes inside a transaction");
    }
    Touched touched = (Touched) TransactionSynchronizationManager.getResource(this);
    if (touched == null) {
      touched = new Touched();
      TransactionSynchronizationManager.bindResource(this, touched);
      TransactionSynchronizationManager.registerSynchronization(touched);
    }
    return touched;
  }

  private final class Touched implements TransactionSynchronization {
    private final Set<Long> listIds = new LinkedHashSet<>();
    private final Set<Long> userIds = new LinkedHashSet<>();

    @Override
    public void afterCommit() {
      events.publishEvent(new Changed(Set.copyOf(listIds), Set.copyOf(userIds)));
    }

    @Override
    public void afterCompletion(int status) {
      TransactionSynchronizationManager.unbindResourceIfPossible(BoardChanges.this);
    }
  }
}
