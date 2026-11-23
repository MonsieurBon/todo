package ch.ethy.todo.push;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import javax.crypto.Cipher;
import javax.crypto.KDF;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.HKDFParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * A push message encrypted for one device, as RFC 8291 lays it out: one {@code aes128gcm} record
 * (RFC 8188), keyed by ECDH between a throwaway key and the device's, mixed with the device's
 * authentication secret.
 */
final class WebPushEncryption {

  /** One record is all a push may carry; push services cap the body at 4096 octets. */
  static final int RECORD_SIZE = 4096;

  private static final int SALT_LENGTH = 16;
  private static final int TAG_LENGTH = 16;
  private static final int HEADER_LENGTH = SALT_LENGTH + 4 + 1 + P256.POINT_LENGTH;

  /** What is left of the record for the payload, after the header, the tag and the delimiter. */
  static final int MAX_PLAINTEXT = RECORD_SIZE - HEADER_LENGTH - TAG_LENGTH - 1;

  private static final byte LAST_RECORD = 0x02;
  private static final SecureRandom RANDOM = new SecureRandom();

  private WebPushEncryption() {}

  static byte[] encrypt(byte[] plaintext, ECPublicKey receiver, byte[] authSecret) {
    byte[] salt = new byte[SALT_LENGTH];
    RANDOM.nextBytes(salt);
    return encrypt(plaintext, receiver, authSecret, throwawayKeys(), salt);
  }

  static byte[] encrypt(
      byte[] plaintext, ECPublicKey receiver, byte[] authSecret, KeyPair sender, byte[] salt) {
    if (plaintext.length > MAX_PLAINTEXT) {
      throw new IllegalArgumentException(
          "A push carries at most " + MAX_PLAINTEXT + " octets, not " + plaintext.length);
    }
    try {
      byte[] senderPoint = P256.point((ECPublicKey) sender.getPublic());
      byte[] receiverPoint = P256.point(receiver);

      KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
      agreement.init(sender.getPrivate());
      agreement.doPhase(receiver, true);
      byte[] ecdhSecret = agreement.generateSecret();

      byte[] keyInfo = concat(ascii("WebPush: info\0"), receiverPoint, senderPoint);
      byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
      byte[] cek = hkdf(salt, ikm, ascii("Content-Encoding: aes128gcm\0"), 16);
      byte[] nonce = hkdf(salt, ikm, ascii("Content-Encoding: nonce\0"), 12);

      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
          Cipher.ENCRYPT_MODE,
          new SecretKeySpec(cek, "AES"),
          new GCMParameterSpec(TAG_LENGTH * 8, nonce));
      byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[] {LAST_RECORD}));

      return ByteBuffer.allocate(HEADER_LENGTH + ciphertext.length)
          .put(salt)
          .putInt(RECORD_SIZE)
          .put((byte) senderPoint.length)
          .put(senderPoint)
          .put(ciphertext)
          .array();
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("Could not encrypt a push message", e);
    }
  }

  private static KeyPair throwawayKeys() {
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
      generator.initialize(P256.parameters(), RANDOM);
      return generator.generateKeyPair();
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("The JDK cannot make a P-256 key", e);
    }
  }

  private static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length)
      throws GeneralSecurityException {
    return KDF.getInstance("HKDF-SHA256")
        .deriveData(
            HKDFParameterSpec.ofExtract().addSalt(salt).addIKM(ikm).thenExpand(info, length));
  }

  private static byte[] ascii(String text) {
    return text.getBytes(StandardCharsets.US_ASCII);
  }

  private static byte[] concat(byte[]... parts) {
    int length = 0;
    for (byte[] part : parts) {
      length += part.length;
    }
    ByteBuffer joined = ByteBuffer.allocate(length);
    for (byte[] part : parts) {
      joined.put(part);
    }
    return joined.array();
  }
}
