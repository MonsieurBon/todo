package ch.ethy.todo.domain;

import java.text.Normalizer;
import java.util.Locale;

/** Turns a list name into a URL-safe slug. */
public final class Slug {

  private Slug() {}

  public static String of(String name) {
    String ascii =
        Normalizer.normalize(name, Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    String slug =
        ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+)|(-+$)", "");
    // A name of only emoji or CJK leaves nothing behind, and an empty slug would
    // collide with every other such list for the same owner.
    return slug.isBlank() ? "list" : slug;
  }
}
