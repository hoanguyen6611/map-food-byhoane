# Mobile Screen Specifications — MVP

Each screen: Mục tiêu · UI chính · Hành động chính · Dữ liệu đầu vào · Kết quả đầu ra · Loading · Empty · Error · Validation · Điều hướng.

## 1. Splash Screen
- **Mục tiêu:** Khởi tạo app, kiểm tra session, preload config.
- **UI:** Logo, tên sản phẩm, background thương hiệu.
- **Hành động chính:** Không có tương tác người dùng (tự động).
- **Dữ liệu đầu vào:** Token lưu local (nếu có), flag đã onboarding hay chưa.
- **Kết quả đầu ra:** Điều hướng tới Onboarding (lần đầu), Home Map (đã đăng nhập + đã onboarding), hoặc Login (session hết hạn).
- **Loading:** Spinner thương hiệu tối đa 2s.
- **Empty/Error:** Nếu kiểm tra token lỗi mạng → vẫn vào app ở chế độ guest, không chặn người dùng.
- **Validation:** N/A.
- **Điều hướng:** → Onboarding / Home Map / Login.

## 2. Onboarding
- **Mục tiêu:** Giới thiệu giá trị cốt lõi (bản đồ ẩm thực, review có cấu trúc, AI gợi ý) trong tối đa 3 slide.
- **UI:** Carousel 3 slide, ảnh minh hoạ, nút "Bỏ qua"/"Tiếp theo"/"Bắt đầu".
- **Hành động chính:** Vuốt qua slide, bấm Bắt đầu.
- **Dữ liệu đầu vào:** Không.
- **Kết quả đầu ra:** Set flag `has_onboarded=true` local, chuyển Permission Location.
- **Loading/Empty/Error:** N/A (static content).
- **Validation:** N/A.
- **Điều hướng:** → Permission Location.

## 3. Permission Location
- **Mục tiêu:** Xin quyền vị trí với giải thích rõ lý do (tăng tỷ lệ chấp nhận).
- **UI:** Minh hoạ bản đồ, text giải thích, nút "Cho phép vị trí", "Để sau".
- **Hành động chính:** Cấp quyền hệ điều hành (native prompt), hoặc từ chối.
- **Dữ liệu đầu vào:** Không.
- **Kết quả đầu ra:** Permission granted/denied lưu trạng thái, chuyển Home Map.
- **Loading:** Trong lúc chờ native dialog phản hồi.
- **Error:** Nếu từ chối → banner ở Home Map cho phép bật lại qua Settings hệ điều hành hoặc chọn thành phố thủ công.
- **Validation:** N/A.
- **Điều hướng:** → Home Map.

## 4. Login
- **Mục tiêu:** Xác thực người dùng đã có tài khoản.
- **UI:** Input email, input password (ẩn/hiện), nút Đăng nhập, nút Google, nút Apple (iOS), link "Quên mật khẩu?", link "Đăng ký".
- **Hành động chính:** Submit form, đăng nhập OAuth.
- **Dữ liệu đầu vào:** Email, password.
- **Kết quả đầu ra:** Access + refresh token lưu secure storage, điều hướng Home Map (hoặc màn hình trước đó nếu vào từ auth-gate).
- **Loading:** Nút chuyển spinner, disable double-submit.
- **Empty:** N/A.
- **Error:** "Email hoặc mật khẩu không đúng" (thông báo chung, không tiết lộ email tồn tại hay không); lỗi mạng → toast + retry.
- **Validation:** Email đúng định dạng; password không rỗng.
- **Điều hướng:** → Register, → Forgot Password, → Home Map.

## 5. Register
- **Mục tiêu:** Tạo tài khoản mới.
- **UI:** Input tên hiển thị, email, password, confirm password, checkbox đồng ý điều khoản, nút Đăng ký.
- **Hành động chính:** Submit đăng ký.
- **Dữ liệu đầu vào:** Tên, email, password.
- **Kết quả đầu ra:** Tài khoản tạo, tự động đăng nhập, điều hướng Home Map.
- **Loading:** Spinner trên nút submit.
- **Error:** Email đã tồn tại; password yếu; mạng lỗi.
- **Validation:** Email hợp lệ; password ≥8 ký tự có số; confirm khớp; checkbox điều khoản bắt buộc.
- **Điều hướng:** → Login, → Home Map.

