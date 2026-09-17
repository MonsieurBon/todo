package ch.ethy.todo.repository;

import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskListRepository extends JpaRepository<TaskList, Long> {

  // Every graph below names owner as well as members: @EntityGraph defaults to type FETCH, which
  // makes anything unlisted lazy whatever the entity declares, and a lazy owner fails DTO assembly.

  @EntityGraph(attributePaths = {"owner", "members"})
  Optional<TaskList> findByOwnerAndSlug(User owner, String slug);

  Optional<TaskList> findByOwnerAndName(User owner, String name);

  @EntityGraph(attributePaths = {"owner", "members"})
  Optional<TaskList> findByOwnerAndInboxIsTrue(User owner);

  @Query(
      """
      select l from TaskList l
      left join l.members m
      where l.id = :id and (l.owner = :user or m = :user)
      """)
  @EntityGraph(attributePaths = {"owner", "members"})
  Optional<TaskList> findAccessible(@Param("id") Long id, @Param("user") User user);

  @EntityGraph(attributePaths = {"owner", "members"})
  Optional<TaskList> findByIdAndOwner(Long id, User owner);

  @Query(
      """
      select l from TaskList l
      left join l.members m
      where l.slug = :slug and (l.owner = :user or m = :user)
      order by case when l.owner = :user then 0 else 1 end
      """)
  java.util.List<TaskList> findAccessibleBySlug(
      @Param("slug") String slug, @Param("user") User user);

  @Query(
      """
      select distinct l from TaskList l
      left join l.members m
      where l.owner = :user or m = :user
      order by l.name
      """)
  @EntityGraph(attributePaths = {"owner", "members"})
  List<TaskList> findAllAccessibleBy(@Param("user") User user);
}
