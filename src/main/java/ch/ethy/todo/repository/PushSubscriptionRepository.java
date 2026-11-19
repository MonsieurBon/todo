package ch.ethy.todo.repository;

import ch.ethy.todo.domain.PushSubscription;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

  Optional<PushSubscription> findByEndpoint(String endpoint);

  /** With its user, since it is read outside any request to work out what to send. */
  @EntityGraph(attributePaths = "user")
  @Query("select s from PushSubscription s where s.id = :id")
  Optional<PushSubscription> findWithUser(@Param("id") Long id);

  /** A statement rather than a loaded entity, so a re-registration in between is not undone. */
  @Transactional
  @Modifying
  @Query("update PushSubscription s set s.lastSent = :digest where s.id = :id")
  void recordSent(@Param("id") Long id, @Param("digest") String digest);
}
