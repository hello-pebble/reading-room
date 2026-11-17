package kr.readingroom.app.user;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
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
