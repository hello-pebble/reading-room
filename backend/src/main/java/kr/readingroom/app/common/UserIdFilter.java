package kr.readingroom.app.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * TODO: 카카오 로그인이 생기면 이 임시 필터를 세션/토큰 인증으로 교체한다.
 * 지금은 X-User-Id 헤더의 숫자를 사용자 id로 믿는다. 없거나 숫자가 아니면 401.
 */
@Component
public class UserIdFilter extends OncePerRequestFilter {
    public static final String ATTR = "userId";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String p = req.getRequestURI();
        return p.equals("/health") || p.startsWith("/dev/") || p.startsWith("/error");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String h = req.getHeader("X-User-Id");
        Long id = null;
        try {
            if (h != null) id = Long.parseLong(h.trim());
        } catch (NumberFormatException ignored) {
        }
        if (id == null || id <= 0) {
            res.setStatus(401);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\":\"UNAUTHORIZED\",\"message\":\"로그인이 필요해요\"}");
            return;
        }
        req.setAttribute(ATTR, id);
        chain.doFilter(req, res);
    }
}
