package kr.readingroom.app.push;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** VAPID 설정. 값은 환경변수에서만 들어온다 (application.properties의 ${VAPID_*:}). */
@ConfigurationProperties(prefix = "app.push.vapid")
public record PushProperties(String publicKey, String privateKey, String subject) {
    public boolean configured() {
        return publicKey != null && !publicKey.isBlank() && privateKey != null && !privateKey.isBlank();
    }
}
