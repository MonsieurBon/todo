package ch.ethy.todo.domain;

import java.text.Normalizer;
import java.util.Locale;

/** Turns a list name into a URL-safe slug. */
public final class Slug {

  private Slug() {}

  public static String of(String name) {
    // Null is treated as blank rather than thrown at: a list name arrives from an MCP tool with
    // nothing between it and here, and the slug is derived before the entity sees the name, so an
    // NPE here would beat "A list needs a name" to the caller.
    if (name == null) {
      return "list";
    }
    String ascii =
        Normalizer.normalize(name, Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    String slug =
        ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+)|(-+$)", "");
    // A name of only emoji or CJK leaves nothing behind, and an empty slug would
    // collide with every other such list for the same owner.
    return slug.isBlank() ? "list" : slug;
  }

  /**
   * The same slug, shortened to fit. Only for a slug that is <em>stored</em>: shortening one that
   * is being looked up would quietly turn it into a different slug and match the wrong list.
   */
  public static String of(String name, int maxLength) {
    String slug = of(name);
    return slug.length() <= maxLength ? slug : slug.substring(0, maxLength).replaceAll("-+$", "");
  }
}
