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
import java.util.Comparator;
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
 * 국립중앙도서관 ISBN 서지정보 API (https://www.nl.go.kr/seoji/SearchApi.do).
 * 제목·저자·ISBN으로 찾고, 응답의 PAGE(쪽수)·TITLE_URL(표지)를 쓴다. 인증키는 환경변수 NL_CERT_KEY로만 받는다.
 */
@Component
public class NlBookSearch implements BookSearchSource {
    static final String URL = "https://www.nl.go.kr/seoji/SearchApi.do";
    private static final Pattern DIGITS = Pattern.compile("\\d[\\d,]*");
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final ObjectMapper json = new ObjectMapper();
    private final String certKey;

    public NlBookSearch(@Value("${app.nl.cert-key:}") String certKey) {
        this.certKey = certKey;
    }

    @Override
    public List<Map<String, Object>> search(String field, String value) {
        if (certKey == null || certKey.isBlank())
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SEARCH_UNAVAILABLE", "책 검색이 아직 준비되지 않았어요. 직접 적어 주세요");
        String url = URL + "?cert_key=" + enc(certKey) + "&result_style=json&page_no=1&page_size=50&ebook_yn=N&" + field + "=" + enc(value);
        try {
            HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(6)).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() != 200) throw failed();
            return parse(json.readTree(res.body()), "title".equals(field) ? value : "");
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

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    /** 응답은 {TOTAL_COUNT, PAGE_NO, docs:[{TITLE, AUTHOR, PAGE, EA_ISBN, TITLE_URL ...}]}. docs 이름이 달라도 첫 객체 배열을 쓴다. */
    static List<Map<String, Object>> parse(JsonNode root) {
        return parse(root, "");
    }

    /**
     * 응답을 화면용으로 바꾼다. query(제목 검색어)가 있으면 제목 검색이 "포함" 검색이라 엉뚱한 책이 앞서는 것을 바로잡아
     * 같은 제목 → 검색어로 시작하는 제목 → 검색어가 들어간 제목 → 나머지 순으로 놓는다(같은 단계는 API 순서 그대로). 최대 10개.
     */
    static List<Map<String, Object>> parse(JsonNode root, String query) {
        JsonNode docs = root.path("docs");
        if (!docs.isArray()) docs = root.path("DOCS");
        if (!docs.isArray()) {
            for (JsonNode n : root) if (n.isArray()) { docs = n; break; }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        if (!docs.isArray()) return out;
        for (JsonNode d : docs) {
            String title = text(d, "TITLE"), vol = text(d, "VOL");
            if (title.isEmpty()) continue;
            String isbn = text(d, "EA_ISBN");
            if (isbn.isEmpty()) isbn = text(d, "SET_ISBN");
            if (!seen.add(isbn.isEmpty() ? title + "|" + text(d, "AUTHOR") : isbn)) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", vol.isEmpty() ? title : title + " " + vol);
            m.put("author", author(text(d, "AUTHOR")));
            m.put("totalPages", pages(text(d, "PAGE")));
            m.put("isbn", isbn);
            m.put("coverUrl", text(d, "TITLE_URL").replaceFirst("^http:", "https:"));
            out.add(m);
        }
        String q = norm(query);
        if (!q.isEmpty()) out.sort(Comparator.comparingInt(b -> titleRank(norm((String) b.get("title")), q))); // 안정 정렬: 같은 단계는 API 순서
        return out.size() > 10 ? new ArrayList<>(out.subList(0, 10)) : out;
    }

    private static String norm(String s) {
        return s == null ? "" : s.replaceAll("\\s+", "");
    }

    private static int titleRank(String title, String q) {
        if (title.equals(q)) return 0;
        if (title.startsWith(q)) return 1;
        return title.contains(q) ? 2 : 3;
    }

    /** 응답의 저자는 "저자 : 박경리", "지은이: 남기업,이진수"처럼 역할 머리말이 붙어 온다. 맨 앞의 짧은 한글 머리말만 뗀다. */
    static String author(String s) {
        return s.replaceFirst("^[가-힣·]{1,6}\\s*:\\s*", "");
    }

    private static String text(JsonNode d, String k) {
        JsonNode v = d.get(k);
        return v == null || v.isNull() ? "" : v.asText("").trim();
    }

    /** "215", "215 p.", "1,024쪽" -> 쪽수. 1~9999 밖이거나 숫자가 없으면 null(프로토타입과 같은 규칙). */
    static Integer pages(String s) {
        Matcher m = DIGITS.matcher(s);
        if (!m.find()) return null;
        int n = Integer.parseInt(m.group().replace(",", ""));
        return n >= 1 && n <= 9999 ? n : null;
    }
}
