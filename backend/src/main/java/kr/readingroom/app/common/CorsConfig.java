package kr.readingroom.app.common;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * 화면(다른 주소에서 열림)이 API를 부를 수 있게 허용할 주소. 값은 app.cors.origins(환경변수 CORS_ORIGINS).
 * 로그인 필터(UserIdFilter)가 401을 직접 돌려줄 때도 헤더가 붙도록, 모든 필터보다 앞에서 도는 CorsFilter로 건다.
 */
@Configuration
public class CorsConfig {
    @Bean
    FilterRegistrationBean<CorsFilter> corsFilter(@Value("${app.cors.origins:}") String origins) {
        var source = new UrlBasedCorsConfigurationSource();
        if (!origins.isBlank()) {
            var c = new CorsConfiguration();
            c.setAllowedOrigins(List.of(origins.trim().split("\\s*,\\s*")));
            c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            c.setAllowedHeaders(List.of("*"));
            c.setMaxAge(3600L);
            source.registerCorsConfiguration("/**", c);
        }
        var bean = new FilterRegistrationBean<>(new CorsFilter(source));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }
}
