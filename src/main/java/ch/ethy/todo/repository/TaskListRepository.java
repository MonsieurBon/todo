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

  // Every finder below names BOTH owner and members in its entity graph. Spring Data's
  // @EntityGraph defaults to EntityGraphType.FETCH, which makes every attribute NOT listed
  // lazy — overriding the fetch type declared on the entity. Omitting owner here leaves it a
  // proxy, and with open-in-view disabled it then fails during DTO assembly.

  /**
   * Resolves a slug within one user's own lists. Scoping by owner is what stops a list shared with
   * you from shadowing your own list of the same name — the bug the previous version had.
   */
  @EntityGraph(attributePaths = {"owner", "members"})
  Optional<TaskList> findByOwnerAndSlug(User owner, String slug);

  @EntityGraph(attributePaths = {"owner", "members"})
  Optional<TaskList> findByOwnerAndInboxIsTrue(User owner);

  /**
   * Loads a list only if this user may see it.
   *
   * <p>The access check is part of the query rather than something applied afterwards. The previous
   * version of this app loaded by raw id and then checked, and leaked every task in the database
   * because the failure path still returned the entity. Scoping the load makes that shape
   * impossible to write.
   */
  @Query(
      """
      select l from TaskList l
      left join l.members m
      where l.id = :id and (l.owner = :user or m = :user)
      """)
  @EntityGraph(attributePaths = {"owner", "members"})
  Optional<TaskList> findAccessible(@Param("id") Long id, @Param("user") User user);

  /** Loads a list only if this user owns it. Renaming, deleting and sharing are owner-only. */
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

  /** Every list the user can see: the ones they own plus the ones shared with them. */
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
