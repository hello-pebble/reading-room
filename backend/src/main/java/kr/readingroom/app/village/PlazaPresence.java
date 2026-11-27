package kr.readingroom.app.village;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import kr.readingroom.app.village.dto.PlazaMember;
import org.jooq.Record;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 광장 접속 인원 (결정 #91). 광장(돌바닥) 안에 있는 화면이 SSE 연결을 유지하는 동안 접속으로 센다. 누가 오거나 가면 연결된 모두에게
 * 지금 명단(presence 이벤트)을 보낸다. 같은 사람이 탭 여러 개로 와도 한 명이다.
 * ponytail: 서버 한 대의 메모리에 둔다. 서버를 여러 대로 늘리면 Redis pub/sub 같은 공용 저장소로 옮긴다.
 */
@Service
public class PlazaPresence {
    static final long TIMEOUT_MS = Duration.ofMinutes(30).toMillis(); // 끝나면 화면이 다시 연결한다
    private final PlazaRepository plaza;
    private final ObjectMapper json = new ObjectMapper();
    private final Map<SseEmitter, PlazaMember> conns = new ConcurrentHashMap<>();

    public PlazaPresence(PlazaRepository plaza) {
        this.plaza = plaza;
    }

    public SseEmitter connect(long userId) {
        SseEmitter e = new SseEmitter(TIMEOUT_MS);
        e.onCompletion(() -> drop(e));
        e.onTimeout(() -> drop(e));
        e.onError(x -> drop(e));
        conns.put(e, member(plaza.member(userId)));
        broadcast();
        return e;
    }

    /** 지금 광장에 있는 사람 (공개 번호 순, 같은 사람은 한 번) */
    public List<PlazaMember> members() {
        Map<String, PlazaMember> by = new LinkedHashMap<>();
        conns.values().stream().sorted(Comparator.comparing(PlazaMember::publicId)).forEach(m -> by.putIfAbsent(m.publicId(), m));
        return new ArrayList<>(by.values());
    }

    /** 끊긴 연결을 찾아내려고 주석 한 줄을 보낸다 (프록시가 조용한 연결을 끊지 않게 하는 효과도 있다) */
    public synchronized void heartbeat() {
        if (sendAll(SseEmitter.event().comment("ping").build())) broadcast();
    }

    void drop(SseEmitter e) {
        if (conns.remove(e) != null) broadcast();
    }

    private synchronized void broadcast() {
        // 보내다 끊긴 연결이 있으면 그 사람을 뺀 명단을 다시 보낸다
        while (sendAll(SseEmitter.event().name("presence").data(members(), MediaType.APPLICATION_JSON).build())) {}
    }

    /** 모두에게 보내고, 끊긴 연결은 지운다. 지운 것이 있으면 true */
    private boolean sendAll(Set<ResponseBodyEmitter.DataWithMediaType> data) {
        boolean dropped = false;
        for (SseEmitter e : List.copyOf(conns.keySet())) {
            try {
                e.send(data);
            } catch (IOException | IllegalStateException x) {
                dropped |= conns.remove(e) != null;
            }
        }
        return dropped;
    }

    private PlazaMember member(Record r) {
        JsonNode avatar;
        try {
            avatar = json.readTree(r.get("avatar", String.class));
        } catch (Exception x) {
            avatar = null;
        }
        return new PlazaMember(r.get("public_id", String.class), r.get("nickname", String.class), avatar);
    }
}
