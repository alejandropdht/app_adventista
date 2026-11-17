# Security Specification — Maranata Social & Study App

## 1. Data Invariants
1. A `PrivateUser` document (`/users/{userId}`) can only be read or written by the authenticated user whose `request.auth.uid == userId` and `email_verified == true`.
2. `PublicProfile` (`/publicProfiles/{userId}`) NEVER contains PII (`email`, `phone`, `address`) and can only be created or edited by `request.auth.uid == userId`.
3. A `VideoPost` (`/videos/{videoId}`) can only be created with `authorId == request.auth.uid` and initial `likesCount == 0`, `commentsCount == 0`, `createdAt == request.time`.
4. Updating `likesCount` on `/videos/{videoId}` is ONLY allowed by `+1` or `-1` atomically paired with creating or deleting `/videos/{videoId}/likes/{request.auth.uid}` (`existsAfter` / `!existsAfter`).
5. Updating `commentsCount` on `/videos/{videoId}` is ONLY allowed by `+1` when paired atomically with creating a `/videos/{videoId}/comments/{commentId}` or `-1` when deleting own comment.
6. `SavedVerse` (`/users/{userId}/savedVerses/{verseId}`) and `LessonProgress` (`/users/{userId}/lessonProgress/{progressId}`) strictly enforce `request.auth.uid == userId` and `data.userId == userId`.
7. All document IDs are validated with `^[a-zA-Z0-9_\-]+$` and bounded to `<= 128` characters.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Video Creation**: `{ id: "v1", authorId: "other-uid", ... }` by `user-a` -> `PERMISSION_DENIED`.
2. **PII Leak Attempt**: `get(/users/other-uid)` by `user-a` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Profile**: `{ uid: "user-a", displayName: "A", ..., isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` rejects unknown key).
4. **Unverified Email Write**: Creating profile/video when `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
5. **Counter Tampering on Video**: Updating `/videos/v1` setting `likesCount: 9999` without atomic like doc -> `PERMISSION_DENIED`.
6. **Timestamp Spoofing**: Creating `/videos/v1` with backdated `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
7. **Immutable Author Mutation**: Updating `/videos/v1` changing `authorId` -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Creating `/videos/${"a".repeat(200)}` or `/videos/bad$id` -> `PERMISSION_DENIED`.
9. **Oversized Caption**: Creating `/videos/v1` with `caption` length 5000 -> `PERMISSION_DENIED`.
10. **Cross-User SavedVerse Creation**: Writing `/users/victim/savedVerses/v1` as `attacker` -> `PERMISSION_DENIED`.
11. **Orphaned Comment**: Creating `/videos/nonexistent/comments/c1` -> `PERMISSION_DENIED` (`exists()` check on parent video).
12. **Profile Counter Forgery**: Creating `PublicProfile` with `followersCount: 50000` instead of `0` -> `PERMISSION_DENIED`.
