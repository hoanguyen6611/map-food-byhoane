# Bản Đặc Tả Toàn Diện — The Food Map of Vietnam

> **Trạng thái**: tài liệu mô tả hiện trạng thực tế của hệ thống. Khác với `01-prd-mvp.md` đến `09-testing-plan.md` (kế hoạch sản phẩm/xây dựng ban đầu), tài liệu này mô tả hệ thống **đúng như nó đang được triển khai hiện tại**, trên cả backend, admin web và mobile. Ở những chỗ phần triển khai thực tế đã khác hoặc vượt xa so với kế hoạch ban đầu, tài liệu này phản ánh đúng thực tế. Tạo lần cuối: 2026-08-14.

## 1. Tổng quan sản phẩm

The Food Map of Vietnam là nền tảng khám phá và đánh giá nhà hàng với ba giao diện người dùng dùng chung một backend:

- **Backend** (`backend/`) — NestJS modular monolith, PostgreSQL+PostGIS (Prisma), Redis, lưu trữ tương thích S3, Anthropic Claude cho kiểm duyệt/tóm tắt AI, gửi push qua Expo.
- **Admin Web** (`admin-web/`) — công cụ nội bộ Vite/React dành cho admin và moderator để quản lý nhà hàng, hàng đợi kiểm duyệt, các đánh giá đã publish, và người dùng.
- **Mobile** (`mobile/`) — ứng dụng Expo/React Native (SDK 57) dành cho người dùng cuối, vừa được lột xác theo ngôn ngữ thiết kế "Ngon v3" (điều hướng 4 tab + phím tắt nổi "Viết").
- **Public Web** (kế hoạch, chưa bắt đầu) — trang web Next.js tập trung SEO cho người dùng cuối; nằm trong Phase 1.5, chỉ bắt đầu sau khi mobile MVP hoàn thành. Xem `docs/build-prompts/09-public-web.md`.

### Các điểm kiến trúc xuyên suốt

