# Your Plot notifications (App Store setup)

This test build can remind a player about bills, car registration, and game events such as a house settling. In-game, reminders also appear under the existing bell.

## What works on the web today

- In-app notices always go to the bell, and they honour the per-type toggles in Settings.
- If the player turns on **Remind Me** for a bill (or taps **Yes** on the one-question prompt), Your Plot asks for permission with a brand-styled card. Permission is never requested on load.
- On the web and in a PWA, the Notification API plus `yp-sw.js` (`showNotification`) can show a system notice while the page is open or still running in the background.
- Game dates are deterministic, so each reminder is scheduled for a known wall-clock time (the game week, converted with the current clock speed, minus the lead time the player chose: the day before, 3 days or a week).

## What GitHub Pages cannot do

True closed-app push (a notice after the site is fully closed) needs either:

- **Native local notifications** on iOS and Android, which do not need a server, or
- **Web Push** (VAPID + a push service), which needs a server GitHub Pages cannot host.

The game code talks to an adapter (`ypNotifyAdapter`). A Capacitor wrap can plug in `@capacitor/local-notifications` and `@capacitor/push-notifications` without changing Bills or event code.

## Capacitor wrap for the App Store

1. Wrap this preview folder (or the later live build) with Capacitor (`@capacitor/ios`, `@capacitor/android`).
2. Install `@capacitor/local-notifications`. Optional: `@capacitor/push-notifications` if you later add a server for remote push.
3. Confirm `Capacitor.Plugins.LocalNotifications` (and Push, if used) is available at runtime. The adapter will then schedule `LocalNotifications` at the same wall-clock times it already computes.
4. iOS: add an APNs key (or certificate) in the Apple Developer account and enable the Push Notifications capability in Xcode if you use remote push. Local notifications still need the permission strings below.
5. Add permission usage strings:

   - iOS `Info.plist`: `NSUserNotificationsUsageDescription` — for example, “Your Plot sends reminders for bills, registration and events such as a house settling.”
   - Android: `POST_NOTIFICATIONS` (Android 13+), declared in the app manifest. The adapter calls `requestPermissions()` only after the player first opts in.

6. Test with the device’s notification permission granted and the app force-closed: a bill or settlement scheduled in the future should still appear at that wall-clock time.

Local notifications are enough for due dates and settlement times, because those instants are known in advance. A push server is only needed for unexpected live events that the closed app cannot schedule itself.