## 6. Forgot Password
- **Mục tiêu:** Khôi phục quyền truy cập qua email.
- **UI:** Input email, nút gửi liên kết.
- **Hành động chính:** Gửi yêu cầu reset.
- **Dữ liệu đầu vào:** Email.
- **Kết quả đầu ra:** Thông báo "Đã gửi email nếu tài khoản tồn tại" (tránh lộ thông tin), người dùng vào email đặt lại mật khẩu.
- **Loading:** Spinner khi gửi.
- **Error:** Email không đúng định dạng; giới hạn gửi lại (chống spam) sau 60s.
- **Validation:** Email hợp lệ.
- **Điều hướng:** → Login.

## 7. Home Map
- **Mục tiêu:** Khám phá quán ăn trực quan trên bản đồ quanh vị trí hiện tại.
- **UI:** Bản đồ full-screen, marker cluster, thanh search nổi phía trên, chip filter nhanh (Mở cửa, Giá, Đánh giá), nút định vị lại GPS, bottom sheet preview khi chọn marker, FAB "+" thêm quán, bottom tab bar.
- **Hành động chính:** Pan/zoom bản đồ, tap marker, tap search, tap filter, tap FAB.
- **Dữ liệu đầu vào:** Vị trí GPS, viewport bounds.
- **Kết quả đầu ra:** Danh sách marker trong viewport; bottom sheet preview quán được chọn.
- **Loading:** Skeleton marker cluster khi fetch lần đầu; shimmer nhỏ khi refetch theo viewport (không che toàn màn hình).
- **Empty:** "Không có quán nào trong khu vực này" + gợi ý mở rộng bán kính.
- **Error:** Mất mạng → banner "Không có kết nối", giữ dữ liệu cache cũ; GPS timeout → fallback thủ công.
- **Validation:** N/A.
- **Điều hướng:** → Search, → Restaurant Detail, → Add Restaurant, → Filter, tab khác.

## 8. Home List
- **Mục tiêu:** Xem quán quanh khu vực dạng danh sách, dễ so sánh nhanh hơn bản đồ.
- **UI:** Toggle Map/List trên cùng Home, danh sách Restaurant Card cuộn dọc, chip filter nhanh, sort dropdown.
- **Hành động chính:** Cuộn, tap card, đổi sort, tap filter.
- **Dữ liệu đầu vào:** Vị trí hiện tại, filter đang áp dụng.
- **Kết quả đầu ra:** Danh sách quán đã sắp xếp/lọc, phân trang.
- **Loading:** Skeleton card (5–6 placeholder) lần đầu; infinite-scroll spinner cuối danh sách.
- **Empty:** Cùng thông điệp như Home Map.
- **Error:** Toast lỗi + nút thử lại.
- **Validation:** N/A.
- **Điều hướng:** → Restaurant Detail, → Filter.

## 9. Search
- **Mục tiêu:** Nhập từ khoá tìm kiếm tự do (tên quán, món ăn, khu vực) hoặc câu tự nhiên.
- **UI:** Input search full-focus, danh sách tìm kiếm gần đây, gợi ý phổ biến, nút huỷ.
- **Hành động chính:** Gõ từ khoá, chọn gợi ý, submit.
- **Dữ liệu đầu vào:** Chuỗi truy vấn, lịch sử tìm kiếm cá nhân.
- **Kết quả đầu ra:** Điều hướng Search Result với query áp dụng.
- **Loading:** Debounce 300ms trước khi gợi ý auto-complete.
- **Empty:** Chưa có lịch sử → hiện gợi ý phổ biến mặc định (vd. "Bún bò", "Cà phê làm việc").
- **Error:** Lỗi mạng khi lấy gợi ý → im lặng fallback về lịch sử local.
- **Validation:** Query tối thiểu 2 ký tự để submit tìm kiếm dạng chính xác (câu hỏi tự nhiên dài hơn vẫn được chấp nhận).
- **Điều hướng:** → Search Result.

