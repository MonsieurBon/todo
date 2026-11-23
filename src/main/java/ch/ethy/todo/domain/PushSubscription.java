package ch.ethy.todo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

/**
 * A device that shows Critical Now as a notification. Its endpoint and keys are the push service's
 * and the browser's; what they must be is checked where they arrive, this only bounds their size.
 */
@Entity
@Table(name = "push_subscription")
public class PushSubscription {

  public static final int MAX_ENDPOINT_LENGTH = 2048;

  /** An uncompressed P-256 point, 65 octets, in unpadded base64url. */
  public static final int MAX_P256DH_LENGTH = 88;

  /** 16 octets in base64url, with room for padding a browser might add. */
  public static final int MAX_AUTH_LENGTH = 24;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(nullable = false, length = MAX_ENDPOINT_LENGTH, updatable = false)
  private String endpoint;

  @Column(nullable = false, length = MAX_P256DH_LENGTH)
  private String p256dh;

  @Column(nullable = false, length = MAX_AUTH_LENGTH)
  private String auth;

  @Column(name = "last_sent", length = 64)
  private String lastSent;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected PushSubscription() {
    // for JPA
  }

  public PushSubscription(User user, String endpoint, String p256dh, String auth) {
    this.endpoint = Lengths.atMost(MAX_ENDPOINT_LENGTH, "A push endpoint", endpoint);
    handTo(user, p256dh, auth);
  }

  /**
   * The device belongs to whoever registers it, and the browser may have renewed its keys, so what
   * it last showed is no longer known.
   */
  public void handTo(User user, String p256dh, String auth) {
    this.user = user;
    this.p256dh = Lengths.atMost(MAX_P256DH_LENGTH, "A push key", p256dh);
    this.auth = Lengths.atMost(MAX_AUTH_LENGTH, "A push secret", auth);
    this.lastSent = null;
  }

  public Long id() {
    return id;
  }

  public User user() {
    return user;
  }

  public String endpoint() {
    return endpoint;
  }

  public String p256dh() {
    return p256dh;
  }

  public String auth() {
    return auth;
  }

  public String lastSent() {
    return lastSent;
  }
}
