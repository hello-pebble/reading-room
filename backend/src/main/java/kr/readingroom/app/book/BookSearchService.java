package kr.readingroom.app.book;

import kr.readingroom.app.book.dto.*;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kr.readingroom.app.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** 책 찾기: ISBN(10·13자리, 하이픈 가능)·ISBN이 든 링크·제목·저자를 한 입력으로 받는다. */
@Service
public class BookSearchService {
    private static final Pattern URL = Pattern.compile("^https?://", Pattern.CASE_INSENSITIVE);
    private static final Pattern ISBN_IN_LINK = Pattern.compile("97[89]\\d{10}|(?<!\\d)\\d{9}[\\dXx](?!\\d)");
    private static final Pattern ISBN_LIKE = Pattern.compile("^[\\dXx\\s-]{10,17}$");
    private final BookSearchSource source;

    public BookSearchService(BookSearchSource source) {
        this.source = source;
    }

    public List<BookSearchResponse> search(String q) {
        q = q == null ? "" : q.trim();
        if (q.isEmpty()) throw bad("검색어를 적어 주세요");
        if (URL.matcher(q).find()) {
            Matcher m = ISBN_IN_LINK.matcher(q);
            if (!m.find()) throw bad("이 링크에서 책을 찾지 못했어요. 제목으로 찾아 보세요");
            return byIsbn(m.group());
        }
        if (ISBN_LIKE.matcher(q).matches()) return byIsbn(q);
        List<BookSearchResponse> r = lookup("title", q);
        return r.isEmpty() ? lookup("author", q) : r;
    }

    private List<BookSearchResponse> byIsbn(String raw) {
        String isbn = toIsbn13(raw);
        if (isbn.isEmpty()) throw bad("ISBN이 올바르지 않아요. 숫자 10자리 또는 13자리를 확인해 주세요");
        return lookup("isbn", isbn);
    }

    private List<BookSearchResponse> lookup(String field, String value) {
        return source.search(field, value).stream().map(b -> new BookSearchResponse((String) b.get("title"), (String) b.get("author"),
                (Integer) b.get("totalPages"), (String) b.get("isbn"), (String) b.get("coverUrl"))).toList();
    }

    /** ISBN-10이면 13자리로 바꾼다. 검사 숫자가 틀리면 빈 문자열. */
    static String toIsbn13(String s) {
        s = s.replaceAll("[-\\s]", "").toUpperCase();
        if (s.matches("97[89]\\d{10}")) return check(s.substring(0, 12)) == s.charAt(12) - '0' ? s : "";
        if (s.matches("\\d{9}[\\dX]") && validIsbn10(s)) { String b = "978" + s.substring(0, 9); return b + check(b); }
        return "";
    }

    /** ISBN-10 검사: 각 자리 x (10..1)의 합이 11로 나누어떨어져야 한다 (마지막 X는 10). */
    private static boolean validIsbn10(String s) {
        int t = 0;
        for (int i = 0; i < 10; i++) t += (s.charAt(i) == 'X' ? 10 : s.charAt(i) - '0') * (10 - i);
        return t % 11 == 0;
    }

    private static int check(String twelve) {
        int t = 0;
        for (int i = 0; i < 12; i++) t += (twelve.charAt(i) - '0') * (i % 2 == 1 ? 3 : 1);
        return (10 - t % 10) % 10;
    }

    private static ApiException bad(String msg) {
        return new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", msg);
    }
}