## 10. Search Result
- **Mục tiêu:** Hiển thị kết quả khớp với truy vấn/bộ lọc.
- **UI:** Danh sách Restaurant Card, badge số lượng kết quả, thanh filter tóm tắt, nút sửa tìm kiếm.
- **Hành động chính:** Tap card, mở Filter, thay đổi sort.
- **Dữ liệu đầu vào:** Query, filter, vị trí.
- **Kết quả đầu ra:** Danh sách quán khớp, phân trang.
- **Loading:** Skeleton card.
- **Empty:** "Không tìm thấy quán phù hợp" + gợi ý nới lỏng bộ lọc + quán gần đó thay thế.
- **Error:** Toast + retry.
- **Validation:** N/A.
- **Điều hướng:** → Restaurant Detail, → Filter, → Search (sửa lại).

## 11. Filter
- **Mục tiêu:** Tinh chỉnh kết quả theo tiêu chí cụ thể.
- **UI:** Bottom sheet full-height: khoảng cách (slider), mức giá (range VND), đánh giá tối thiểu, đang mở cửa (switch), tiện ích (chip đa chọn: wifi, ổ điện, chỗ đậu xe, máy lạnh...), loại quán/cuisine (chip đa chọn), nút "Xoá bộ lọc", nút "Áp dụng".
- **Hành động chính:** Chọn/điều chỉnh từng tiêu chí, áp dụng, xoá tất cả.
- **Dữ liệu đầu vào:** Trạng thái filter hiện tại (nếu quay lại).
- **Kết quả đầu ra:** Object filter được áp dụng cho Home/Search Result.
- **Loading:** N/A (client-side state, chỉ loading khi Áp dụng gọi API).
- **Empty:** N/A.
- **Error:** N/A.
- **Validation:** Giá min ≤ max; khoảng cách trong giới hạn cho phép (≤20km).
- **Điều hướng:** → quay lại màn hình gọi Filter với kết quả mới.

## 12. Restaurant Card (component, xuất hiện trong nhiều màn hình)
- **Mục tiêu:** Tóm tắt đủ thông tin để quyết định tap vào xem chi tiết.
- **UI:** Ảnh đại diện, tên quán, rating + số review, mức giá, khoảng cách, badge mở/đóng cửa, nút yêu thích nhanh.
- **Hành động chính:** Tap mở Detail, tap tim để favorite.
- **Dữ liệu đầu vào:** Restaurant object rút gọn từ API list.
- **Kết quả đầu ra:** Điều hướng Detail hoặc toggle favorite optimistic.
- **Loading:** Skeleton card khi ảnh chưa tải (blur placeholder).
- **Empty:** Ảnh mặc định thương hiệu nếu quán chưa có ảnh.
- **Error:** Ảnh lỗi tải → fallback placeholder, không chặn hiển thị thông tin khác.
- **Validation:** N/A.
- **Điều hướng:** → Restaurant Detail.

## 13. Restaurant Detail
- **Mục tiêu:** Cung cấp toàn bộ thông tin cần thiết để quyết định đến quán.
- **UI:** Ảnh bìa/carousel, tên, loại quán, rating tổng + breakdown theo tiêu chí, khoảng cách, badge mở/đóng cửa, địa chỉ + mini-map, giờ mở cửa, số điện thoại (gọi nhanh), tiện ích (icon), AI Summary card (có nhãn "Tóm tắt bởi AI"), preview Menu (xem thêm), preview Reviews (xem thêm), nút Yêu thích, nút Chỉ đường, nút Viết đánh giá, nút Báo cáo.
- **Hành động chính:** Xem ảnh, gọi điện, chỉ đường, favorite, viết review, mở menu/gallery/reviews đầy đủ, report.
- **Dữ liệu đầu vào:** `restaurantId`.
- **Kết quả đầu ra:** Điều hướng tới các sub-screen liên quan.
- **Loading:** Skeleton toàn trang (header + section placeholders).
- **Empty:** Từng phần có empty state riêng — chưa có menu ("Chưa cập nhật thực đơn — Đóng góp ngay"), chưa có review ("Chưa có đánh giá — Hãy là người đầu tiên"), chưa có AI summary (dưới ngưỡng review tối thiểu).
- **Error:** Quán không tồn tại/đã ẩn → "Địa điểm này không còn khả dụng" + gợi ý quán tương tự gần đó.
- **Validation:** N/A (read screen).
- **Điều hướng:** → Photo Gallery, → Menu, → Reviews, → Write Review, → Report Content, ứng dụng bản đồ ngoài.

