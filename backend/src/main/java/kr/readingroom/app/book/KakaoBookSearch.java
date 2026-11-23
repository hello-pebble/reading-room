package kr.readingroom.app.book;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kr.readingroom.app.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 카카오(다음) 책 검색 API (https://dapi.kakao.com/v3/search/book). 제목 검색의 정확도가 좋아 제목 검색에 먼저 쓴다.
 * 응답에는 쪽수가 없다(제목·저자·ISBN·표지만). 쪽수는 책을 고른 뒤 ISBN으로 국립중앙도서관에서 채운다(화면의 bpick).
 * REST API 키는 환경변수 KAKAO_REST_KEY로만 받는다. 키가 없으면 enabled()가 false이고 호출하지 않는다.
 */
@Component
public class KakaoBookSearch {
    static final String URL = "https://dapi.kakao.com/v3/search/book";
    private static final Pattern ISBN13 = Pattern.compile("\\b97[89]\\d{10}\\b");
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final ObjectMapper json = new ObjectMapper();
    private final String restKey;

    public KakaoBookSearch(@Value("${app.kakao.rest-key:}") String restKey) {
        this.restKey = restKey;
    }

    public boolean enabled() {
        return restKey != null && !restKey.isBlank();
    }

    /** 제목으로 찾는다. 실패하면 ApiException(502)을 던진다(부르는 쪽이 국립중앙도서관으로 넘어간다). */
    public List<Map<String, Object>> searchTitle(String q) {
        String url = URL + "?target=title&sort=accuracy&size=20&query=" + URLEncoder.encode(q, StandardCharsets.UTF_8);
        try {
            HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(6))
                            .header("Authorization", "KakaoAK " + restKey).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() != 200) throw failed();
            return parse(json.readTree(res.body()));
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw failed();
        }
    }

    private static ApiException failed() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "SEARCH_FAILED", "책 정보를 가져오지 못했어요. 직접 적어 주세요");
    }

    /** 응답의 documents를 화면용으로 바꾼다. 중복 ISBN·제목 없는 항목은 빼고 최대 10개. 쪽수는 모른다(null). */
    static List<Map<String, Object>> parse(JsonNode root) {
        List<Map<String, Object>> out = new ArrayList<>();
        JsonNode docs = root.path("documents");
        if (!docs.isArray()) return out;
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode d : docs) {
            String title = text(d, "title");
            if (title.isEmpty()) continue;
            String isbn = isbn(text(d, "isbn"));
            if (!seen.add(isbn.isEmpty() ? title + "|" + authors(d) : isbn)) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", title);
            m.put("author", authors(d));
            m.put("totalPages", null);
            m.put("isbn", isbn);
            m.put("coverUrl", text(d, "thumbnail").replaceFirst("^http:", "https:"));
            out.add(m);
            if (out.size() == 10) break;
        }
        return out;
    }

    /** "8908033254 9788908033254"처럼 ISBN10과 ISBN13이 공백으로 이어져 온다. 13자리가 있으면 그것을, 없으면 있는 것을 쓴다. */
    private static String isbn(String raw) {
        Matcher m = ISBN13.matcher(raw);
        if (m.find()) return m.group();
        String first = raw.trim().split("\\s+")[0];
        return first.matches("[\\dXx]{10}") ? first : "";
    }

    private static String authors(JsonNode d) {
        List<String> names = new ArrayList<>();
        JsonNode a = d.path("authors");
        if (a.isArray()) for (JsonNode n : a) if (!n.asText("").isBlank()) names.add(n.asText().trim());
        return String.join(", ", names);
    }

    private static String text(JsonNode d, String k) {
        JsonNode v = d.get(k);
        return v == null || v.isNull() ? "" : v.asText("").trim();
    }
}
