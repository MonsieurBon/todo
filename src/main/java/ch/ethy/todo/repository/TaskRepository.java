package ch.ethy.todo.repository;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, Long> {

  @Query(
      """
      select t from Task t
      where t.taskList = :list
        and t.state = ch.ethy.todo.domain.TaskState.TODO
        and (t.deferUntil is null or t.deferUntil <= :today)
      order by t.zone, t.position, t.createdAt desc
      """)
  @EntityGraph(attributePaths = {"labels", "taskList"})
  List<Task> findVisibleIn(@Param("list") TaskList list, @Param("today") LocalDate today);

  @Query(
      """
      select distinct t from Task t
      left join t.taskList.members m
      where (t.taskList.owner = :user or m = :user)
        and (:includeDone = true or t.state = ch.ethy.todo.domain.TaskState.TODO)
        and (t.deferUntil is null or t.deferUntil <= :today)
        and (:listId is null or t.taskList.id = :listId)
        and (:label is null or :label member of t.labels)
        and (:zone is null or t.zone = :zone)
      order by t.zone, t.position, t.createdAt desc
      """)
  @EntityGraph(attributePaths = {"labels", "taskList"})
  List<Task> findOnBoard(
      @Param("user") ch.ethy.todo.domain.User user,
      @Param("today") LocalDate today,
      @Param("listId") Long listId,
      @Param("label") String label,
      @Param("zone") ch.ethy.todo.domain.TaskZone zone,
      @Param("includeDone") boolean includeDone);

  /**
   * Takes no zone filter, so all three loads stay visible while looking at one zone. {@code
   * count(distinct t)} because the members join multiplies rows on a shared list.
   */
  @Query(
      """
      select t.zone, count(distinct t) from Task t
      left join t.taskList.members m
      where (t.taskList.owner = :user or m = :user)
        and t.state = ch.ethy.todo.domain.TaskState.TODO
        and (t.deferUntil is null or t.deferUntil <= :today)
        and (:listId is null or t.taskList.id = :listId)
        and (:label is null or :label member of t.labels)
      group by t.zone
      """)
  List<Object[]> countOpenByZoneOnBoard(
      @Param("user") ch.ethy.todo.domain.User user,
      @Param("today") LocalDate today,
      @Param("listId") Long listId,
      @Param("label") String label);

  @Query(
      """
      select distinct l from Task t
      join t.labels l
      left join t.taskList.members m
      where t.taskList.owner = :user or m = :user
      """)
  List<String> findLabelsVisibleTo(@Param("user") ch.ethy.todo.domain.User user);

  @Query(
      """
      select t from Task t
      left join t.taskList.members m
      where t.id = :id and (t.taskList.owner = :user or m = :user)
      """)
  @EntityGraph(attributePaths = {"labels", "taskList"})
  java.util.Optional<Task> findAccessible(
      @Param("id") Long id, @Param("user") ch.ethy.todo.domain.User user);

  /** Scoped to the list, so a reference guessed by someone else resolves to nothing. */
  @EntityGraph(attributePaths = {"labels", "taskList"})
  java.util.Optional<Task> findByTaskListAndClientRef(TaskList list, String clientRef);

  long countByTaskListAndZoneAndState(
      TaskList list, ch.ethy.todo.domain.TaskZone zone, ch.ethy.todo.domain.TaskState state);
}
