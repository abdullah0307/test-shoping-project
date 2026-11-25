# Security Specification & Payload-First Threat Model

## 1. Data Invariants
1. **PII Isolation (`/users/{userId}`)**: User profiles store `email` and `phone`. Only the profile owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`) may `get` a user document; only admins may `list` `/users`.
2. **No Self-Assigned Roles**: On `/users/{userId}` creation by a non-admin, `role` MUST equal `'user'`, `status` MUST equal `'active'`, `uid` MUST match `request.auth.uid`, and `email` MUST match `request.auth.token.email`. Non-admins cannot alter `role`, `status`, `planTier`, `projectedRevenue`, or `inboundCallsGrowth`.
3. **Authoritative Admin Registry (`/admins/{adminUid}`)**: Only existing verified admins (seeded bootstrap admin `abdullahjavaid0307@gmail.com` with `email_verified == true` or existing `/admins/{uid}` entry) can grant or revoke admin docs. An admin cannot delete their own `/admins/{uid}` entry.
4. **Relational Integrity (`/bookings`, `/audits`)**: Both collections require an existing `/users/{request.auth.uid}` parent profile on create, bind `userId == request.auth.uid`, enforce server timestamps (`request.time`), and lock terminal states (`completed`, `cancelled`) against non-admin edits.
5. **Query Security**: All `allow list` rules explicitly enforce `resource.data.userId == request.auth.uid || isAdmin()` (never relying on client queries alone).

## 2. The "Dirty Dozen" Attack Payloads (Must All Return `PERMISSION_DENIED`)
1. Unauthenticated read of `/users/user_1`.
2. Non-admin `list` of `/users` without admin privileges.
3. Self-escalation on `/users/user_1` create: `{ uid: "user_1", role: "admin", status: "active", ... }`.
4. Shadow update on `/users/user_1`: `{ companyName: "Apex", isSuperAdmin: true, updatedAt: request.time }`.
5. Suspended user updating their own profile (`existing().status == 'suspended'`).
6. Non-admin creating `/admins/user_1` to grant themselves admin privileges.
7. Spoofed booking creation with `userId: "victim_uid"` while signed in as `attacker_uid`.
8. Unverified email account (`email_verified: false`) writing to `/bookings/b1`.
9. Booking creation with forged future `createdAt` timestamp (`createdAt != request.time`).
10. Client updating a `completed` booking back to `pending`.
11. Audit creation with `adminNotes: "Approved free tier"` or `status: "blueprint_ready"` from a regular user.
12. Resource poisoning with a 1,500-character document ID (`isValidId` rejects `id.size() > 128` or invalid chars).
