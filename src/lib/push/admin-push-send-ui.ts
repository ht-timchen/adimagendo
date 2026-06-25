export const ADMIN_NO_PUSH_SUBSCRIPTION_ERROR =
  "This participant has not enabled push notifications. The notification could not be sent.";

export function adminPushSendErrorMessage(status: number, serverMsg: string): string {
  const normalized = serverMsg.toLowerCase();
  if (status === 404 && normalized.includes("no active push subscription")) {
    return ADMIN_NO_PUSH_SUBSCRIPTION_ERROR;
  }
  if (serverMsg) return serverMsg;
  if (status === 403) return "You do not have permission to send notifications.";
  return "Failed to send notification.";
}
