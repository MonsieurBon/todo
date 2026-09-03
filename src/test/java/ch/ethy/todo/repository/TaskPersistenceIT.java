package ch.ethy.todo.repository;

import static org.assertj.core.api.Assertions.assertThat;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskState;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.domain.User;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Runs the real Flyway migration against a real MySQL and then lets Hibernate validate the entities
 * against it. That validation is the point: the schema is hand-written, so nothing else would catch
 * it drifting from the mappings.
 *
 * <p>Uses {@code @DataJpaTest} rather than {@code @SpringBootTest} deliberately — the full context
 * would try to reach the IdP for issuer metadata at startup, which has nothing to do with
 * persistence.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class TaskPersistenceIT {

  @Container
  @SuppressWarnings("resource")
  static final MySQLContainer<?> MYSQL =
      new MySQLContainer<>("mysql:8.4").withDatabaseName("todo").withReuse(false);

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
    registry.add("spring.datasource.username", MYSQL::getUsername);
    registry.add("spring.datasource.password", MYSQL::getPassword);
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("spring.flyway.enabled", () -> "true");
  }

  @Autowired private UserRepository users;
  @Autowired private TaskListRepository lists;
  @Autowired private TaskRepository tasks;

  private User owner;
  private TaskList inbox;

  @BeforeEach
  void setUp() {
    owner = users.save(new User("idp-subject-1", "fabian@example.com", "Fabian"));
    inbox = new TaskList(owner, "Inbox", "inbox");
    inbox.markAsInbox();
    inbox = lists.save(inbox);
  }

  @Test
  @DisplayName("a user is found by their IdP subject")
  void findByExternalId() {
    assertThat(users.findByExternalId("idp-subject-1")).contains(owner);
    assertThat(users.findByExternalId("nobody")).isEmpty();
  }

  @Test
  @DisplayName("the inbox is findable, because a capture-only client cannot choose a list")
  void findsInbox() {
    assertThat(lists.findByOwnerAndInboxIsTrue(owner)).contains(inbox);
  }

  @Test
  @DisplayName("a task survives a round trip with its zone and state intact")
  void roundTrip() {
    Task task = new Task("Renew passport", TaskZone.OPPORTUNITY_NOW);
    task.notes("Check the photo requirements");
    task.dueDate(LocalDate.of(2026, 12, 1));
    inbox.add(task);
    tasks.saveAndFlush(task);

    Task loaded = tasks.findById(task.id()).orElseThrow();
    assertThat(loaded.title()).isEqualTo("Renew passport");
    assertThat(loaded.notes()).isEqualTo("Check the photo requirements");
    assertThat(loaded.zone()).isEqualTo(TaskZone.OPPORTUNITY_NOW);
    assertThat(loaded.state()).isEqualTo(TaskState.TODO);
    assertThat(loaded.dueDate()).isEqualTo(LocalDate.of(2026, 12, 1));
    assertThat(loaded.createdAt()).isNotNull();
  }

  @Test
  @DisplayName("emoji survive, which they did not under the old 3-byte utf8 schema")
  void utf8mb4() {
    Task task = new Task("Buy 🎂 for the party", TaskZone.CRITICAL_NOW);
    inbox.add(task);
    tasks.saveAndFlush(task);

    assertThat(tasks.findById(task.id()).orElseThrow().title()).isEqualTo("Buy 🎂 for the party");
  }

  @Test
  @DisplayName("a deferred task is excluded from the visible list until its date arrives")
  void deferredTasksAreHidden() {
    LocalDate today = LocalDate.of(2026, 9, 3);

    Task visible = new Task("Call the dentist", TaskZone.CRITICAL_NOW);
    Task deferred = new Task("Plan the summer trip", TaskZone.OPPORTUNITY_NOW);
    deferred.deferUntil(today.plusDays(30), today);

    inbox.add(visible);
    inbox.add(deferred);
    tasks.saveAllAndFlush(java.util.List.of(visible, deferred));

    assertThat(tasks.findVisibleIn(inbox, today))
        .extracting(Task::title)
        .containsExactly("Call the dentist");
    assertThat(tasks.findVisibleIn(inbox, today.plusDays(30)))
        .extracting(Task::title)
        .containsExactlyInAnyOrder("Call the dentist", "Plan the summer trip");
  }

  @Test
  @DisplayName("completed tasks drop out of the visible list")
  void completedTasksAreHidden() {
    LocalDate today = LocalDate.of(2026, 9, 3);
    Task task = new Task("Take out the bins", TaskZone.CRITICAL_NOW);
    inbox.add(task);
    tasks.saveAndFlush(task);

    assertThat(tasks.findVisibleIn(inbox, today)).hasSize(1);

    task.complete();
    tasks.saveAndFlush(task);

    assertThat(tasks.findVisibleIn(inbox, today)).isEmpty();
  }

  @Test
  @DisplayName("visible tasks come back ordered by zone urgency")
  void orderedByZoneUrgency() {
    LocalDate today = LocalDate.of(2026, 9, 3);
    Task horizon = new Task("Learn the cello", TaskZone.OVER_THE_HORIZON);
    Task critical = new Task("File the tax return", TaskZone.CRITICAL_NOW);
    Task opportunity = new Task("Book a haircut", TaskZone.OPPORTUNITY_NOW);

    inbox.add(horizon);
    inbox.add(critical);
    inbox.add(opportunity);
    tasks.saveAllAndFlush(java.util.List.of(horizon, critical, opportunity));

    assertThat(tasks.findVisibleIn(inbox, today))
        .extracting(Task::zone)
        .containsExactly(
            TaskZone.CRITICAL_NOW, TaskZone.OPPORTUNITY_NOW, TaskZone.OVER_THE_HORIZON);
  }

  @Test
  @DisplayName("a shared list is visible to the member but a private one is not")
  void sharing() {
    User other = users.save(new User("idp-subject-2", "someone@example.com", "Someone"));
    TaskList private_ = lists.save(new TaskList(owner, "Private", "private"));

    inbox.share(other);
    lists.saveAndFlush(inbox);

    assertThat(lists.findAllAccessibleBy(other))
        .extracting(TaskList::name)
        .containsExactly("Inbox");
    assertThat(lists.findAllAccessibleBy(owner))
        .extracting(TaskList::name)
        .containsExactlyInAnyOrder("Inbox", "Private");
    assertThat(private_.isAccessibleBy(other)).isFalse();
  }

  @Test
  @DisplayName("counting a zone is what drives the soft-cap warning")
  void countsPerZone() {
    for (int i = 0; i < 6; i++) {
      Task task = new Task("Urgent " + i, TaskZone.CRITICAL_NOW);
      inbox.add(task);
      tasks.save(task);
    }
    tasks.flush();

    long count = tasks.countByTaskListAndZoneAndState(inbox, TaskZone.CRITICAL_NOW, TaskState.TODO);
    assertThat(count).isEqualTo(6);
    assertThat(TaskZone.CRITICAL_NOW.isOverSoftCap((int) count)).isTrue();
  }
}
