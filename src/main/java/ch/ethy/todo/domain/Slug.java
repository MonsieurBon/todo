package ch.ethy.todo.domain;

import java.text.Normalizer;
import java.util.Locale;

public final class Slug {

  private Slug() {}

  public static String of(String name) {
    // Not an NPE: the slug is derived before the entity sees the name, so throwing here would
    // beat "A list needs a name" to the caller.
    if (name == null) {
      return "list";
    }
    String ascii =
        Normalizer.normalize(name, Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    String slug =
        ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+)|(-+$)", "");
    // Emoji or CJK leave nothing behind, and an empty slug collides with every other such list.
    return slug.isBlank() ? "list" : slug;
  }

  /** Only for a slug being stored: shortening one being looked up would match the wrong list. */
  public static String of(String name, int maxLength) {
    String slug = of(name);
    return slug.length() <= maxLength ? slug : slug.substring(0, maxLength).replaceAll("-+$", "");
  }
}