- Một schema Prisma duy nhất (`backend/prisma/schema.prisma`) là nguồn dữ liệu chân lý duy nhất; cả admin-web lẫn mobile đều gọi cùng một REST API, không có lớp GraphQL/BFF riêng.
- Xác thực đồng nhất trên mọi client: `POST /auth/login` cấp một cặp JWT access token (thời hạn ngắn) + refresh token (chuỗi mờ) cho bất kỳ ai, không phân biệt vai trò. Admin-web sau đó tự từ chối (ở phía client) mọi vai trò ngoài `{admin, moderator}` sau đúng lệnh đăng nhập đó — không có endpoint đăng nhập admin riêng.
- Mọi nội dung do người dùng/cộng đồng đóng góp (đánh giá, đóng góp, ảnh) đều đi qua cùng cơ chế kiểm duyệt (`ModerationResult`, Claude gateway kèm cơ chế dự phòng dựa trên luật, một ngưỡng rủi ro dùng chung) trước khi được công khai.
- "Không bao giờ bịa số liệu giả" là nguyên tắc thiết kế được nhắc lại nhiều lần trong code mobile: các *mục tiêu*/*nhãn* tĩnh (placeholder) được dùng thoải mái ở những nơi backend chưa có khái niệm tương ứng, nhưng không màn hình nào bịa ra số đếm, biểu đồ phân bố, hay hoạt động giả về nội dung người dùng thật — các khoảng trống được thể hiện trung thực (`"—"`, "chưa có", "sắp ra mắt") thay vì che giấu.

---

## 2. Backend (`backend/`)

**Công nghệ**: NestJS (modular monolith) · PostgreSQL + PostGIS qua Prisma (dùng `$queryRaw` thô cho tìm kiếm geo/full-text) · Redis (cache + giới hạn tần suất + hàng đợi BullMQ) · lưu trữ đối tượng tương thích S3 (MinIO ở local) · Anthropic Claude (kiểm duyệt + tóm tắt AI) · Expo push.

### 2.1 Cấu hình toàn cục

- `ValidationPipe` toàn cục: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — từ chối field lạ, tự động transform DTO.
- `AllExceptionsFilter` toàn cục; `LoggingMiddleware` áp dụng cho mọi route.
- CORS qua biến môi trường `CORS_ORIGINS` (danh sách origin cách nhau bằng dấu phẩy, `credentials: true`).
- Không có module Swagger/OpenAPI nào được đăng ký.
- BullMQ (qua `REDIS_URL`) chạy 2 worker queue trong cùng tiến trình: `composite-score` (job tính lại điểm tổng hợp) và `photo-cleanup` (dọn ảnh mồ côi mỗi giờ, tự lên lịch).
- Các module được nối trong `AppModule`: Auth, User, Restaurant, Search, Review, Favorite, Media, Contribution, Moderation, Notification, Ai, Admin (+ các module hạ tầng Prisma/Redis/Health).

**Các biến môi trường chính** (`env.example`): `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`/`JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`, ID/secret của các nhà cung cấp OAuth (Google/Apple/Facebook), thông tin kết nối S3, `AI_SUMMARY_MIN_REVIEW_COUNT`/`AI_SUMMARY_REFRESH_INTERVAL_DAYS`, `ANTHROPIC_API_KEY` (nếu thiếu → kiểm duyệt văn bản chuyển sang dùng luật, ảnh luôn bị giữ lại để duyệt tay, không bao giờ tự sinh tóm tắt), `AI_MODERATION_MODEL`/`AI_MODERATION_TIMEOUT_MS`, `AI_SUMMARY_MODEL`.

### 2.2 Mô hình dữ liệu (`prisma/schema.prisma`)

- **Định danh & phân quyền**: `Role` ⟷ `Permission` (qua `RolePermission`); `User` (email, passwordHash?, các field oauth, status, lastLoginAt) có một `UserProfile`, nhiều `RefreshToken` (đã hash, có theo dõi luân chuyển), `PasswordResetToken`.
- **Lõi nhà hàng**: `Restaurant` (tên, slug, mô tả, category, priceRange, quan hệ 1:1 với `Address`/`Location` có geo-point PostGIS được đồng bộ bởi trigger DB, có thể soft-delete, có cột tsvector tìm kiếm tự sinh) + `RestaurantStatus` (1:1 — publicationStatus, compositeScore, reviewCount, lastReviewAt — cache đã chuẩn hoá mà mọi luồng đọc đều dùng). Ngoài ra còn có `RestaurantCuisine` (n:n), `Dish` (danh mục món ăn có chọn lọc, có từ khoá thay thế), `OpeningHour` (theo từng ngày trong tuần), `RestaurantFacility`, `Menu`→`MenuItem`.
- **Đánh giá & xếp hạng**: `Review` (điểm tổng thể, bình luận, món đã gọi, tổng hoá đơn, số người, thời gian chờ, có quay lại không, status, có thể soft-delete; một người dùng chỉ có một đánh giá "đang hoạt động" cho mỗi nhà hàng, được ép buộc bằng một unique index viết tay theo điều kiện) + `ReviewRating` (điểm theo từng tiêu chí) + `ReviewCriteria` (có thể giới hạn theo category).
- **Media**: `Photo` — chủ sở hữu đa hình (`ownerType`/`ownerId`, có thể null cho tới khi được gán chủ), storage key, `status` quyết định việc hiển thị công khai.
- **Kiểm duyệt & tin cậy**: `ModerationResult` (đối tượng đa hình, riskScore, labels, recommendedAction, decision, decidedBy/At — có ràng buộc CHECK ở DB cấm AI tự duyệt nội dung rủi ro cao) + `Report` (unique theo cặp người báo cáo + đối tượng).
- **Đóng góp**: `Contribution` (khung tổng quát: new_restaurant / edit_suggestion / status_update / closure_report, payload dạng JSON, status, liên kết ModerationResult) + `EditSuggestion` (dòng chi tiết 1:1 cho loại đóng góp chỉnh sửa).
- **Tóm tắt AI**: `AISummary` (1:1 theo từng nhà hàng — summaryText, pros/cons, sourceReviewCount, modelVersion).
- **Trạng thái tức thời**: `CrowdedStatus`/`SeatAvailability`/`PowerOutletStatus` (log chỉ-thêm, giá trị "hiện tại" được suy ra từ dòng mới nhất) + `ParkingInformation` (1:1, dùng upsert).
- **Yêu thích & thông báo**: `Favorite` (unique theo user+restaurant), `Notification` (payload có kiểu + deep-link, isRead), `PushToken` (theo từng thiết bị, token unique).
- **Hệ thống**: `AuditLog` (chỉ-thêm, ghi mọi thao tác của admin/moderator) + `SearchHistory` (chỉ-ghi, phục vụ cá nhân hoá trong tương lai).

### 2.3 Các module & endpoint

#### `auth` — base `/auth`, có `RateLimitGuard` (giới hạn kiểu sliding-window trên Redis, 5 lần/15 phút với các route nhạy cảm)

| Endpoint | Xác thực | Mục đích |
|---|---|---|
| `POST /auth/register` | công khai | Tạo user, cấp phiên đăng nhập |
| `POST /auth/login` | công khai | Đăng nhập email/mật khẩu, thông báo lỗi chung chung (không lộ email có tồn tại hay không) |
| `POST /auth/oauth/{google,apple,facebook}` | công khai | Xác minh token của nhà cung cấp, liên kết hoặc tạo mới tài khoản, cấp phiên |
| `POST /auth/refresh` | công khai | Xoay vòng refresh token (token mới được cấp trước khi token cũ bị thu hồi) |
| `POST /auth/logout` | công khai (theo body) | Thu hồi refresh token được truyền vào |
| `POST /auth/forgot-password` | công khai | Luôn trả về cùng một phản hồi; tạo token reset có hạn 30 phút; **việc gửi email chỉ là log giả lập, chưa nối với nhà cung cấp email thật** |
| `POST /auth/reset-password` | công khai | Dùng token, đặt mật khẩu mới, thu hồi toàn bộ refresh token |

Payload JWT: `{ sub, role, roleId }`. Việc kiểm tra quyền kết hợp `@Roles`/`RolesGuard` (thô) với `@RequirePermissions`/`PermissionsGuard` (chi tiết, cache trong bộ nhớ 60s ánh xạ roleId→mã quyền).

#### `user` — base `/me`, toàn bộ dùng `JwtAuthGuard`

`GET /me` (hồ sơ + URL avatar đã resolve) · `PATCH /me/profile` (cập nhật một phần, avatarPhotoId được kiểm tra là ảnh đã duyệt và thuộc sở hữu người dùng) · `DELETE /me` (xoá mềm, ẩn danh hoá — không bao giờ xoá cứng, giữ nguyên tính toàn vẹn của lịch sử đánh giá/đóng góp).

#### `restaurant` — base `/restaurants`, toàn bộ công khai

`GET /restaurants/nearby` (tìm theo bán kính bằng PostGIS, giới hạn 0.1–20km, tối đa 200 kết quả) · `GET /restaurants/bounds` (truy vấn theo khung nhìn bản đồ, cache Redis 45s) · `GET /restaurants/sitemap-index` (feed sitemap cho public-web) · `GET /restaurants/slug/:slug` · `GET /restaurants/:id` (chi tiết đầy đủ gồm giờ mở cửa/isOpenNow, tiện ích, thực đơn, ảnh, 5 đánh giá mới nhất) · `GET /restaurants/:id/ai-summary` (chỉ trả về khi có dòng `AISummary` còn mới và số đánh giá vẫn đạt ngưỡng tối thiểu).

Ghi chú: `isOpenNow` được tính theo giờ VN cố định UTC+7 (không tính DST), xử lý đúng trường hợp giờ mở cửa qua đêm. Cache khung nhìn bị vô hiệu hoá bằng một bộ đếm phiên bản toàn cục, tăng lên mỗi khi admin sửa nhà hàng.

#### `search` — `GET /search` (có `q`) và `GET /restaurants` (duyệt, không có `q`) dùng chung một cài đặt

Ứng viên tìm bằng full-text (`tsvector`) HOẶC độ tương đồng trigram theo tên HOẶC khớp tên/alias món ăn, xếp hạng theo `GREATEST(ts_rank_cd, similarity)`, sau đó đến compositeScore, khoảng cách, rồi độ mới. Bộ lọc: khoảng cách, khoảng giá, điểm tối thiểu, đang mở cửa, tiện ích (phải có TẤT CẢ), loại ẩm thực (có MỘT TRONG SỐ), category, quận/tỉnh/phường. `openNow`/`minRating` được lọc ở tầng JS sau khi lấy dữ liệu. Mỗi lần gọi đều ghi một dòng `SearchHistory` (chỉ-ghi).

#### `review` — ba controller: `/reviews`, `/restaurants/:restaurantId/reviews`, `/me/reviews`

`POST /reviews` (tạo mới hoặc cập nhật đánh giá "đang hoạt động" duy nhất của người dùng cho nhà hàng đó, giới hạn 10 lần/giờ) · `PATCH /reviews/:id` (chỉ chủ sở hữu; `editedAt` chỉ được đặt sau >48h kể từ khi tạo) · `DELETE /reviews/:id` (xoá mềm, kích hoạt tính lại điểm) · `GET /restaurants/:restaurantId/reviews` (công khai, phân trang, có phân tích điểm theo từng tiêu chí; `sort=has_photos`/`most_helpful` — riêng "most_helpful" hiện tự động rơi về sắp xếp theo mới nhất, chưa có mô hình bình chọn hữu ích) · `GET /me/reviews` (toàn bộ lịch sử của người dùng, mọi trạng thái).

**Điểm tổng hợp** (trung bình kiểu Bayesian, `composite-score.util.ts`): `(v/(v+m))·R + (m/(v+m))·C`, m=5, C=trung bình toàn hệ thống (mặc định 3.5 nếu chưa có dữ liệu). Được tính lại qua BullMQ mỗi khi có thay đổi đánh giá; luôn kiểm tra kích hoạt tóm tắt AI ngay sau đó.

**Kiểm duyệt**: kiểm tra rủi ro văn bản bằng Claude + một tín hiệu cấu trúc "đăng dồn dập" (≥5 đánh giá/giờ từ cùng một người dùng sẽ không bao giờ hạ mức quyết định "reject" của Claude). Mọi lỗi gọi Claude đều được chuyển thành `hold_for_review` (giữ lại để duyệt tay) như một cơ chế an toàn.

#### `favorite` — toàn bộ dùng `JwtAuthGuard`

`POST`/`DELETE /favorites/:restaurantId` (idempotent) · `GET /me/favorites` (phân trang) · `GET /me/favorites/ids` (danh sách id không phân trang, để client kiểm tra "đã yêu thích" tức thời).

#### `media` — base `/media`, toàn bộ dùng `JwtAuthGuard`

`POST /media/upload-url` (kiểm tra loại nội dung/kích thước, trả về URL S3 PUT có chữ ký trước, hạn 300s) · `POST /media/confirm` (kiểm tra kích thước bằng HEAD + dò byte đầu file + **mã hoá lại thành JPEG ở server**, không bao giờ tin content-type do client khai báo; áp giới hạn theo từng loại chủ sở hữu; **kiểm duyệt đồng bộ trước khi trả kết quả**) · `DELETE /media/:id` (chủ sở hữu hoặc admin/moderator).

`reparent()` gán lại chủ sở hữu cho các ảnh chưa gán một cách nguyên tử (giới hạn: review=6/restaurant=10/contribution=10/user_profile=1). `sweepOrphans()` xoá các ảnh chưa gán chủ quá 24h, chạy mỗi giờ.

#### `contribution` — toàn bộ dùng `JwtAuthGuard`, mọi vai trò `user`

`POST /restaurants/duplicate-check` · `POST /restaurants` (gửi nhà hàng mới, giới hạn 10 lần/giờ, trả 409 nếu có ứng viên trùng lặp chưa được xác nhận) · `POST /restaurants/:id/edit-suggestions` (chỉ các field nằm trong danh sách cho phép) · `POST /restaurants/:id/status-reports` (đông đúc/còn chỗ ngồi/còn ổ cắm/chỗ đậu xe/đổi giờ/đổi địa điểm/sai thông tin/đóng cửa) · `GET /me/contributions` · `GET /contributions/:id` (chỉ chủ sở hữu).

**Quy trình xử lý cuối**: `auto_approve` áp dụng hiệu ứng ngay lập tức (publish nhà hàng / vá field / thêm dòng trạng thái / upsert bãi đỗ xe); báo cáo đóng cửa **không bao giờ** được tự động áp dụng. **Quy tắc leo thang đóng cửa**: nếu có từ 3 người dùng khác nhau trở lên báo cáo đóng cửa cho cùng một nhà hàng trong vòng 14 ngày, báo cáo mới nhất sẽ bị đẩy vào duyệt tay bắt buộc (không bao giờ mở lại một mục đã được người thật quyết định, không bao giờ tự động ẩn nhà hàng).

#### `moderation` — cơ chế dùng chung + báo cáo từ người dùng

`POST /reports` (báo cáo một nhà hàng/đánh giá; unique theo cặp người báo cáo + đối tượng; đảm bảo mục đó xuất hiện trong hàng đợi kiểm duyệt). Hằng số dùng chung: `MEDIUM_RISK_THRESHOLD = 0.5` là nguồn chân lý duy nhất cho ranh giới `auto_approve`/`hold_for_review`, dùng chung cho cả đường Claude lẫn cơ chế dự phòng dựa trên luật không cần mạng (phát hiện URL, danh sách cụm từ spam, tỷ lệ chữ hoa, ký tự lặp — không bao giờ tự tạo ra "reject"). `assertDecisionAllowed` là bản song sinh ở tầng ứng dụng của ràng buộc CHECK trong DB: AI không bao giờ được tự duyệt nội dung rủi ro cao.

#### `notification` — toàn bộ dùng `JwtAuthGuard`

`GET /me/notifications` (phân trang + số chưa đọc) · `PATCH /me/notifications/:id/read` · `POST`/`DELETE /me/push-tokens[/:token]`.

Nguồn tạo thông báo thực tế duy nhất hiện nay là `AdminModerationService.decide()` (thông báo moderation_result/contribution_status). Gửi push (qua Expo SDK) theo kiểu best-effort — lỗi chỉ được ghi log, không bao giờ chặn việc ghi thông báo; các token báo `DeviceNotRegistered` sẽ tự động bị xoá.

#### `ai` — chỉ dùng nội bộ, không có controller riêng

`ClaudeGatewayService.moderate()` (claude-haiku-4-5, timeout 8s, JSON có cấu trúc, ảnh được gửi dạng base64 vision block; thiếu API key → chuyển sang luật cho văn bản, ảnh luôn bị giữ lại duyệt tay) và `.summarize()` (claude-opus-5, dùng tối đa 50 đánh giá có bình luận gần nhất, JSON có cấu trúc, không có cơ chế dự phòng theo chủ đích — nếu lỗi thì hiển thị trạng thái trung thực "chưa có tóm tắt", không bao giờ bịa nội dung). `AiSummaryService.regenerateIfNeeded()` được kích hoạt qua BullMQ trên luồng thay đổi đánh giá, chỉ tạo lại khi vừa vượt ngưỡng lần đầu và sau đó cứ mỗi N ngày, hoàn toàn an toàn khi lỗi (fail-safe).

#### `admin` — năm controller, dùng `JwtAuthGuard` + `RolesGuard`

- **Dashboard** (`admin`+`moderator`): `GET /admin/dashboard` — các chỉ số KPI + chuỗi hoạt động 30 ngày + phân bố điểm đánh giá.
- **Moderation** (`admin`+`moderator`, không giới hạn thêm): `GET /admin/moderation-queue`, `POST /admin/moderation-queue/:id/decision`, `PATCH /admin/reports/:id/resolve`.
- **Restaurant** (`admin`+`moderator`; xoá cứng **chỉ admin**): CRUD đầy đủ, ẩn/khôi phục, thay toàn bộ giờ mở cửa/tiện ích, CRUD thực đơn, gắn/xoá ảnh (URL do admin cung cấp, bỏ qua kiểm duyệt người dùng). Mọi thao tác sửa đều vô hiệu hoá cache khung nhìn và ghi `AuditLog`.
- **Review** (`admin`+`moderator` có thể xem danh sách; ẩn/khôi phục/xoá cứng **chỉ admin**): quản lý các đánh giá **đã publish**, khác với hàng đợi kiểm duyệt (chỉ xử lý quyết định trước khi publish).
- **User** (`admin`+`moderator` có thể xem danh sách/chi tiết; tạm khoá/mở khoá/đổi vai trò **chỉ admin**): tìm kiếm/lọc, tạm khoá, mở khoá, đổi vai trò. Quy tắc: admin không thể tự tạm khoá/đổi vai trò của chính mình; admin cuối cùng còn hoạt động trong hệ thống không thể bị tạm khoá/hạ cấp.

`AuditLogService.record()` được gọi tại mọi điểm admin thực hiện thao tác sửa đổi.

---

## 3. Admin Web (`admin-web/`)

**Công nghệ**: Vite + React + TypeScript, React Router, TanStack React Query, biểu đồ SVG tự viết tay (không dùng thư viện biểu đồ).

### 3.1 Kiến trúc

- **Xác thực**: không có endpoint đăng nhập admin riêng — dùng chung `POST /auth/login`, sau đó phía client tự từ chối (và bỏ token) với mọi vai trò ngoài `{admin, moderator}`. Phiên (`{accessToken, user}`) được lưu trong `localStorage` (token thời hạn ngắn 15 phút, được xem là công cụ nội bộ ít nhạy cảm); không có luồng refresh token — 401 chỉ đơn giản hiện ra như một lỗi thông thường.
- **Định tuyến**: `/login` công khai; mọi thứ khác nằm sau `ProtectedRoute` + `AppLayout` (khung sidebar/header). Các route: `/` (dashboard), `/restaurants`, `/restaurants/new`, `/restaurants/:id`, `/moderation`, `/reviews`, `/users`.
- **API client**: wrapper `fetch` mỏng, tự gắn bearer token, parse lỗi theo format của NestJS thành một `ApiError` có kiểu.
- **Kiểu phân quyền UI**: các thao tác nhạy cảm/phá huỷ giới hạn cho `admin` sẽ bị *vô hiệu hoá* (không ẩn đi) đối với `moderator`, kèm tooltip giải thích lý do.
- **Quy ước trang danh sách** (dùng chung cho cả 4 trang quản lý): ô tìm kiếm có debounce, các dropdown lọc reset về trang 1, React Query dùng `placeholderData: previous`, phân trang thủ công kiểu prev/next.

### 3.2 Các trang

| Trang | Route | Mục đích | API chính |
|---|---|---|---|
| **AdminLoginPage** | `/login` | Cổng đăng nhập chỉ dành cho admin/moderator | `POST /auth/login` |
| **AdminDashboardPage** | `/` | Các thẻ KPI (nhà hàng/đánh giá chờ duyệt, báo cáo mới, người dùng hoạt động), mỗi thẻ liên kết đến trang tương ứng đã lọc sẵn; biểu đồ hoạt động 7/30 ngày; biểu đồ phân bố điểm | `GET /admin/dashboard` |
| **AdminModerationQueuePage** | `/moderation` | Chia tab theo loại đối tượng (đánh giá/đóng góp/ảnh/video/nhà hàng bị báo cáo), lọc theo quyết định, panel xử lý mở rộng (bắt buộc nhập lý do trừ khi duyệt), xử lý báo cáo lồng trực tiếp | `GET /admin/moderation-queue`, `POST /admin/moderation-queue/:id/decision`, `PATCH /admin/reports/:id/resolve` |
| **AdminRestaurantManagementPage** | `/restaurants` | Tìm kiếm/lọc theo trạng thái/tỉnh/phường/quận cũ; ẩn/khôi phục/xoá cứng theo từng dòng (xoá cứng chỉ admin) | `GET /admin/restaurants`, `POST :id/hide`, `POST :id/restore`, `DELETE :id` |
| **AdminRestaurantEditPage** | `/restaurants/new`, `/restaurants/:id` | Tạo/sửa thông tin cốt lõi; 4 phần độc lập: giờ mở cửa (thay toàn bộ 7 dòng), tiện ích (thay toàn bộ), thực đơn (CRUD trực tiếp), ảnh (dựa trên URL, chưa có luồng upload) | `GET/POST/PATCH/DELETE /admin/restaurants[/:id]`, `PUT :id/opening-hours`, `PUT :id/facilities`, các endpoint thực đơn và ảnh |
| **AdminReviewManagementPage** | `/reviews` | Quản lý các đánh giá đã publish (khác với hàng đợi kiểm duyệt); tìm kiếm, lọc theo trạng thái/điểm rủi ro, lọc theo ngữ cảnh sâu (restaurantId/userId); ẩn/khôi phục/xoá chỉ admin, xoá cần **xác nhận hai lần** (hiếm gặp trong app) | `GET /admin/reviews`, `PATCH :id/hide`, `PATCH :id/restore`, `DELETE :id` |
| **AdminUserManagementPage** | `/users` | Tìm kiếm/lọc theo vai trò/trạng thái; panel chi tiết mở rộng (số đánh giá, số lần bị báo cáo); tạm khoá/mở khoá/đổi vai trò (chỉ admin, không áp dụng được cho chính mình) | `GET /admin/users[/:id]`, `PATCH :id/suspend`, `PATCH :id/reactivate`, `PATCH :id/role` |

### 3.3 Điểm chưa nhất quán đáng lưu ý

Trang Quản lý Nhà hàng chỉ giới hạn **xoá cứng** cho admin (ẩn/khôi phục thì moderator vẫn làm được), trong khi trang Quản lý Đánh giá giới hạn **cả ba** (ẩn/khôi phục/xoá) chỉ cho admin. Sự bất đối xứng này tồn tại ở cả phần phân quyền frontend lẫn override `@Roles` ở backend — đây là chủ ý trong thiết kế module backend (moderator toàn quyền với hàng đợi kiểm duyệt trước-khi-publish nhưng không có quyền gỡ bài sau-khi-publish), nhưng đáng để biết khi cân nhắc "moderator được làm những gì."

---

## 4. Mobile (`mobile/`) — "Ngon v3"

**Công nghệ**: Expo/React Native (SDK 57) · React Navigation (native-stack + bottom-tabs, thanh tab nổi tự viết) · TanStack React Query · Zustand · i18next · `react-native-maps` + clustering · API client `fetch` tự viết có cơ chế tự làm mới token.

### 4.1 Sơ đồ điều hướng

```
RootNavigator (render có điều kiện theo authStore.isAuthenticated, không điều hướng chủ động xuyên stack)
 ├─ Splash / Onboarding / PermissionLocation
 ├─ Auth → Login / Register / ForgotPassword
 └─ Main → MainStack
      ├─ MainTabs (thanh tab nổi kiểu Ngon v3)
      │    ├─ Home / Explore / Saved / Profile   (4 tab thực sự)
      │    └─ "Viết" (Write)                       (icon thứ 5, KHÔNG phải một route — xem bên dưới)
      ├─ Search { mode?; category? } · SearchResult { query?; mode?; category? } · Filter (modal)
      ├─ Map (được push, không phải tab)
      ├─ RestaurantDetail / PhotoGallery / Menu / Reviews / WriteReview (modal) { restaurantId }
      ├─ AddRestaurant (modal) / SelectLocation / UploadMedia / SubmissionStatus { contributionId }
      ├─ EditProfile / MyReviews / MyContributions / Notifications / Settings
      └─ ReportContent (modal) { targetType; targetId }
```

**Phím tắt "Viết" (Write)**: chỉ được `FloatingTabBar` render ra (không nằm trong `MainTabParamList`), điều hướng lên stack cha đến `SearchResult{mode:'writeReview'}`, tận dụng lại luồng tìm kiếm sẵn có làm bước "chọn một nhà hàng rồi đánh giá" — chạm vào một kết quả ở đó sẽ điều hướng đến `WriteReview` thay vì `RestaurantDetail`. `Map` đã được chuyển ra khỏi thanh tab, trở thành một màn hình được push trên stack (mở từ ô teaser bản đồ ở tab Explore).

Một `navigationRef` cấp cao nhất trong `App.tsx` (nằm trên `MainStack`) xử lý việc deep-link khi người dùng chạm vào thông báo push, có thể đi đến bất kỳ màn hình nào trong `MainStack`.

### 4.2 Các màn hình

**Root**: Splash (khôi phục trạng thái đăng nhập từ secure storage) · Onboarding (3 slide, chỉ hiện một lần, cờ lưu ở AsyncStorage, hình minh hoạ tạm bằng emoji) · PermissionLocation (xin quyền vị trí ở foreground, bấm Bỏ qua không bao giờ chặn vào app).

**Auth**: Login (email/mật khẩu + Google/Facebook/Apple) · Register (yêu cầu độ mạnh mật khẩu + checkbox điều khoản) · ForgotPassword (thời gian chờ gửi lại 60s). Tất cả đều dùng dữ liệu thật, có API thật.

**Main — các màn hình dùng dữ liệu thật**: SearchResult, FilterScreen, RestaurantDetail, PhotoGallery, Menu, ReviewsScreen, WriteReview, AddRestaurant (wizard 4 bước, chủ đích không thu thập giờ mở cửa/tiện ích/thực đơn trong luồng gửi — có thể thêm sau qua đề xuất chỉnh sửa), SubmissionStatus (polling mỗi 5s khi đang chờ xử lý), EditProfile, MyReviews, MyContributions, NotificationsScreen (phần danh sách/đánh dấu đã đọc/deep-link là thật; **hiện chưa có nguồn tạo thông báo thực tế** nào khác ngoài quyết định kiểm duyệt của admin), SettingsScreen, ReportContent.

**Main — các màn hình có phần đang là placeholder** (đều được ghi chú rõ ràng trong code, theo đúng nguyên tắc "không bịa số liệu về nội dung thật"):
- **HomeScreen** — nhãn thành phố là tĩnh (chưa có reverse-geocoding); mục tiêu trong banner gamification là số cố định (nhưng số đánh giá đã viết thực sự là thật); lưới hiển thị nhà hàng chứ không phải món ăn riêng lẻ (chưa có dữ liệu đánh giá theo món).
- **ExploreScreen** — hai tab "Xu hướng"/"Mới mở" hiện đang lấy đúng cùng dữ liệu "gần tôi" (chưa có cách sắp xếp riêng ở backend); bảng xếp hạng là thật (top-5 theo compositeScore) nhưng chưa thực sự giới hạn theo "tuần này."
- **SavedScreen** — phân chia "Muốn thử"/"Đã đi" chỉ là một cờ lưu **cục bộ** trên AsyncStorage (chưa có field tương ứng ở server); "Danh sách" (danh sách tuỳ chỉnh) chỉ là placeholder tĩnh "sắp ra mắt", backend chưa có khái niệm này.
- **ProfileScreen** — số đánh giá là thật; số ảnh/lượt thích hiển thị dấu `"—"` tĩnh (không bao giờ bịa số); mục tiêu huy hiệu là số cố định.
- **MapScreen** — khi bị từ chối quyền vị trí, phần "chọn khu vực thủ công" là danh sách cứng 3 khu vực ở TP.HCM, thay cho tìm kiếm địa lý thật.
- **RestaurantDetailScreen** — phần tóm tắt AI trung thực là chỉ-đọc (mobile không có nút kích hoạt tạo lại trực tiếp); luôn gắn nhãn "do AI tạo" khi hiển thị.
- **SearchScreen** — gợi ý gần đây/phổ biến chỉ là cục bộ (AsyncStorage + danh sách cứng), chưa có gọi mạng để gợi ý tự động thật sự.
- **SelectLocationScreen** — chưa nối nhà cung cấp geocoding nào; luôn hiển thị toạ độ thô, không bao giờ resolve ra địa chỉ đường phố (đã ghi chú là điểm sẽ thay thế trong tương lai khi có provider như Goong Maps).
- **UploadMediaScreen** — không phải một luồng độc lập thật sự; `PhotoUploadGrid` mới là thành phần dùng chung được nhúng vào AddRestaurant/WriteReview. Route này vẫn tồn tại nhưng hiện chưa có nơi nào điều hướng tới.

### 4.3 Quản lý state

| Store | Lưu trữ gì |
|---|---|
| `useAuthStore` | Trạng thái đăng nhập suy ra + DTO người dùng đã cache (token nằm ở `expo-secure-store`, không nằm trong store) |
| `useFilterStore` | Tiêu chí lọc tìm kiếm/duyệt dùng chung, giữ nguyên xuyên suốt Home/Explore/Map/Search/SearchResult/Filter (chỉ ở bộ nhớ, mất khi khởi động lại app) |
| `useAddRestaurantDraftStore` | Truyền tạm vị trí từ `SelectLocationScreen` sang `AddRestaurantScreen` |

Ngoài ra còn có state cục bộ lưu ở AsyncStorage nằm ngoài Zustand: preference theme, preference ngôn ngữ, cờ đã xem onboarding, lịch sử tìm kiếm gần đây, thẻ "đã đi" ở màn Saved.

### 4.4 API client, push, i18n

- **API client**: base URL lấy từ `API_BASE_URL` trong `app.config.ts`; mọi request đều gắn bearer token từ secure storage; khi gặp 401 sẽ tự động thử refresh (`POST /auth/refresh`) đúng một lần, gộp các lượt gọi đồng thời lại với nhau, rồi thử lại request gốc; nếu vẫn thất bại thì chuyển về trạng thái đăng xuất (không gọi điều hướng chủ động — `RootNavigator` tự xử lý qua render có điều kiện).
- **Push**: token push của Expo, đăng ký khi đăng nhập, huỷ đăng ký khi đăng xuất, có handler hiển thị banner+danh sách khi app đang mở. Khi chạm vào thông báo sẽ deep-link qua `navigationRef` cấp cao nhất. Việc gửi push thực tế **chưa thể kiểm chứng trong môi trường phát triển này** (không có thiết bị thật/thông tin xác thực APNs) — phần hạ tầng đã hoàn chỉnh và đúng theo hợp đồng API của Expo.
- **i18n**: `vi` (mặc định) / `en`, có cơ chế kiểm tra (chỉ ở chế độ dev) đảm bảo hai file ngôn ngữ có cùng bộ khoá, `LocaleContext` có cấu trúc tương tự `ThemeContext` (system/vi/en, lưu ở AsyncStorage, người dùng có thể đổi trong Cài đặt).

---

## 5. Danh sách các khoảng trống / placeholder trung thực

Danh sách tổng hợp mọi phần đã hoàn chỉnh về giao diện nhưng chưa (hoặc chưa hoàn toàn) có dữ liệu/khái niệm backend thật đứng sau — hữu ích làm đầu vào cho roadmap:

| Khu vực | Khoảng trống | Ở đâu |
|---|---|---|
| Gamification | Chưa có backend cho huy hiệu/thành tích; số mục tiêu là cố định | Banner ở Home, thanh huy hiệu ở Profile |
| Dữ liệu theo món | Chưa có tổng hợp điểm/lượt thích/giá theo từng món ăn | Lưới ở Home (hiện hiển thị nhà hàng thay vì món ăn) |
| Sắp xếp xu hướng/mới | Chưa có cách sắp xếp riêng ở backend cho "xu hướng" hay "mới mở" | Các tab ở ExploreScreen |
| Danh sách tuỳ chỉnh | Chưa có schema cho danh sách nhà hàng do người dùng đặt tên | Tab "Danh sách" ở SavedScreen |
| Thẻ đã đi | Chưa có cờ "đã đi" ở phía server trên Favorite | SavedScreen (chỉ lưu cục bộ ở AsyncStorage) |
| Thống kê Profile | Chưa có endpoint tổng hợp số ảnh/lượt thích | Hàng thống kê ở ProfileScreen |
| Reverse geocoding | Chưa có provider geocoding nào được cấu hình | Nhãn thành phố ở Home, SelectLocationScreen |
| Gợi ý tìm kiếm | Chưa có gọi mạng để gợi ý theo thời gian thực | SearchScreen (chỉ có lịch sử cục bộ + danh sách phổ biến cố định) |
| Đánh giá hữu ích | Chưa có mô hình bình chọn; sắp xếp "hữu ích nhất"/"có ảnh" rơi về mới nhất | ReviewsScreen, backend `GET /restaurants/:id/reviews` |
| Nguồn tạo thông báo | Chỉ quyết định kiểm duyệt/trạng thái đóng góp mới sinh thông báo | NotificationsScreen |
| Kiểm chứng gửi push | Chưa có thiết bị thật/thông tin xác thực APNs trong môi trường này | Luồng gửi push |
| Email đặt lại mật khẩu | Chỉ là log giả lập, chưa nối nhà cung cấp email thật | `POST /auth/forgot-password` |
| Upload ảnh ở admin | Ảnh nhà hàng trong admin dùng URL dán tay, chưa có luồng upload (khác với luồng upload có chữ ký thật dành cho người dùng) | Phần Ảnh ở AdminRestaurantEditPage |
| Báo cáo từng đánh giá | `ReportContentScreen` hỗ trợ báo cáo một đánh giá, nhưng chưa có điểm vào giao diện nào ở từng dòng đánh giá (mới chỉ có nút Báo cáo ở cấp nhà hàng, đã được nối lại trong đợt sửa lần này) | ReviewsScreen / ReviewCard |
| Public Web | Chưa bắt đầu — dự kiến Phase 1.5, sau khi mobile MVP xong | `docs/build-prompts/09-public-web.md` |

---

## 6. Các lỗi vừa được sửa (trong đợt rà soát này)

Hai lỗi lệch pha giữa giao diện và tính năng đã được phát hiện và sửa trong lúc soạn bản đặc tả này:

1. **Mất ngữ cảnh ở tab Viết**: phím tắt "Viết" trên thanh tab nổi mở `SearchResult{mode:'writeReview'}`, nhưng nút "Sửa tìm kiếm" ở đó lại điều hướng sang một màn hình `Search` bình thường và âm thầm làm mất `mode` (và `category`) khi gửi lại tìm kiếm — người dùng chỉnh lại từ khoá giữa chừng sẽ bị đưa về chế độ duyệt thông thường (chạm vào một kết quả sẽ mở trang nhà hàng thay vì form viết đánh giá) mà không có bất kỳ cảnh báo nào. Đã sửa bằng cách truyền `mode`/`category` xuyên suốt `Search` → `SearchResult` (`mobile/src/navigation/types.ts`, `SearchResultScreen.tsx`, `SearchScreen.tsx`).
2. **Nút báo cáo "chết"**: nút Báo cáo ở `RestaurantDetailScreen` chỉ hiện một thông báo "sắp ra mắt", dù `ReportContentScreen` (cùng endpoint thật `POST /reports`) đã được xây dựng đầy đủ từ trước — chỉ là chưa được nối vào đây. Đã sửa để điều hướng đến `ReportContent{targetType:'restaurant', targetId}`; đồng thời xoá phần chữ placeholder không còn dùng đến và import `Alert` không cần thiết.
