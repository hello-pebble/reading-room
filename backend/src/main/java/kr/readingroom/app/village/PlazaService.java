package kr.readingroom.app.village;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import kr.readingroom.app.common.ApiException;
import kr.readingroom.app.common.ChatRate;
import kr.readingroom.app.common.Db;
import kr.readingroom.app.village.dto.PlazaMessageRequest;
import kr.readingroom.app.village.dto.PlazaMessageResponse;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 마을 광장 대화: 한 줄 40자, 사용자당 3초에 3건·같은 글 30초 연속 금지(결정 #61, `ChatRate`), 글은 24시간만 보관한다 (결정 #34). */
@Service
public class PlazaService {
    static final int MAX_CHARS = 40, PAGE = 30;
    static final Duration KEEP = Duration.ofHours(24);
    private final PlazaRepository plaza;
    private final Clock clock;
    private final ObjectMapper json = new ObjectMapper();

    public PlazaService(PlazaRepository plaza, Clock clock) {
        this.plaza = plaza;
        this.clock = clock;
    }

    @Transactional
    public PlazaMessageResponse send(long userId, PlazaMessageRequest body) {
        String content = body.content();
        if (content == null || content.isEmpty() || content.codePointCount(0, content.length()) > MAX_CHARS)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_CONTENT", "한 줄은 1~" + MAX_CHARS + "자로 적어 주세요");
        Instant now = clock.instant();
        plaza.lockSender(userId);
        Record last = plaza.lastMessage(userId);
        ChatRate.check(now, plaza.countSince(userId, now.minus(ChatRate.WINDOW).toString()), last == null ? null : last.get("content", String.class),
                last == null ? null : Db.instant(last, "created_at"), content);
        return view(plaza.insert(userId, content, now.toString()));
    }

    /** since가 있으면 그 이후 글(오래된 순), 없으면 최근 24시간의 가장 최근 30개 */
    public List<PlazaMessageResponse> list(String since) {
        Instant floor = clock.instant().minus(KEEP), from = null;
        if (since != null && !since.isBlank()) {
            try {
                from = Instant.parse(since.trim());
            } catch (DateTimeParseException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_SINCE", "since는 시각(예: 2026-11-18T03:00:00Z)이어야 해요");
            }
        }
        var rows = from != null ? plaza.after((from.isAfter(floor) ? from : floor).toString(), PAGE) : plaza.latest(floor.toString(), PAGE);
        return rows.stream().map(this::view).toList();
    }

    /** 24시간이 지난 글을 지운다 (1시간 배치). 지운 개수를 돌려준다. */
    @Transactional
    public int purgeExpired() {
        return plaza.deleteOlderThan(clock.instant().minus(KEEP).toString());
    }

    private PlazaMessageResponse view(Record r) {
        JsonNode avatar;
        try {
            avatar = json.readTree(r.get("avatar", String.class));
        } catch (Exception e) {
            avatar = null;
        }
        return new PlazaMessageResponse(r.get("id", Long.class), r.get("user_id", Long.class), r.get("handle", String.class),
                r.get("nickname", String.class), avatar, r.get("content", String.class), Db.instant(r, "created_at"));
    }
}