## 14. Photo Gallery
- **Mục tiêu:** Xem toàn bộ ảnh/video thật của quán theo lưới hoặc toàn màn hình.
- **UI:** Grid ảnh, phân loại tab (Tất cả/Món ăn/Không gian/Từ review), viewer toàn màn hình vuốt ngang, chỉ nguồn ảnh (admin/user).
- **Hành động chính:** Tap ảnh mở fullscreen, vuốt chuyển ảnh, zoom.
- **Dữ liệu đầu vào:** `restaurantId`.
- **Kết quả đầu ra:** Trải nghiệm xem ảnh, không thay đổi dữ liệu.
- **Loading:** Skeleton grid, progressive image loading + blur-up.
- **Empty:** "Chưa có ảnh, hãy là người đóng góp đầu tiên" + CTA thêm ảnh (qua review).
- **Error:** Ảnh lỗi → placeholder giữ vị trí trong lưới.
- **Validation:** N/A.
- **Điều hướng:** ← Restaurant Detail.

## 15. Menu
- **Mục tiêu:** Xem thực đơn đầy đủ với giá thật.
- **UI:** Danh sách món theo nhóm (Khai vị, Món chính, Đồ uống...), tên món, giá, ảnh món (nếu có), badge "Món được gọi nhiều".
- **Hành động chính:** Cuộn xem, tap món xem ảnh phóng to.
- **Dữ liệu đầu vào:** `restaurantId`.
- **Kết quả đầu ra:** Xem thông tin, không thay đổi dữ liệu.
- **Loading:** Skeleton list.
- **Empty:** "Chưa có thực đơn chi tiết" + CTA đóng góp menu.
- **Error:** Toast lỗi tải + retry.
- **Validation:** N/A.
- **Điều hướng:** ← Restaurant Detail.

## 16. Reviews
- **Mục tiêu:** Xem toàn bộ đánh giá với bộ lọc/sắp xếp.
- **UI:** Tổng quan rating breakdown theo tiêu chí ở đầu, filter (mới nhất/hữu ích nhất/có ảnh), danh sách review card (avatar, tên, rating, ngày, món đã gọi, bill, ảnh, nội dung, nút hữu ích, nút báo cáo), nút "Viết đánh giá" nổi.
- **Hành động chính:** Lọc/sắp xếp, tap ảnh trong review, đánh dấu hữu ích, report, viết review mới.
- **Dữ liệu đầu vào:** `restaurantId`, filter/sort.
- **Kết quả đầu ra:** Danh sách review phân trang.
- **Loading:** Skeleton review card.
- **Empty:** "Chưa có đánh giá nào" + CTA viết đầu tiên.
- **Error:** Toast + retry.
- **Validation:** N/A.
- **Điều hướng:** → Write Review, → Report Content.

## 17. Write Review
- **Mục tiêu:** Thu thập đánh giá có cấu trúc, đáng tin cậy.
- **UI:** Rating tổng (bắt buộc), rating theo từng tiêu chí (chất lượng, không gian, giá, phục vụ, vệ sinh, wifi, chỗ đậu xe — có thể bỏ qua tiêu chí không áp dụng), input món đã gọi (tag input), input tổng hoá đơn (VND), input số người, thời gian ghé (date/time picker), textarea nhận xét, upload ảnh (tối đa 6), toggle "Có quay lại không", nút Gửi.
- **Hành động chính:** Chọn rating, nhập thông tin, upload ảnh, gửi.
- **Dữ liệu đầu vào:** `restaurantId`, dữ liệu form.
- **Kết quả đầu ra:** Review tạo/cập nhật với status pipeline; điều hướng về Reviews hoặc Detail với banner "Đang chờ duyệt"/"Đã đăng".
- **Loading:** Spinner nút Gửi, disable double-submit; upload ảnh có progress riêng.
- **Empty:** N/A.
- **Error:** Đã đánh giá quán này trong 24h → chặn với thông báo; mất mạng khi gửi → giữ nháp local, cho phép thử lại.
- **Validation:** Rating tổng bắt buộc (1–5); ≥1 tiêu chí; bill total ≥0 và <50,000,000; nhận xét ≤2000 ký tự; tối đa 6 ảnh.
- **Điều hướng:** → Upload Media (inline), → Submission Status / quay lại Reviews.

