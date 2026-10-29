### This is a novel tracking backend service, where users can track their novel progress in real time.
To prevent incorrect, duplicate, or low quality novel entries, users cannot directly add novels to the global db.

Instead:

- An user can submit the request for adding a novel title in global db, that request will go through an admin.
- Admin will review the requests, and will have options to either reject or accept the novel title depending upon the correctness, or entry quality of the novel data.
- Approved novels will become avaiable globally.
- Moreover, Users can then add novels to their personal list and track the progress like, reading, plan to read, completed and so on.

**Tech Stack Used**
- Nodejs/Expressjs
- Neon Postgres (via Prisma) - Primary Db, also stores OTPs
- Neon Object Storage - User avatars

**API Endpoints**

  **Auth:**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/forgot-password
- POST /api/auth/verify-otp
- POST /api/auth/reset-password


**Novel:**
- POST   /api/novels/add
- GET    /api/novels
- GET    /api/novels/:id
- GET    /api/novels/view-request

- DELETE /api/novels/approve-request/:novelId
- DELETE /api/novels/reject-request/:novelId

_Only admins can approve or reject the novels_


**User's Novel:**
- POST   /api/users/novels/:novelId
- GET    /api/users/novels
- GET    /api/users/novels/:novelId
- GET    /api/users/novels/by-global/:novelId
- PATCH  /api/users/novels/:novelId
- DELETE /api/users/novels/:novelId
