export type BrowserNotificationStatus = 'unsupported'|'insecure'|'default'|'granted'|'denied'

export const browserPermissionService = {
  status(): BrowserNotificationStatus {
    if (!('Notification' in window)) return 'unsupported'
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return 'insecure'
    return Notification.permission
  },
  async request(): Promise<BrowserNotificationStatus> {
    const current = this.status()
    if (current === 'unsupported' || current === 'insecure' || current === 'denied') return current
    return Notification.requestPermission()
  }
}
