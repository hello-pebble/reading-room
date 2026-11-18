package kr.readingroom.app.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** 화면(다른 주소에서 열림)이 API를 부를 수 있게 허용할 주소. 값은 app.cors.origins(환경변수 CORS_ORIGINS). */
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    private final String[] origins;

    public CorsConfig(@Value("${app.cors.origins:}") String origins) {
        this.origins = origins.isBlank() ? new String[0] : origins.trim().split("\\s*,\\s*");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (origins.length == 0) return;
        registry.addMapping("/**").allowedOrigins(origins).allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*").maxAge(3600);
    }
}