## 18. Add Restaurant
- **Mục tiêu:** Đóng góp quán mới lên bản đồ.
- **UI:** Stepper 4 bước (Vị trí → Thông tin → Ảnh → Xác nhận), input tên, chọn loại quán/cuisine, chọn mức giá, input giờ mở cửa theo ngày, input số điện thoại (tuỳ chọn), chọn tiện ích, thêm menu cơ bản (tuỳ chọn), nút Gửi.
- **Hành động chính:** Điền form theo từng bước, gửi.
- **Dữ liệu đầu vào:** Dữ liệu form + vị trí từ Select Location + ảnh từ Upload Media.
- **Kết quả đầu ra:** Restaurant tạo với status `pending`, điều hướng Submission Status.
- **Loading:** Spinner khi submit; kiểm tra trùng lặp hiển thị loading nhỏ.
- **Empty:** N/A.
- **Error:** Trùng lặp phát hiện → cảnh báo có thể bỏ qua; thiếu trường bắt buộc → chặn bước tiếp; mất mạng → giữ nháp local.
- **Validation:** Tên 2–120 ký tự; vị trí resolve được địa chỉ VN hợp lệ; ≥1 ảnh; giờ mở cửa hợp lệ (giờ đóng có thể qua nửa đêm).
- **Điều hướng:** → Select Location, → Upload Media, → Submission Status.

## 19. Select Location
- **Mục tiêu:** Xác định chính xác toạ độ quán trên bản đồ.
- **UI:** Bản đồ với pin cố định ở tâm màn hình, ô tìm kiếm địa chỉ, nút "Dùng vị trí GPS hiện tại", card hiển thị địa chỉ reverse-geocode.
- **Hành động chính:** Kéo bản đồ để di chuyển pin, tìm địa chỉ, dùng GPS, xác nhận.
- **Dữ liệu đầu vào:** GPS hiện tại, chuỗi tìm kiếm địa chỉ.
- **Kết quả đầu ra:** Toạ độ + địa chỉ cấu trúc (tỉnh/quận/phường) trả về Add Restaurant.
- **Loading:** Spinner khi reverse-geocode.
- **Empty:** Không tìm thấy địa chỉ → cho phép giữ toạ độ thô, cảnh báo địa chỉ có thể chưa chính xác.
- **Error:** Lỗi geocoding service → cho phép nhập địa chỉ thủ công.
- **Validation:** Toạ độ phải nằm trong lãnh thổ Việt Nam (kiểm tra bounding box).
- **Điều hướng:** ← Add Restaurant (trả kết quả).

## 20. Upload Media
- **Mục tiêu:** Component dùng chung cho chụp/chọn/nén/tải ảnh lên ở Write Review và Add Restaurant.
- **UI:** Lưới thumbnail đã chọn, nút "Chụp ảnh", nút "Chọn từ thư viện", progress bar từng ảnh, nút xoá từng ảnh.
- **Hành động chính:** Chụp, chọn, xoá, xem lại trước khi gửi.
- **Dữ liệu đầu vào:** Ảnh từ camera/thư viện thiết bị.
- **Kết quả đầu ra:** Danh sách media reference đính kèm vào entity cha (review/restaurant).
- **Loading:** Progress % từng ảnh, trạng thái "Đang nén" → "Đang tải lên" → "Hoàn tất".
- **Empty:** "Chưa có ảnh nào được thêm".
- **Error:** File quá 8MB → chặn trước khi nén; loại file không hỗ trợ → chặn ngay khi chọn; upload thất bại → nút thử lại từng ảnh.
- **Validation:** MIME type jpeg/png/webp; tối đa 6 (review) hoặc 10 (restaurant) ảnh.
- **Điều hướng:** Là component nhúng, không có màn hình riêng biệt.

