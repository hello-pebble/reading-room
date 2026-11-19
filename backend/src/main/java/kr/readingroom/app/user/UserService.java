package kr.readingroom.app.user;

import kr.readingroom.app.user.dto.*;
import kr.readingroom.app.book.BookRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kr.readingroom.app.common.ApiException;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class UserService {
    private final BookRepository bookRepository;
    private final UserRepository userRepository;
    private final ObjectMapper json;

    public UserService(BookRepository bookRepository, UserRepository userRepository, ObjectMapper json) {
        this.bookRepository = bookRepository;
        this.userRepository = userRepository;
        this.json = json;
    }

    public UserResponse get(long id) {
        Record r = userRepository.findById(id);
        if (r == null) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사용자를 찾을 수 없어요");
        return view(r);
    }

    /** 개발용 사용자 만들기(/dev/users). 닉네임은 Nickname 규칙을 지켜야 한다. */
    public UserResponse create(String nickname) {
        Nickname.require(nickname);
        return view(userRepository.insert(nickname));
    }

    /** 닉네임 정하기·바꾸기. 규칙은 Nickname(한글·영문·숫자 1~5자, 공백·이모티콘·특수문자 금지). 닉네임은 겹쳐도 된다. */
    public UserResponse changeNickname(long userId, String nickname) {
        Nickname.require(nickname);
        if (userRepository.updateNickname(nickname, userId) == 0)
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사용자를 찾을 수 없어요");
        return get(userId);
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
    public UserResponse saveAvatar(long userId, AvatarRequest body) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : KEYS) {
            String v = body == null ? null : body.value(k);
            out.put(k, v != null && ALLOWED.get(k).contains(v) ? v : DEFAULTS.get(k));
        }
        if ("glasses".equals(out.get("face"))
                && bookRepository.countByUser(userId).get(0, Integer.class) < 1)
            throw new ApiException(HttpStatus.BAD_REQUEST, "LOCKED", "동그란 안경은 첫 책을 기록하면 열려요");
        if ("beanie".equals(out.get("head"))
                && bookRepository.countFinished(userId).get(0, Integer.class) < 10)
            throw new ApiException(HttpStatus.BAD_REQUEST, "LOCKED", "비니는 10권을 완독하면 열려요");
        try {
            String s = json.writeValueAsString(out);
            if (userRepository.updateAvatar(s, userId) == 0)
                throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사용자를 찾을 수 없어요");
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        return get(userId);
    }

    private UserResponse view(Record r) {
        try {
            return new UserResponse(r.get("id", Long.class), r.get("public_id", String.class), r.get("nickname", String.class),
                    json.readValue(r.get("avatar", String.class), AvatarResponse.class), r.get("needs_nickname", Boolean.class));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
