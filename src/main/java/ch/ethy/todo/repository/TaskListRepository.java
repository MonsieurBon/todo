package ch.ethy.todo.repository;

import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskListRepository extends JpaRepository<TaskList, Long> {

  /**
   * Resolves a slug within one user's own lists. Scoping by owner is what stops a list shared with
   * you from shadowing your own list of the same name — the bug the previous version had.
   */
  Optional<TaskList> findByOwnerAndSlug(User owner, String slug);

  Optional<TaskList> findByOwnerAndInboxIsTrue(User owner);

  /** Every list the user can see: the ones they own plus the ones shared with them. */
  @Query(
      """
      select distinct l from TaskList l
      left join l.members m
      where l.owner = :user or m = :user
      order by l.name
      """)
  List<TaskList> findAllAccessibleBy(@Param("user") User user);
}
