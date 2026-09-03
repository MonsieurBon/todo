package ch.ethy.todo.repository;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, Long> {

  /**
   * The tasks a list should actually show today: still open, and not deferred into the future.
   * Ordered by zone urgency (the enum's declaration order), then manual position, then newest first
   * — the method treats a recent entry as the more urgent one.
   */
  @Query(
      """
      select t from Task t
      where t.taskList = :list
        and t.state = ch.ethy.todo.domain.TaskState.TODO
        and (t.deferUntil is null or t.deferUntil <= :today)
      order by t.zone, t.position, t.createdAt desc
      """)
  List<Task> findVisibleIn(@Param("list") TaskList list, @Param("today") LocalDate today);

  /** Loads a task only if this user may see the list it belongs to. Same reasoning as above. */
  @Query(
      """
      select t from Task t
      left join t.taskList.members m
      where t.id = :id and (t.taskList.owner = :user or m = :user)
      """)
  java.util.Optional<Task> findAccessible(
      @Param("id") Long id, @Param("user") ch.ethy.todo.domain.User user);

  long countByTaskListAndZoneAndState(
      TaskList list, ch.ethy.todo.domain.TaskZone zone, ch.ethy.todo.domain.TaskState state);
}
