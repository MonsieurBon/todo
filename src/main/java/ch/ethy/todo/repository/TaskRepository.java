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
  @EntityGraph(attributePaths = {"labels", "taskList"})
  List<Task> findVisibleIn(@Param("list") TaskList list, @Param("today") LocalDate today);

  /**
   * The board: every task the user can see, across all their lists, narrowed by the optional
   * filters. This is the first query that deliberately spans lists, which makes it the one new
   * place an IDOR could appear — hence the ownership predicate is part of the query itself, exactly
   * as in {@link #findAccessible}, and never applied afterwards.
   *
   * <p>{@code :label member of t.labels} filters the element collection without a join, so no
   * duplicate rows appear when a task carries several topics.
   */
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
   * Open task counts per zone across the same filtered set, ignoring any zone filter so all three
   * loads stay visible while looking at one zone.
   *
   * <p>{@code count(distinct t)} matters: the members join multiplies rows on a list shared with
   * several people, which would otherwise inflate the cap warning.
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

  /**
   * Every topic in use across the tasks this user can see, for autocomplete and the filter menu.
   */
  @Query(
      """
      select distinct l from Task t
      join t.labels l
      left join t.taskList.members m
      where t.taskList.owner = :user or m = :user
      order by l
      """)
  List<String> findLabelsVisibleTo(@Param("user") ch.ethy.todo.domain.User user);

  /** Loads a task only if this user may see the list it belongs to. Same reasoning as above. */
  @Query(
      """
      select t from Task t
      left join t.taskList.members m
      where t.id = :id and (t.taskList.owner = :user or m = :user)
      """)
  @EntityGraph(attributePaths = {"labels", "taskList"})
  java.util.Optional<Task> findAccessible(
      @Param("id") Long id, @Param("user") ch.ethy.todo.domain.User user);

  long countByTaskListAndZoneAndState(
      TaskList list, ch.ethy.todo.domain.TaskZone zone, ch.ethy.todo.domain.TaskState state);
}
