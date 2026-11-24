package kr.readingroom.app.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** 모든 응답에 기본 보안 헤더를 붙인다: 형식 추측 금지, 다른 사이트의 iframe 삽입 금지, 주소(Referer) 최소 전달, HTTPS 고정(HSTS는 HTTPS 요청에만). */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class SecurityHeaders extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "no-referrer");
        if (req.isSecure()) res.setHeader("Strict-Transport-Security", "max-age=31536000");
        chain.doFilter(req, res);
    }
}
