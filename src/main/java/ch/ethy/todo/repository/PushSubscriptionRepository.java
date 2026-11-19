package ch.ethy.todo.repository;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.domain.User;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

  /**
   * A device this user may register again: their own, or one whose secret they hold, which proves
   * it is the same browser whoever signed in on it before. An endpoint alone is no secret.
   */
  @Query(
      """
      select s from PushSubscription s
      where s.endpoint = :endpoint and (s.user = :user or s.auth = :auth)
      """)
  Optional<PushSubscription> findReachable(
      @Param("endpoint") String endpoint, @Param("user") User user, @Param("auth") String auth);

  /** By endpoint and secret together: a device that has signed out has nothing else to show. */
  @Transactional
  @Modifying
  @Query("delete from PushSubscription s where s.endpoint = :endpoint and s.auth = :auth")
  void deleteByEndpointAndAuth(@Param("endpoint") String endpoint, @Param("auth") String auth);

  /** With its user, since it is read outside any request to work out what to send. */
  @EntityGraph(attributePaths = "user")
  @Query("select s from PushSubscription s where s.id = :id")
  Optional<PushSubscription> findWithUser(@Param("id") Long id);

  /**
   * The devices of everyone who can see one of these lists, or who is named. With their users,
   * since they are read outside any request.
   */
  @Query(
      """
      select s from PushSubscription s join fetch s.user u
      where u.id in :users
         or exists (
           select 1 from TaskList l left join l.members m
           where l.id in :lists and (l.owner = u or m = u))
      """)
  List<PushSubscription> findAffected(
      @Param("lists") Collection<Long> listIds, @Param("users") Collection<Long> userIds);

  @Query("select s from PushSubscription s join fetch s.user")
  List<PushSubscription> findAllWithUser();

  /** A statement rather than a loaded entity, so a re-registration in between is not undone. */
  @Transactional
  @Modifying
  @Query("update PushSubscription s set s.lastSent = :digest where s.id = :id")
  void recordSent(@Param("id") Long id, @Param("digest") String digest);
}
