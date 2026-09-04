package ch.ethy.todo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

/**
 * A person, as this application knows them.
 *
 * <p>Authentication is delegated entirely to the IdP, so there is deliberately no password, no
 * token and no session state here — only the IdP's subject claim plus enough profile to render a
 * name. Anything more would be a second copy of data the IdP already owns.
 */
@Entity
@Table(name = "app_user")
public class User {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** The IdP's {@code sub} claim. Immutable, and the only identity this app trusts. */
  @Column(name = "external_id", nullable = false, unique = true, updatable = false)
  private String externalId;

  @Column(nullable = false)
  private String email;

  @Column(name = "display_name", nullable = false)
  private String displayName;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected User() {
    // for JPA
  }

  public User(String externalId, String email, String displayName) {
    if (externalId == null || externalId.isBlank()) {
      throw new IllegalArgumentException("A user needs an external id");
    }
    this.externalId = externalId;
    this.email = email;
    this.displayName = displayName;
  }

  public Long id() {
    return id;
  }

  public String externalId() {
    return externalId;
  }

  public String email() {
    return email;
  }

  public void email(String email) {
    this.email = email;
  }

  public String displayName() {
    return displayName;
  }

  public void displayName(String displayName) {
    this.displayName = displayName;
  }

  public Instant createdAt() {
    return createdAt;
  }
}
