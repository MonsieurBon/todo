package ch.ethy.todo.push;

import static org.assertj.core.api.Assertions.assertThat;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.service.Board;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class CriticalNowNoticeTest {

  private static final Instant NOW = Instant.parse("2026-11-19T10:00:00Z");
  private static final LocalDate TODAY = LocalDate.of(2026, 11, 19);

  private static Task critical(String title) {
    return new Task(title, TaskZone.CRITICAL_NOW, NOW);
  }

  private static Board board(Task... tasks) {
    return new Board(List.of(tasks), Map.of(), TODAY);
  }

  private static JsonNode payload(CriticalNowNotice notice) {
    return JsonMapper.builder().build().readTree(notice.payload()).get("criticalNow");
  }

  @Test
  @DisplayName("one title per line, in the order the board shows them")
  void listsTheTitles() {
    var notice = CriticalNowNotice.of(board(critical("Call the plumber"), critical("Pay rent")));

    assertThat(notice.title()).isEqualTo("Critical Now (2)");
    assertThat(notice.body()).isEqualTo("Call the plumber\nPay rent");
    assertThat(payload(notice).get("title").asString()).isEqualTo("Critical Now (2)");
    assertThat(payload(notice).get("body").asString()).isEqualTo("Call the plumber\nPay rent");
  }

  @Test
  @DisplayName("an empty zone still says something, since every push has to show a notification")
  void saysWhenThereIsNothing() {
    var notice = CriticalNowNotice.of(board());

    assertThat(notice.title()).isEqualTo("Critical Now");
    assertThat(notice.body()).isEqualTo("Nothing critical right now");
  }

  @Test
  @DisplayName("over the cap, it shows them all and says so")
  void saysWhenOverTheCap() {
    Task[] six =
        IntStream.rangeClosed(1, 6).mapToObj(i -> critical("Task " + i)).toArray(Task[]::new);

    var notice = CriticalNowNotice.of(board(six));

    assertThat(notice.title()).isEqualTo("Critical Now (6, over the cap of 5)");
    assertThat(notice.body().lines()).hasSize(6);
  }

  @Test
  @DisplayName("leaves out what the zone does not hold: other zones, completed and deferred tasks")
  void onlyOpenVisibleCritical() {
    Task completed = critical("Done already");
    completed.complete(TODAY, NOW);
    Task deferred = critical("Not today");
    deferred.deferUntil(TODAY.plusDays(1), TODAY, NOW);
    Task elsewhere = new Task("Some day", TaskZone.OVER_THE_HORIZON, NOW);

    var notice =
        CriticalNowNotice.of(board(critical("Still here"), completed, deferred, elsewhere));

    assertThat(notice.title()).isEqualTo("Critical Now (1)");
    assertThat(notice.body()).isEqualTo("Still here");
  }

  @Test
  @DisplayName("titles that would not fit one push are counted instead of sent")
  void fitsOnePush() {
    String longest = "😀".repeat(Task.MAX_TITLE_LENGTH);
    Task[] many = IntStream.range(0, 12).mapToObj(i -> critical(longest)).toArray(Task[]::new);

    var notice = CriticalNowNotice.of(board(many));

    assertThat(notice.payload().length).isLessThanOrEqualTo(WebPushEncryption.MAX_PLAINTEXT);
    List<String> lines = notice.body().lines().toList();
    int shown = lines.size() - 1;
    assertThat(shown).isPositive();
    assertThat(lines.getLast()).isEqualTo("…and " + (12 - shown) + " more");
    assertThat(notice.title()).isEqualTo("Critical Now (12, over the cap of 5)");
  }

  @Test
  @DisplayName("the same notice is always the same bytes, so an unchanged one is never sent again")
  void sameBytesEveryTime() {
    var notice = CriticalNowNotice.of(board(critical("Pay rent")));

    assertThat(new String(notice.payload(), StandardCharsets.UTF_8))
        .isEqualTo("{\"criticalNow\":{\"title\":\"Critical Now (1)\",\"body\":\"Pay rent\"}}");
  }

  @Test
  @DisplayName("the payload is UTF-8, so a title in any script arrives as written")
  void keepsTheScript() {
    var notice = CriticalNowNotice.of(board(critical("Grüezi – 日本語")));

    assertThat(new String(notice.payload(), StandardCharsets.UTF_8)).contains("Grüezi – 日本語");
  }
}
