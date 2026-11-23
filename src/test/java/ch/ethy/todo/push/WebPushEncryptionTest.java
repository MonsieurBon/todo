package ch.ethy.todo.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.util.Base64;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Pinned to the worked example of RFC 8291, section 5 and appendix A. */
class WebPushEncryptionTest {

  private static final String AS_PUBLIC =
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
  private static final String AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
  private static final String UA_PUBLIC =
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
  private static final String SALT = "DGv6ra1nlYgDCS1FRnbzlw";
  private static final String BODY =
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml"
          + "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT"
          + "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
  private static final byte[] PLAINTEXT =
      "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.US_ASCII);

  private static byte[] decoded(String base64url) {
    return Base64.getUrlDecoder().decode(base64url);
  }

  @Test
  @DisplayName("encrypts the RFC's example to exactly the RFC's body")
  void matchesTheRfc() {
    KeyPair sender = P256.keyPair(decoded(AS_PUBLIC), decoded(AS_PRIVATE));

    byte[] body =
        WebPushEncryption.encrypt(
            PLAINTEXT, P256.publicKey(decoded(UA_PUBLIC)), decoded(AUTH), sender, decoded(SALT));

    assertThat(Base64.getUrlEncoder().withoutPadding().encodeToString(body)).isEqualTo(BODY);
  }

  @Test
  @DisplayName("a fresh key and salt every time, so two sends of one payload differ")
  void freshEveryTime() {
    var receiver = P256.publicKey(decoded(UA_PUBLIC));

    byte[] first = WebPushEncryption.encrypt(PLAINTEXT, receiver, decoded(AUTH));
    byte[] second = WebPushEncryption.encrypt(PLAINTEXT, receiver, decoded(AUTH));

    assertThat(first).hasSize(decoded(BODY).length).isNotEqualTo(second);
  }

  @Test
  @DisplayName("refuses a payload that would not fit the one record a push may carry")
  void refusesOversizedPayloads() {
    var receiver = P256.publicKey(decoded(UA_PUBLIC));

    assertThat(
            WebPushEncryption.encrypt(
                new byte[WebPushEncryption.MAX_PLAINTEXT], receiver, decoded(AUTH)))
        .hasSize(4096);
    assertThatThrownBy(
            () ->
                WebPushEncryption.encrypt(
                    new byte[WebPushEncryption.MAX_PLAINTEXT + 1], receiver, decoded(AUTH)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("refuses a receiver key that is not a point on P-256")
  void refusesForeignKeys() {
    byte[] offCurve = decoded(UA_PUBLIC);
    offCurve[64] ^= 1;

    assertThatThrownBy(() -> P256.publicKey(offCurve)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> P256.publicKey(new byte[33]))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
