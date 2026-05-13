# Security Specification - Course Registration App

## Data Invariants
- A registration must contain a valid name, employee ID, and email.
- The `createdAt` timestamp must be the server time.
- Registration IDs must be valid.
- Once submitted, a registration cannot be modified or deleted by the public.

## The "Dirty Dozen" (Attack Payloads)
1. **Shadow Field Attack**: Add `isApproved: true` to the payload. (Rejected by `keys().size() == 4`)
2. **Identity Spoofing**: Try to set a fake `createdAt` in the past. (Rejected by `data.createdAt == request.time`)
3. **Resource Exhaustion**: Send a 1MB string as the `name`. (Rejected by `size() <= 100`)
4. **Invalid Email**: Send `notalemail` as the email field. (Rejected by regex)
5. **Unauthorized Update**: Attempt to change a registration's email after creation. (Rejected by `allow update: if false`)
6. **Unauthorized Delete**: Attempt to delete someone else's registration. (Rejected by `allow delete: if false`)
7. **ID Poisoning**: Use an extremely long string as the document ID. (Handled by Firestore limits, but `isValidId` can be used)
8. **Missing Fields**: Send only `name` and `email`. (Rejected by `hasAll`)
9. **Type Mismatch**: Send an integer as the `name`. (Rejected by `is string`)
10. **Duplicate Submission Spam**: (Usually handled at the app level or unique constraints, but rules block illegal formats)
11. **Client Timestamp Manipulation**: Sending a client-side timestamp. (Rejected by `request.time` check)
12. **Insecure List Query**: Attempting to scrape all registration details. (Rules allow listing for the count, but standard practice would restrict fields if PII is involved. In this version, we prioritize the "Live Counter" feature for the user).

## Test Runner
Expected results for all above: `PERMISSION_DENIED`.
