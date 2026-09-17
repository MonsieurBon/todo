package ch.ethy.todo.domain;

/** On the entities, not only the DTOs: the MCP tools reach the domain without passing a DTO. */
final class Lengths {

  private Lengths() {}

  /**
   * For values we are given rather than offered — an IdP claim — where refusing rejects the person
   * rather than the input, and nobody can correct it.
   */
  static String truncatedTo(int max, String value) {
    if (value == null || lengthOf(value) <= max) {
      return value;
    }
    return value.substring(0, value.offsetByCodePoints(0, max));
  }

  static String atMost(int max, String what, String value) {
    int length = lengthOf(value);
    if (length > max) {
      throw new IllegalArgumentException(
          what + " may be at most " + max + " characters, but this one is " + length);
    }
    return value;
  }

  /**
   * Characters, not {@code String.length()}: the columns are utf8mb4, so an emoji is one to the
   * column and two to Java.
   */
  private static int lengthOf(String value) {
    return value.codePointCount(0, value.length());
  }
}
