package ch.ethy.todo.push;

import java.math.BigInteger;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECFieldFp;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;

/**
 * Keys on the curve Web Push uses, in the raw form it writes them: a public key as an uncompressed
 * point ({@code 0x04 || x || y}), a private key as its 32-byte scalar.
 */
final class P256 {

  static final int POINT_LENGTH = 65;
  private static final int COORDINATE_LENGTH = 32;
  private static final ECParameterSpec CURVE = curve();

  private P256() {}

  private static ECParameterSpec curve() {
    try {
      AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
      parameters.init(new ECGenParameterSpec("secp256r1"));
      return parameters.getParameterSpec(ECParameterSpec.class);
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("The JDK has no P-256", e);
    }
  }

  static ECParameterSpec parameters() {
    return CURVE;
  }

  /**
   * Checked against the curve here, since a device's key arrives in a request: a point off the
   * curve is how an invalid-curve attack recovers the private key on the other side of ECDH.
   */
  static ECPublicKey publicKey(byte[] point) {
    if (point == null || point.length != POINT_LENGTH || point[0] != 0x04) {
      throw new IllegalArgumentException("Not an uncompressed P-256 point");
    }
    BigInteger x = unsigned(Arrays.copyOfRange(point, 1, 1 + COORDINATE_LENGTH));
    BigInteger y = unsigned(Arrays.copyOfRange(point, 1 + COORDINATE_LENGTH, POINT_LENGTH));
    if (!onCurve(x, y)) {
      throw new IllegalArgumentException("Not a point on P-256");
    }
    try {
      return (ECPublicKey)
          KeyFactory.getInstance("EC")
              .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), CURVE));
    } catch (GeneralSecurityException e) {
      throw new IllegalArgumentException("Not a P-256 public key", e);
    }
  }

  static KeyPair keyPair(byte[] publicPoint, byte[] privateScalar) {
    if (privateScalar == null || privateScalar.length != COORDINATE_LENGTH) {
      throw new IllegalArgumentException("Not a P-256 private key");
    }
    try {
      var privateKey =
          KeyFactory.getInstance("EC")
              .generatePrivate(new ECPrivateKeySpec(unsigned(privateScalar), CURVE));
      return new KeyPair(publicKey(publicPoint), privateKey);
    } catch (GeneralSecurityException e) {
      throw new IllegalArgumentException("Not a P-256 private key", e);
    }
  }

  static byte[] point(ECPublicKey key) {
    byte[] point = new byte[POINT_LENGTH];
    point[0] = 0x04;
    fixed(key.getW().getAffineX(), point, 1);
    fixed(key.getW().getAffineY(), point, 1 + COORDINATE_LENGTH);
    return point;
  }

  private static boolean onCurve(BigInteger x, BigInteger y) {
    BigInteger p = ((ECFieldFp) CURVE.getCurve().getField()).getP();
    if (x.compareTo(p) >= 0 || y.compareTo(p) >= 0) {
      return false;
    }
    BigInteger a = CURVE.getCurve().getA();
    BigInteger b = CURVE.getCurve().getB();
    return y.pow(2).mod(p).equals(x.pow(3).add(a.multiply(x)).add(b).mod(p));
  }

  private static BigInteger unsigned(byte[] bytes) {
    return new BigInteger(1, bytes);
  }

  private static void fixed(BigInteger value, byte[] into, int offset) {
    byte[] bytes = value.toByteArray();
    int length = Math.min(bytes.length, COORDINATE_LENGTH);
    System.arraycopy(
        bytes, bytes.length - length, into, offset + COORDINATE_LENGTH - length, length);
  }
}
