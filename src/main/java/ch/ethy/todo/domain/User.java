package ch.ethy.todo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "app_user")
public class User {

  public static final int MAX_EXTERNAL_ID_LENGTH = 255;
  public static final int MAX_EMAIL_LENGTH = 255;
  public static final int MAX_DISPLAY_NAME_LENGTH = 255;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** The IdP's {@code sub} claim. */
  @Column(
      name = "external_id",
      nullable = false,
      unique = true,
      updatable = false,
      length = MAX_EXTERNAL_ID_LENGTH)
  private String externalId;

  @Column(nullable = false, length = MAX_EMAIL_LENGTH)
  private String email;

  @Column(name = "display_name", nullable = false, length = MAX_DISPLAY_NAME_LENGTH)
  private String displayName;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected User() {
    // for JPA
  }

  /**
   * The external id is refused when too long, not shortened: truncating two subjects that share a
   * prefix would merge two people into one account. Email and display name identify nobody, so they
   * are shortened rather than locking the person out on their first request.
   */
  public User(String externalId, String email, String displayName) {
    if (externalId == null || externalId.isBlank()) {
      throw new IllegalArgumentException("A user needs an external id");
    }
    this.externalId = Lengths.atMost(MAX_EXTERNAL_ID_LENGTH, "An external id", externalId);
    email(email);
    displayName(displayName);
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

  public final void email(String email) {
    this.email = Lengths.truncatedTo(MAX_EMAIL_LENGTH, email);
  }

  public String displayName() {
    return displayName;
  }

  public final void displayName(String displayName) {
    this.displayName = Lengths.truncatedTo(MAX_DISPLAY_NAME_LENGTH, displayName);
  }

  public Instant createdAt() {
    return createdAt;
  }
}