## 21. Submission Status
- **Mục tiêu:** Cho người dùng biết trạng thái đóng góp của họ (quán mới, chỉnh sửa, review).
- **UI:** Timeline trạng thái (Đã gửi → Đang xử lý AI → Đang chờ duyệt/Đã duyệt/Bị từ chối), lý do (nếu bị từ chối/yêu cầu chỉnh sửa), nút chỉnh sửa & gửi lại (nếu áp dụng).
- **Hành động chính:** Xem trạng thái, chỉnh sửa & gửi lại.
- **Dữ liệu đầu vào:** `contributionId`.
- **Kết quả đầu ra:** N/A (read) hoặc điều hướng form chỉnh sửa.
- **Loading:** Skeleton timeline.
- **Empty:** N/A (luôn có ít nhất 1 trạng thái).
- **Error:** Không tìm thấy đóng góp → thông báo lỗi + quay lại My Contributions.
- **Validation:** N/A.
- **Điều hướng:** → form chỉnh sửa tương ứng, ← Profile/My Contributions.

## 22. Favorites
- **Mục tiêu:** Xem danh sách quán đã lưu.
- **UI:** Danh sách Restaurant Card, nút bỏ lưu nhanh, sort (gần đây thêm/gần vị trí hiện tại).
- **Hành động chính:** Tap card, bỏ lưu.
- **Dữ liệu đầu vào:** User hiện tại.
- **Kết quả đầu ra:** Danh sách quán yêu thích.
- **Loading:** Skeleton card.
- **Empty:** "Bạn chưa lưu quán nào — Khám phá ngay" + CTA về Home Map.
- **Error:** Toast + retry.
- **Validation:** N/A.
- **Điều hướng:** → Restaurant Detail.

## 23. User Profile
- **Mục tiêu:** Trung tâm quản lý cá nhân.
- **UI:** Avatar, tên, thống kê nhỏ (số review, số đóng góp, số yêu thích), menu điều hướng (Yêu thích, Đóng góp của tôi, Thông báo, Cài đặt).
- **Hành động chính:** Tap từng mục menu, tap avatar để sửa hồ sơ.
- **Dữ liệu đầu vào:** User hiện tại.
- **Kết quả đầu ra:** Điều hướng tương ứng.
- **Loading:** Skeleton header.
- **Empty:** N/A.
- **Error:** Lỗi tải thống kê → hiện "--" thay vì chặn màn hình.
- **Validation:** N/A.
- **Điều hướng:** → Edit Profile, → Favorites, → My Contributions, → Notifications, → Settings.

## 24. Edit Profile
- **Mục tiêu:** Cập nhật thông tin cá nhân cơ bản.
- **UI:** Input tên hiển thị, avatar picker, input số điện thoại, input giới thiệu ngắn (bio, tuỳ chọn), nút Lưu.
- **Hành động chính:** Sửa & lưu.
- **Dữ liệu đầu vào:** Dữ liệu profile hiện tại.
- **Kết quả đầu ra:** Profile cập nhật.
- **Loading:** Spinner nút Lưu.
- **Empty:** N/A.
- **Error:** Số điện thoại sai định dạng; lỗi mạng khi lưu.
- **Validation:** Tên 2–50 ký tự; phone định dạng VN nếu nhập.
- **Điều hướng:** ← Profile.

## 25. Notifications
- **Mục tiêu:** Thông báo kết quả xử lý nội dung và hệ thống (không có marketing push ở MVP).
- **UI:** Danh sách thông báo (icon loại, nội dung, thời gian), đánh dấu đã đọc, swipe để xoá.
- **Hành động chính:** Tap thông báo mở màn hình liên quan (Submission Status, Reviews...), đánh dấu đã đọc.
- **Dữ liệu đầu vào:** User hiện tại.
- **Kết quả đầu ra:** Điều hướng theo loại thông báo.
- **Loading:** Skeleton list.
- **Empty:** "Không có thông báo nào".
- **Error:** Toast + retry.
- **Validation:** N/A.
- **Điều hướng:** → Submission Status / Reviews / Restaurant Detail tuỳ loại.

