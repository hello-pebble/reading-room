package kr.readingroom.app.common;

import kr.readingroom.app.common.dto.ErrorResponse;
import org.springframework.http.HttpStatus;

/** 상태 코드와 JSON 본문을 가진 API 오류. 409처럼 기존 데이터를 같이 돌려줄 때 body를 쓴다. */
public class ApiException extends RuntimeException {
    public final HttpStatus status;
    public final Object body;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.body = new ErrorResponse(code, message);
    }

    public ApiException(HttpStatus status, Object body) {
        super(status.getReasonPhrase());
        this.status = status;
        this.body = body;
    }
}
