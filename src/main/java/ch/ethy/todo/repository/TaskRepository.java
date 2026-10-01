package ch.ethy.todo.repository;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, Long> {

  /**
   * Every zone and deferred tasks included, so one read serves the board and its loads alike: what
   * is out of sight is {@link Task#isVisibleOn}'s to say.
   */
  @Query(
      """
      select distinct t from Task t
      left join t.taskList.members m
      where (t.taskList.owner = :user or m = :user)
        and (:includeDone = true or t.state = ch.ethy.todo.domain.TaskState.TODO)
        and (:listId is null or t.taskList.id = :listId)
        and (:label is null or :label member of t.labels)
      order by t.zone, t.position, t.createdAt desc
      """)
  @EntityGraph(attributePaths = {"labels", "taskList"})
  List<Task> findOnBoard(
      @Param("user") ch.ethy.todo.domain.User user,
      @Param("listId") Long listId,
      @Param("label") String label,
      @Param("includeDone") boolean includeDone);

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

  @Query(
      """
      select distinct t from Task t
      left join t.taskList.members m
      where t.id in :ids and (t.taskList.owner = :user or m = :user)
      """)
  @EntityGraph(attributePaths = {"labels", "taskList"})
  List<Task> findAllAccessible(
      @Param("ids") java.util.Collection<Long> ids, @Param("user") ch.ethy.todo.domain.User user);

  /** Scoped to the list, so a reference guessed by someone else resolves to nothing. */
  @EntityGraph(attributePaths = {"labels", "taskList"})
  java.util.Optional<Task> findByTaskListAndClientRef(TaskList list, String clientRef);
}
