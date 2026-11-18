package kr.readingroom.app.push;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import kr.readingroom.app.common.ClockConfig;
import org.jooq.Record;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 스탠드 알림 대상 선정과 발송 (1분 배치). 문구는 DATA_API 표 그대로.
 * 대상은 먼저 DB에서 "보냈음"으로 표시(claim)한 세션만 보내서, 배치가 겹치거나 다시 돌아도 같은 알림이 두 번 나가지 않는다.
 * (표시한 뒤 전송이 실패하면 그 알림은 다시 보내지 않는다: 중복보다 누락을 택한다)
 */
@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    public static final int CHECK_MINUTES = 60;

    private final NotificationRepository notificationRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final Clock clock;
    private final PushSender sender;

    public NotificationService(NotificationRepository notificationRepository, SubscriptionRepository subscriptionRepository, Clock clock, PushSender sender) {
        this.notificationRepository = notificationRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.clock = clock;
        this.sender = sender;
    }

    /** 알림 대상 세션 하나 (type: CHECK | CONFIRM). */
    public record Target(long userId, long sessionId, String type, String title, OffsetDateTime startedAt) {}

    /**
     * 60분 확인: RUNNING이고 last_check_at + 60분이 지난 세션을 last_check_at 값마다 한 번.
     * 3시간을 이미 넘긴 세션은 곧 '확인 필요'가 되므로 제외한다.
     */
    @Transactional
    public List<Target> claimCheckTargets() {
        var now = clock.instant();
        return targets(notificationRepository.claimCheck(now.minus(java.time.Duration.ofMinutes(CHECK_MINUTES)).toString(), now.minus(kr.readingroom.app.session.SessionService.CAP).toString()), "CHECK");
    }

    /** 확인 필요: NEEDS_CONFIRM으로 바뀐 세션을 한 번만. */
    @Transactional
    public List<Target> claimConfirmTargets() {
        return targets(notificationRepository.claimConfirm(clock.instant().toString()), "CONFIRM");
    }

    private List<Target> targets(org.jooq.Result<Record> rows, String type) {
        List<Target> out = new ArrayList<>();
        for (Record r : rows)
            out.add(new Target(r.get("user_id", Long.class), r.get("id", Long.class), type, r.get("title", String.class), r.get("started_at", OffsetDateTime.class)));
        return out;
    }

    /** 1분 배치가 부른다: 대상을 고르고(표시) 푸시를 보낸다. 보낸 대상 목록을 돌려준다. */
    public List<Target> dispatchDue() {
        List<Target> all = new ArrayList<>(claimCheckTargets());
        all.addAll(claimConfirmTargets());
        all.forEach(this::deliver);
        return all;
    }

    private void deliver(Target p) {
        PushSender.Message msg = "CHECK".equals(p.type())
                ? new PushSender.Message("CHECK", "아직 읽고 있어요?", "『" + p.title() + "』을 읽은 지 60분이 지났어요. 계속 읽고 있나요?", "LAMP", p.sessionId())
                : new PushSender.Message("CONFIRM", "확인이 필요해요", clockText(p.startedAt()) + "에 켠 스탠드가 아직 켜져 있어요", "LAMP", p.sessionId());
        for (Record sub : subscriptionRepository.findByUser(p.userId())) {
            try {
                var to = new PushSender.Subscription(sub.get("id", Long.class), p.userId(), sub.get("endpoint", String.class), sub.get("p256dh", String.class), sub.get("auth", String.class));
                if (sender.send(to, msg) == PushSender.Result.GONE) subscriptionRepository.deleteById(to.id());   // 404·410이면 구독 삭제
            } catch (RuntimeException e) {
                log.warn("푸시 전송 실패 (user={}, session={}): {}", p.userId(), p.sessionId(), e.toString());
            }
        }
    }

    /** 한국 시간 HH:MM */
    static String clockText(OffsetDateTime t) {
        var z = t.toInstant().atZone(ClockConfig.SEOUL);
        return String.format("%02d:%02d", z.getHour(), z.getMinute());
    }
}
