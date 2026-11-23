package kr.readingroom.app.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 로그인한 사용자를 정한다 (결정 #68). `Authorization: Bearer <토큰>`을 TokenResolver(auth.AuthService)로 확인해 사용자 id를 요청에 담는다.
 * 없거나 틀리거나 만료됐으면 401. 개발용 `X-User-Id` 헤더는 **dev 프로파일에서만** 받는다(운영에서는 무시).
 * Bearer 헤더가 있으면 그 결과만 믿고, 틀렸다고 X-User-Id로 넘어가지 않는다.
 */
@Component
public class UserIdFilter extends OncePerRequestFilter {
    public static final String ATTR = "userId";
    private final TokenResolver tokens;
    private final boolean devHeader;

    public UserIdFilter(TokenResolver tokens, Environment env) {
        this.tokens = tokens;
        this.devHeader = env.acceptsProfiles(Profiles.of("dev"));
    }

    /** "Bearer abc" → "abc". 접두어가 없거나 토큰이 비면 null */
    public static String bearer(String authorization) {
        if (authorization == null || authorization.length() <= 7 || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) return null;
        String t = authorization.substring(7).trim();
        return t.isEmpty() ? null : t;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String p = req.getRequestURI();
        // 브라우저가 먼저 보내는 CORS 확인(OPTIONS), 책 검색(공개 서지 데이터), 초대 링크 미리보기(GET /rooms/invite/{code}, 로그인 전에 보여 준다)는
        // 사용자 헤더 없이 통과시킨다.
        // TODO: 구글 로그인이 생기면 책 검색도 로그인 필요 + 호출 횟수 제한으로 바꾼다(국립중앙도서관 호출 한도 보호).
        // 화면 파일(GET 정적 파일)도 로그인 없이 내보낸다
        boolean staticFile = req.getMethod().equals("GET") && (p.equals("/") || p.equals("/index.html") || p.equals("/config.js") || p.equals("/favicon.ico") || p.startsWith("/js/") || p.startsWith("/css/") || p.startsWith("/vendor/"));
        return staticFile || req.getMethod().equals("OPTIONS") || p.equals("/health") || p.equals("/books/search") || (req.getMethod().equals("GET") && p.startsWith("/rooms/invite/")) || p.startsWith("/dev/") || p.startsWith("/error")
                || (req.getMethod().equals("POST") && (p.equals("/auth/google") || p.equals("/auth/guest") || p.equals("/auth/transfer")));   // 구글·게스트·이전 코드 로그인은 토큰을 받기 전에 부른다
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        Long id = null;
        String token = bearer(req.getHeader("Authorization"));
        if (token != null) {
            id = tokens.userIdFor(token);
        } else if (devHeader) {
            String h = req.getHeader("X-User-Id");
            try {
                if (h != null) id = Long.parseLong(h.trim());
            } catch (NumberFormatException ignored) {
            }
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
