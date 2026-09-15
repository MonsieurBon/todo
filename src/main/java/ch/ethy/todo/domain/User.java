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

  public static final int MAX_EXTERNAL_ID_LENGTH = 255;
  public static final int MAX_EMAIL_LENGTH = 255;
  public static final int MAX_DISPLAY_NAME_LENGTH = 255;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** The IdP's {@code sub} claim. Immutable, and the only identity this app trusts. */
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
   * The three strings here come from the IdP's claims rather than from a caller, and they are
   * bounded in two different ways on purpose.
   *
   * <p>The external id is <em>refused</em> when it is too long: it is the identity everything else
   * hangs on, and shortening two subjects that share a prefix would merge two people into one
   * account. Failing closed costs that person access; shortening would cost them someone else's
   * data.
   *
   * <p>Email and display name are <em>shortened</em>. Neither identifies anyone — the external id
   * does — so the cost is a truncated address or name, against locking a person out of their own
   * account on their very first request, before they have so much as an inbox.
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
