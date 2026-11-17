package kr.readingroom.app;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import kr.readingroom.app.push.PushSender;

/** 보낸 푸시를 모아 두는 테스트용 PushSender. */
public class RecordingPushSender implements PushSender {
    public record Sent(Subscription to, Message message) {}

    public final List<Sent> sent = new CopyOnWriteArrayList<>();
    public final List<String> goneEndpoints = new ArrayList<>();

    public void reset() {
        sent.clear();
        goneEndpoints.clear();
    }

    @Override
    public Result send(Subscription to, Message message) {
        sent.add(new Sent(to, message));
        return goneEndpoints.contains(to.endpoint()) ? Result.GONE : Result.SENT;
    }
}
