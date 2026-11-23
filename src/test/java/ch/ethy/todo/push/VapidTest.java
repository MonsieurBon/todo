package ch.ethy.todo.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jwt.SignedJWT;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class VapidTest {

  // RFC 8291's sender keys: any valid pair will do.
  private static final String PUBLIC_KEY =
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
  private static final String PRIVATE_KEY = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
  private static final Instant NOW = Instant.parse("2026-11-19T10:00:00Z");

  private final Vapid vapid = new Vapid(PUBLIC_KEY, PRIVATE_KEY, "https://todo.example.com");

  private static SignedJWT token(String header) throws Exception {
    assertThat(header).startsWith("vapid t=").endsWith(", k=" + PUBLIC_KEY);
    return SignedJWT.parse(header.substring("vapid t=".length(), header.indexOf(',')));
  }

  @Test
  @DisplayName("signs a token for the push service's origin, verifiable with the public key")
  void signsForTheOrigin() throws Exception {
    SignedJWT token =
        token(vapid.authorization("https://fcm.googleapis.com/fcm/send/abc:def", NOW));

    ECPublicKey key = P256.publicKey(Base64.getUrlDecoder().decode(PUBLIC_KEY));
    assertThat(token.verify(new ECDSAVerifier(key))).isTrue();
    assertThat(token.getHeader().getAlgorithm()).isEqualTo(JWSAlgorithm.ES256);
    assertThat(token.getHeader().getType()).isEqualTo(JOSEObjectType.JWT);
    var claims = token.getJWTClaimsSet();
    assertThat(claims.getAudience()).containsExactly("https://fcm.googleapis.com");
    assertThat(claims.getSubject()).isEqualTo("https://todo.example.com");
    assertThat(claims.getExpirationTime().toInstant()).isEqualTo(NOW.plus(Duration.ofHours(12)));
  }

  @Test
  @DisplayName("keeps a port that is not the scheme's default in the audience")
  void keepsAPort() throws Exception {
    SignedJWT token = token(vapid.authorization("https://push.example.net:8443/p/1", NOW));

    assertThat(token.getJWTClaimsSet().getAudience())
        .containsExactly("https://push.example.net:8443");
  }

  @Test
  @DisplayName("names no contact when the app's address is not https, which RFC 8292 would refuse")
  void noContactOverHttp() throws Exception {
    var local = new Vapid(PUBLIC_KEY, PRIVATE_KEY, "http://localhost:8090");

    SignedJWT token = token(local.authorization("https://fcm.googleapis.com/fcm/send/x", NOW));

    assertThat(token.getJWTClaimsSet().getSubject()).isNull();
  }

  @Test
  @DisplayName("refuses keys that do not belong together, at startup rather than on the first push")
  void refusesAMismatchedPair() {
    String otherPublic =
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";

    assertThatThrownBy(() -> new Vapid(otherPublic, PRIVATE_KEY, "https://todo.example.com"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("TODO_PUSH_PUBLIC_KEY");
  }

  @Test
  @DisplayName("a key pasted with a line break still reaches devices and push services without it")
  void trimsWhatItHandsOn() {
    var pasted = new Vapid(PUBLIC_KEY + "\n", PRIVATE_KEY + "\n", "https://todo.example.com");

    assertThat(pasted.publicKey()).isEqualTo(PUBLIC_KEY);
    assertThat(pasted.authorization("https://fcm.googleapis.com/fcm/send/x", NOW))
        .endsWith(", k=" + PUBLIC_KEY);
  }
}