## 26. Settings
- **Mục tiêu:** Cấu hình ứng dụng và tài khoản.
- **UI:** Toggle Dark mode, ngôn ngữ (chỉ Tiếng Việt ở MVP, hiển thị sẵn cho tương lai), link Chính sách quyền riêng tư, link Điều khoản, nút Đổi mật khẩu, nút Xoá tài khoản, nút Đăng xuất, phiên bản app.
- **Hành động chính:** Toggle theme, đăng xuất, xoá tài khoản.
- **Dữ liệu đầu vào:** N/A.
- **Kết quả đầu ra:** Thay đổi theme lưu local; đăng xuất xoá token; xoá tài khoản kích hoạt flow xác nhận.
- **Loading:** Spinner khi xử lý xoá tài khoản.
- **Empty:** N/A.
- **Error:** Lỗi khi đăng xuất (hiếm) → vẫn xoá token local, điều hướng Login.
- **Validation:** Xoá tài khoản yêu cầu xác nhận 2 bước (nhập "XOÁ" hoặc tương đương).
- **Điều hướng:** → Login (sau đăng xuất/xoá tài khoản).

## 27. Report Content
- **Mục tiêu:** Cho phép báo cáo quán/review vi phạm hoặc sai lệch.
- **UI:** Danh sách lý do (spam, sai thông tin, xúc phạm, trùng lặp, quán đã đóng cửa, khác), textarea mô tả thêm (tuỳ chọn), nút Gửi báo cáo.
- **Hành động chính:** Chọn lý do, gửi.
- **Dữ liệu đầu vào:** `targetType` (restaurant/review), `targetId`.
- **Kết quả đầu ra:** `Report` tạo mới, vào hàng đợi moderator.
- **Loading:** Spinner nút Gửi.
- **Empty:** N/A.
- **Error:** Đã báo cáo nội dung này rồi → chặn báo cáo trùng, hiện thông báo.
- **Validation:** Phải chọn 1 lý do.
- **Điều hướng:** ← màn hình gốc (Detail/Reviews) sau khi gửi, kèm toast xác nhận.

---

## Admin Portal (Web) — MVP

## 28. Admin Login
- **Mục tiêu:** Xác thực quản trị viên/moderator, tách biệt với auth người dùng thường.
- **UI:** Input email, password, nút Đăng nhập.
- **Hành động chính:** Submit.
- **Dữ liệu đầu vào:** Credentials.
- **Kết quả đầu ra:** Session admin, điều hướng Dashboard.
- **Loading:** Spinner nút.
- **Error:** Sai thông tin; rate-limit sau nhiều lần sai.
- **Validation:** Email + password bắt buộc.
- **Điều hướng:** → Admin Dashboard.

## 29. Admin Dashboard
- **Mục tiêu:** Tổng quan vận hành — số lượng chờ xử lý, hoạt động gần đây.
- **UI:** KPI cards (quán chờ duyệt, review chờ duyệt, báo cáo mới, người dùng hoạt động), biểu đồ hoạt động 7/30 ngày, shortcut tới các module quản lý.
- **Hành động chính:** Tap KPI card để nhảy tới hàng đợi tương ứng.
- **Dữ liệu đầu vào:** Aggregated stats.
- **Kết quả đầu ra:** Điều hướng module tương ứng.
- **Loading:** Skeleton KPI cards.
- **Empty:** "Không có mục nào cần xử lý — mọi thứ đã được duyệt".
- **Error:** Toast + retry.
- **Validation:** N/A.
- **Điều hướng:** → tất cả module quản trị.

