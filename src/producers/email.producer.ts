import { NotificationDto} from "../dto/notification.dto.ts";
import { mailerQueue } from "../queues/email.queue.ts";

export const MAILER_PAYLOAD = "payload:mail";

export const addEmailToQueue = async (payload: NotificationDto) => {
    await mailerQueue.add(MAILER_PAYLOAD , payload);
    console.log(`Email added to queue : ${JSON.stringify(payload)}`);
}