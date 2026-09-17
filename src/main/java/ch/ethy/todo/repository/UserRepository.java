package ch.ethy.todo.repository;

import ch.ethy.todo.domain.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

  Optional<User> findByExternalId(String externalId);

  Optional<User> findByEmail(String email);
}
