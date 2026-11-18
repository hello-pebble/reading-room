package kr.readingroom.app.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * TODO: 구글 로그인이 생기면 이 임시 필터를 세션/토큰 인증으로 교체한다.
 * 지금은 X-User-Id 헤더의 숫자를 사용자 id로 믿는다. 없거나 숫자가 아니면 401.
 */
@Component
public class UserIdFilter extends OncePerRequestFilter {
    public static final String ATTR = "userId";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String p = req.getRequestURI();
        // 브라우저가 먼저 보내는 CORS 확인(OPTIONS), 책 검색(공개 서지 데이터), 초대 링크 미리보기(GET /rooms/invite/{code}, 로그인 전에 보여 준다)는
        // 사용자 헤더 없이 통과시킨다.
        // TODO: 구글 로그인이 생기면 책 검색도 로그인 필요 + 호출 횟수 제한으로 바꾼다(국립중앙도서관 호출 한도 보호).
        return req.getMethod().equals("OPTIONS") || p.equals("/health") || p.equals("/books/search") || (req.getMethod().equals("GET") && p.startsWith("/rooms/invite/")) || p.startsWith("/dev/") || p.startsWith("/error");
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
