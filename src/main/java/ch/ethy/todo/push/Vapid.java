package ch.ethy.todo.push;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.net.URI;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

/**
 * How this server identifies itself to a push service (RFC 8292): a short-lived token signed with
 * the key whose public half each device subscribed with.
 */
final class Vapid {

  /** The longest RFC 8292 lets a token live is a day; half leaves room for a skewed clock. */
  private static final Duration LIFETIME = Duration.ofHours(12);

  private final String publicKey;
  private final ECDSASigner signer;
  private final String subject;

  /**
   * @param contact where the operator of a push service can find this server's operator; RFC 8292
   *     takes an https URL, so any other address is left out rather than sent
   */
  Vapid(String publicKey, String privateKey, String contact) {
    KeyPair keys;
    try {
      keys = P256.keyPair(decoded(publicKey), decoded(privateKey));
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(
          "TODO_PUSH_PUBLIC_KEY and TODO_PUSH_PRIVATE_KEY must be a P-256 key pair, base64url", e);
    }
    try {
      this.signer = new ECDSASigner((ECPrivateKey) keys.getPrivate());
      mustBelongTogether(keys);
    } catch (JOSEException e) {
      throw new IllegalArgumentException("Not a usable VAPID key pair", e);
    }
    this.publicKey = publicKey.trim();
    this.subject = contact != null && contact.startsWith("https://") ? contact : null;
  }

  String publicKey() {
    return publicKey;
  }

  /** The {@code Authorization} header for a push to this endpoint. */
  String authorization(String endpoint, Instant now) {
    URI uri = URI.create(endpoint);
    String audience =
        uri.getScheme() + "://" + uri.getHost() + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
    var claims =
        new JWTClaimsSet.Builder()
            .audience(audience)
            .expirationTime(Date.from(now.plus(LIFETIME)))
            .subject(subject)
            .build();
    var token =
        new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.ES256).type(JOSEObjectType.JWT).build(), claims);
    try {
      token.sign(signer);
    } catch (JOSEException e) {
      throw new IllegalStateException("Could not sign a VAPID token", e);
    }
    return "vapid t=" + token.serialize() + ", k=" + publicKey;
  }

  /**
   * A public key from another pair would be accepted by every device and refused by every push
   * service, so the mistake is caught here instead of looking like a dead subscription.
   */
  private void mustBelongTogether(KeyPair keys) throws JOSEException {
    var probe =
        new SignedJWT(
            new JWSHeader(JWSAlgorithm.ES256), new JWTClaimsSet.Builder().subject("probe").build());
    probe.sign(signer);
    if (!probe.verify(new ECDSAVerifier((ECPublicKey) keys.getPublic()))) {
      throw new IllegalArgumentException(
          "TODO_PUSH_PUBLIC_KEY is not the public half of TODO_PUSH_PRIVATE_KEY");
    }
  }

  private static byte[] decoded(String base64url) {
    try {
      return Base64.getUrlDecoder().decode(base64url.trim());
    } catch (IllegalArgumentException | NullPointerException e) {
      throw new IllegalArgumentException("Not base64url", e);
    }
  }
}
