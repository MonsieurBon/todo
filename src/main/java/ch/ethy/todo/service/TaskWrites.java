package ch.ethy.todo.service;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import java.util.List;
import java.util.Map;
import org.hibernate.boot.Metadata;
import org.hibernate.boot.spi.BootstrapContext;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostDeleteEventListener;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.integrator.spi.Integrator;
import org.hibernate.jpa.boot.spi.IntegratorProvider;
import org.hibernate.jpa.boot.spi.JpaSettings;
import org.hibernate.persister.entity.EntityPersister;
import org.hibernate.proxy.HibernateProxy;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

/**
 * Every row of a task written, whichever path wrote it — a REST call, an MCP tool, the copy a
 * repeating task leaves behind, a list deleted with its tasks — reports the list it is on. So there
 * is no list of writes that change a board to keep up to date.
 *
 * <p>Registered with Hibernate from here rather than on the entity, which would make the domain
 * depend on the services.
 */
@Component
class TaskWrites
    implements HibernatePropertiesCustomizer,
        PostInsertEventListener,
        PostUpdateEventListener,
        PostDeleteEventListener {

  private final BoardChanges changes;

  TaskWrites(BoardChanges changes) {
    this.changes = changes;
  }

  @Override
  public void customize(Map<String, Object> properties) {
    properties.put(
        JpaSettings.INTEGRATOR_PROVIDER, (IntegratorProvider) () -> List.of(integrator()));
  }

  private Integrator integrator() {
    return new Integrator() {
      @Override
      public void integrate(
          Metadata metadata, BootstrapContext context, SessionFactoryImplementor factory) {
        EventListenerRegistry registry =
            factory.getServiceRegistry().getService(EventListenerRegistry.class);
        registry.appendListeners(EventType.POST_INSERT, TaskWrites.this);
        registry.appendListeners(EventType.POST_UPDATE, TaskWrites.this);
        registry.appendListeners(EventType.POST_DELETE, TaskWrites.this);
      }
    };
  }

  @Override
  public void onPostInsert(PostInsertEvent event) {
    written(event.getEntity());
  }

  @Override
  public void onPostUpdate(PostUpdateEvent event) {
    written(event.getEntity());
  }

  @Override
  public void onPostDelete(PostDeleteEvent event) {
    written(event.getEntity());
  }

  private void written(Object entity) {
    if (entity instanceof Task task) {
      changes.listChanged(idOf(task.taskList()));
    }
  }

  /** Without loading it: a flush is no time to start reading. */
  private static Long idOf(TaskList list) {
    if (list instanceof HibernateProxy proxy) {
      return (Long) proxy.getHibernateLazyInitializer().getIdentifier();
    }
    return list.id();
  }

  @Override
  public boolean requiresPostCommitHandling(EntityPersister persister) {
    return false;
  }
}
