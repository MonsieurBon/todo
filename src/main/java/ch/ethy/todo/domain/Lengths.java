package ch.ethy.todo.domain;

/**
 * The length checks the entities apply to everything they store.
 *
 * <p>They belong here rather than only on the request DTOs because the DTOs are not on every path:
 * the MCP tools hand their arguments straight to the domain, so a bound that lives only in {@code
 * Requests} is not enforced for an assistant. Unenforced, an over-long value reaches the driver and
 * comes back as a truncation error quoting the statement — a 500 the caller cannot act on, carrying
 * detail about the schema it has no business seeing.
 */
final class Lengths {

  private Lengths() {}

  /**
   * Shortens {@code value} to fit.
   *
   * <p>For a value this application is <em>given</em> rather than offered — an IdP claim, say.
   * Refusing one of those rejects the person rather than the input, since there is no caller to
   * correct it and nothing else they can do.
   */
  static String truncatedTo(int max, String value) {
    if (value == null || lengthOf(value) <= max) {
      return value;
    }
    return value.substring(0, value.offsetByCodePoints(0, max));
  }

  /** Returns {@code value}, or refuses it naming the limit and what was actually offered. */
  static String atMost(int max, String what, String value) {
    int length = lengthOf(value);
    if (length > max) {
      throw new IllegalArgumentException(
          what + " may be at most " + max + " characters, but this one is " + length);
    }
    return value;
  }

  /**
   * Characters, not {@code String.length()}.
   *
   * <p>The columns these guard are utf8mb4 and count characters, while {@code length()} counts
   * UTF-16 code units — so an emoji is one to the column and two to Java. Measuring in code units
   * refuses titles the column would take and quotes the caller a number they cannot find in their
   * own text, and truncating by them can cut a surrogate pair in half. This application has
   * rejected emoji in a task title once before, for a different reason; see V1__initial_schema.
   */
  private static int lengthOf(String value) {
    return value.codePointCount(0, value.length());
  }
}