## 30. Admin Restaurant Management
- **Mục tiêu:** CRUD toàn quyền với dữ liệu quán ăn — dùng để seed và bảo trì dữ liệu.
- **UI:** Bảng danh sách quán (tìm kiếm, lọc theo trạng thái/khu vực), form chi tiết (thông tin, địa chỉ, giờ mở cửa, tiện ích, menu, ảnh, video), nút Ẩn/Xoá/Khôi phục.
- **Hành động chính:** Thêm/sửa/ẩn/xoá quán, quản lý menu và media.
- **Dữ liệu đầu vào:** Form dữ liệu quán.
- **Kết quả đầu ra:** Restaurant/Menu/Photo cập nhật, ghi AuditLog.
- **Loading:** Skeleton bảng + spinner khi lưu.
- **Empty:** "Chưa có quán nào — Thêm quán đầu tiên".
- **Error:** Validation lỗi hiển thị inline; lỗi lưu → toast + giữ nguyên form.
- **Validation:** Giống Add Restaurant phía người dùng, cộng thêm khả năng ghi đè trạng thái trực tiếp.
- **Điều hướng:** → Admin Moderation Queue (nếu quán đang pending).

## 31. Admin Moderation Queue
- **Mục tiêu:** Trung tâm xử lý nội dung chờ duyệt (quán mới, chỉnh sửa, review, ảnh).
- **UI:** Danh sách hàng đợi (tab theo loại nội dung), mỗi item hiện nội dung, điểm rủi ro AI, lý do AI, lịch sử báo cáo liên quan; panel chi tiết với nút Duyệt/Từ chối/Yêu cầu chỉnh sửa + ô nhập lý do.
- **Hành động chính:** Duyệt, từ chối, yêu cầu chỉnh sửa.
- **Dữ liệu đầu vào:** Danh sách `ModerationResult` pending.
- **Kết quả đầu ra:** Cập nhật trạng thái nội dung, gửi notification cho người đóng góp, ghi AuditLog.
- **Loading:** Skeleton list + spinner khi xử lý quyết định.
- **Empty:** "Hàng đợi trống — Không có nội dung cần duyệt".
- **Error:** Toast + giữ item trong queue nếu xử lý thất bại.
- **Validation:** Từ chối/yêu cầu chỉnh sửa bắt buộc nhập lý do.
- **Điều hướng:** → Admin Restaurant Management / Admin Review Management (item liên quan).

## 32. Admin Review Management
- **Mục tiêu:** Quản lý toàn bộ review đã đăng — xử lý báo cáo, gỡ nội dung vi phạm phát hiện sau khi đã publish.
- **UI:** Bảng review (lọc theo quán/người dùng/trạng thái/điểm rủi ro), xem chi tiết, nút Ẩn/Khôi phục/Xoá vĩnh viễn (chỉ admin).
- **Hành động chính:** Ẩn, khôi phục, xoá.
- **Dữ liệu đầu vào:** Danh sách review.
- **Kết quả đầu ra:** Cập nhật trạng thái review, ghi AuditLog.
- **Loading:** Skeleton bảng.
- **Empty:** "Không có review nào khớp bộ lọc".
- **Error:** Toast + retry.
- **Validation:** Xoá vĩnh viễn yêu cầu xác nhận 2 bước.
- **Điều hướng:** → Admin Moderation Queue.

## 33. Admin User Management
- **Mục tiêu:** Quản lý tài khoản người dùng — vai trò, trạng thái, xử lý vi phạm.
- **UI:** Bảng người dùng (tìm kiếm theo email/tên), chi tiết hoạt động (số review, số báo cáo bị nhận), nút Tạm khoá/Mở khoá/Đổi vai trò (chỉ admin).
- **Hành động chính:** Suspend/unban, đổi role (chỉ role `admin` được đổi role — theo Business Rule ở PRD §10.11).
- **Dữ liệu đầu vào:** Danh sách user.
- **Kết quả đầu ra:** Cập nhật `User.status`/`Role`, ghi AuditLog.
- **Loading:** Skeleton bảng.
- **Empty:** N/A (luôn có ít nhất user admin).
- **Error:** Toast + retry; moderator cố đổi role → 403 hiển thị rõ ràng.
- **Validation:** Không thể tự khoá chính mình; không thể xoá admin cuối cùng của hệ thống.
- **Điều hướng:** N/A (màn hình cuối trong luồng quản trị người dùng).
