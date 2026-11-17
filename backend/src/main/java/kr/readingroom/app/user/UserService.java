package kr.readingroom.app.user;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class UserService {
    private final DSLContext dsl;
    private final ObjectMapper json;

    public UserService(DSLContext dsl, ObjectMapper json) {
        this.dsl = dsl;
        this.json = json;
    }

    public Map<String, Object> get(long id) {
        Record r = dsl.fetchOne("select id, handle, nickname, avatar::text as avatar from app_user where id = ?", id);
        if (r == null) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사용자를 찾을 수 없어요");
        return view(r);
    }

    public Map<String, Object> create(String handle, String nickname) {
        if (handle == null || !handle.matches("^[a-z0-9_]{3,15}$"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_HANDLE", "handle은 영소문자·숫자·_ 3~15자예요");
        if (nickname == null || nickname.isBlank() || nickname.length() > 30)
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_NICKNAME", "닉네임은 1~30자예요");
        if (dsl.fetchOne("select count(*) from app_user where handle = ?", handle).get(0, Integer.class) > 0)
            throw new ApiException(HttpStatus.CONFLICT, "HANDLE_TAKEN", "이미 쓰는 handle이에요");
        Record r = dsl.fetchOne("insert into app_user(handle, nickname) values (?, ?) returning id, handle, nickname, avatar::text as avatar",
                handle, nickname.trim());
        return view(r);
    }

    static final Map<String, List<String>> ALLOWED = Map.of(
            "color", List.of("#f6f3ff", "#fff1d6", "#ffd6e4", "#cdf0e0", "#cfe4fb", "#e0d4fa", "#fff0a8", "#d9dce6"),
            "expr", List.of("normal", "happy", "surprised", "sleepy", "wink"),
            "face", List.of("none", "glasses", "sunglasses", "bandaid"),
            "head", List.of("none", "beanie", "bow", "crown", "sprout"),
            "prop", List.of("none", "book", "mug", "lantern", "balloon"));
    static final Map<String, String> DEFAULTS = Map.of("color", "#f6f3ff", "expr", "normal", "face", "none", "head", "none", "prop", "book");
    static final List<String> KEYS = List.of("color", "expr", "face", "head", "prop");

    /**
     * 거울 저장. 모르는 키는 버리고, 모르는 값이나 빠진 키는 기본값으로 채운다.
     * 해금 조건을 못 채운 값은 400 (glasses: 책 1건 이상, beanie: 완독 10권 이상).
     */
    public Map<String, Object> saveAvatar(long userId, JsonNode body) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : KEYS) {
            String v = body != null && body.hasNonNull(k) && body.get(k).isTextual() ? body.get(k).asText() : null;
            out.put(k, v != null && ALLOWED.get(k).contains(v) ? v : DEFAULTS.get(k));
        }
        if ("glasses".equals(out.get("face"))
                && dsl.fetchOne("select count(*) from book where user_id = ?", userId).get(0, Integer.class) < 1)
            throw new ApiException(HttpStatus.BAD_REQUEST, "LOCKED", "동그란 안경은 첫 책을 기록하면 열려요");
        if ("beanie".equals(out.get("head"))
                && dsl.fetchOne("select count(*) from book where user_id = ? and status = 'DONE'", userId).get(0, Integer.class) < 10)
            throw new ApiException(HttpStatus.BAD_REQUEST, "LOCKED", "비니는 10권을 완독하면 열려요");
        try {
            String s = json.writeValueAsString(out);
            if (dsl.execute("update app_user set avatar = ?::jsonb where id = ?", s, userId) == 0)
                throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사용자를 찾을 수 없어요");
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        return get(userId);
    }

    private Map<String, Object> view(Record r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.get("id", Long.class));
        m.put("handle", r.get("handle", String.class));
        m.put("nickname", r.get("nickname", String.class));
        try {
            m.put("avatar", json.readTree(r.get("avatar", String.class)));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        return m;
    }
}
