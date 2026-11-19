package kr.readingroom.app.user;

import java.util.regex.Pattern;
import kr.readingroom.app.common.ApiException;
import org.springframework.http.HttpStatus;

/**
 * 닉네임 규칙 (결정 #52·#67): 한글·영문·숫자만, 공백 없이 1~5자. 이모티콘·특수문자·공백은 쓸 수 없다.
 * 한글은 완성 글자(가-힣)와 자음·모음(ㄱ-ㅎ, ㅏ-ㅣ), 영문은 ASCII 알파벳만 허용한다(전각·악센트 글자 제외). 앞뒤 공백도 허용하지 않는다.
 * 같은 규칙을 DB 제약(V15)도 건다. 닉네임은 겹쳐도 된다(유일한 이름은 handle).
 */
public final class Nickname {
    public static final int MAX = 5;
    static final String MESSAGE = "닉네임은 한글·영문·숫자로 1~" + MAX + "자예요. 이모티콘·특수문자·공백은 쓸 수 없어요";
    private static final Pattern RULE = Pattern.compile("[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1," + MAX + "}");

    private Nickname() {}

    public static boolean valid(String nickname) {
        return nickname != null && RULE.matcher(nickname).matches();
    }

    /** 규칙에 맞으면 그대로 돌려주고, 아니면 400 BAD_NICKNAME */
    public static String require(String nickname) {
        if (!valid(nickname)) throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_NICKNAME", MESSAGE);
        return nickname;
    }

    /** dev 전용 기본값: 핸들에서 영문·숫자만 남겨 5자까지. 남는 글자가 없으면 빈 문자열(= 규칙 위반) */
    static String fromHandle(String handle) {
        if (handle == null) return null;
        String s = handle.replaceAll("[^A-Za-z0-9]", "");
        return s.length() > MAX ? s.substring(0, MAX) : s;
    }
}
