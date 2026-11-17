package kr.readingroom.app.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.function.Supplier;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Idempotency-Key 헤더 처리. 같은 사용자·키로 다시 오면 처음의 성공 응답을 그대로 돌려주고 다시 실행하지 않는다.
 * 실패(4xx)는 저장하지 않는다. 같은 키를 다른 경로에 쓰면 422.
 */
@Service
public class IdempotencyService {
    private final DSLContext dsl;
    private final TransactionTemplate tx;
    private final ObjectMapper json;

    public IdempotencyService(DSLContext dsl, TransactionTemplate tx, ObjectMapper json) {
        this.dsl = dsl;
        this.tx = tx;
        this.json = json;
    }

    public ResponseEntity<Object> run(long userId, String key, String path, HttpStatus okStatus, Supplier<Object> action) {
        if (key == null || key.isBlank()) return ResponseEntity.status(okStatus).body(action.get());
        if (key.length() > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_KEY", "Idempotency-Key는 100자까지예요");
        return tx.execute(st -> {
            // 같은 키가 동시에 오면 한쪽이 끝날 때까지 기다리게 한다
            dsl.fetch("select pg_advisory_xact_lock(hashtextextended(?, 0))", userId + ":" + key);
            Record saved = dsl.fetchOne("select path, status, body::text as body from idempotency_key where user_id = ? and key = ?", userId, key);
            if (saved != null) {
                if (!saved.get("path", String.class).equals(path))
                    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "KEY_REUSED", "이 Idempotency-Key는 다른 요청에 쓰였어요");
                return ResponseEntity.status(saved.get("status", Integer.class)).body((Object) parse(saved.get("body", String.class)));
            }
            Object body = action.get();
            dsl.execute("insert into idempotency_key(user_id, key, path, status, body) values (?, ?, ?, ?, ?::jsonb)",
                    userId, key, path, okStatus.value(), write(body));
            return ResponseEntity.status(okStatus).body(body);
        });
    }

    private String write(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private JsonNode parse(String s) {
        try {
            return s == null ? null : json.readTree(s);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
