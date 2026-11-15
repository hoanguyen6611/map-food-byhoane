// Admin-editable site settings ("Nội dung & Cài đặt" in admin-web).
// Stored in the backend's `site_settings` table (one JSON row per key);
// these defaults apply until an admin saves a value, and are the single
// source of the About page's copy for both web and admin.

export interface FooterSettings {
  /** Full URLs; empty = icon shown as "Sắp ra mắt" (not a link). */
  social: { facebook: string; instagram: string; tiktok: string };
  /** Internal path ("/terms"), full URL or mailto:; empty = link hidden. */
  links: { contact: string; terms: string; privacy: string; communityGuidelines: string };
}

export interface ScoringSettings {
  /** "m" in the Bayesian composite score — reviews before a restaurant's own average dominates. */
  minVotesThreshold: number;
}

export type GamificationBadgeCode = 'contributor_10' | 'coffee_hunter' | 'helpful_100';

export interface GamificationSettings {
  pointsPerReview: number;
  pointsPerContribution: number;
  pointsPerHelpfulVote: number;
  /** Level i+1 starts at levelThresholds[i]; always 5 entries, first is 0, strictly increasing. */
  levelThresholds: number[];
  badgeThresholds: Record<GamificationBadgeCode, number>;
}

/** Same shape as the About page's copy (formerly the web app's `about` i18n namespace). */
export type AboutContent = typeof DEFAULT_ABOUT_CONTENT_VI;

export interface SiteSettingsDto {
  footer: FooterSettings;
  scoring: ScoringSettings;
  gamification: GamificationSettings;
  about: { vi: AboutContent; en: AboutContent };
}

export type SiteSettingKey = keyof SiteSettingsDto;

export const SITE_SETTING_KEYS: readonly SiteSettingKey[] = ['footer', 'scoring', 'gamification', 'about'];

export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  social: { facebook: '', instagram: '', tiktok: '' },
  links: { contact: '', terms: '', privacy: '', communityGuidelines: '' },
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = { minVotesThreshold: 5 };

export const DEFAULT_GAMIFICATION_SETTINGS: GamificationSettings = {
  pointsPerReview: 10,
  pointsPerContribution: 15,
  pointsPerHelpfulVote: 2,
  levelThresholds: [0, 100, 250, 500, 1000],
  badgeThresholds: { contributor_10: 10, coffee_hunter: 10, helpful_100: 100 },
};

export const DEFAULT_ABOUT_CONTENT_VI = {
  "pageTitle": "Cách chấm điểm",
  "footerHeading": "Về chúng tôi",
  "navEyebrow": "Nội dung",
  "nav": {
    "cach-cham-diem": "Cách chấm điểm",
    "tieu-chi": "7 tiêu chí",
    "kiem-duyet": "Kiểm duyệt đánh giá",
    "du-lieu": "Nguồn dữ liệu",
    "cap-do-thanh-vien": "Cấp độ thành viên"
  },
  "score": {
    "title": "Điểm của một quán được tính thế nào",
    "body": "Điểm hiển thị trên trang quán không phải trung bình cộng đơn giản của mọi đánh giá. Hệ thống dùng công thức trung bình có điều chỉnh: quán càng có nhiều đánh giá thì điểm càng phản ánh sát trải nghiệm thật; quán mới chỉ có 1-2 đánh giá sẽ được kéo gần về mức trung bình chung của toàn hệ thống, để vài đánh giá đầu tiên (có thể quá khắt khe hoặc quá dễ dãi) không đẩy điểm lên hoặc xuống quá đà.",
    "factRestaurants": "Quán trong hệ thống",
    "factThreshold": "Đánh giá để điểm bắt đầu ổn định",
    "factCriteria": "Tiêu chí có thể chấm thêm",
    "calloutTitle": "Vì sao không chỉ lấy trung bình cộng",
    "calloutBody": "Một quán vừa mở, được vài người quen ghé chấm 5 sao, không nên nghiễm nhiên đứng đầu bảng xếp hạng ngay. Công thức này giúp điểm số đáng tin hơn khi quán còn ít đánh giá, và dần phản ánh đúng trải nghiệm thật khi có nhiều người đánh giá hơn."
  },
  "axes": {
    "title": "7 tiêu chí đánh giá",
    "body": "Ngoài điểm tổng thể, người đánh giá có thể chấm thêm theo 7 tiêu chí riêng — hiển thị dưới dạng biểu đồ trên trang quán để bạn biết quán mạnh/yếu ở đâu. Các tiêu chí này không được tính vào điểm tổng ở đầu trang — điểm tổng chỉ đến từ đánh giá tổng thể. Người đánh giá có thể bỏ qua tiêu chí không dùng tới.",
    "items": {
      "food_quality": {
        "label": "Chất lượng món ăn",
        "note": "Vị, độ tươi, độ ổn định giữa các lần ghé."
      },
      "space": {
        "label": "Không gian",
        "note": "Độ ồn, chỗ ngồi, ánh sáng, độ thoáng."
      },
      "price": {
        "label": "Giá cả",
        "note": "Tương quan giữa giá và phần ăn nhận được."
      },
      "service": {
        "label": "Phục vụ",
        "note": "Thái độ, tốc độ ra món, xử lý khi sai order."
      },
      "hygiene": {
        "label": "Vệ sinh",
        "note": "Bàn ghế, chén đũa, khu chế biến nhìn thấy được."
      },
      "wifi": {
        "label": "Wifi",
        "note": "Chỉ áp dụng khi quán có wifi."
      },
      "parking": {
        "label": "Chỗ để xe",
        "note": "Có chỗ, có người trông, mất phí hay không."
      }
    }
  },
  "moderation": {
    "title": "Đánh giá được kiểm duyệt ra sao",
    "body": "Mục tiêu là giữ đánh giá thật, không phải giữ điểm đẹp cho quán.",
    "steps": {
      "1": {
        "title": "Chỉ người đã đăng nhập",
        "body": "Mỗi tài khoản chỉ đánh giá lại cùng một quán sau tối thiểu 24 giờ kể từ lần gần nhất, để hạn chế spam."
      },
      "2": {
        "title": "Lọc tự động",
        "body": "Hệ thống chấm điểm rủi ro cho từng đánh giá (link quảng cáo, cụm từ spam, đăng dồn dập…) — đánh giá rủi ro cao được giữ lại để người kiểm duyệt xem trước khi hiển thị công khai."
      },
      "3": {
        "title": "Cộng đồng báo cáo",
        "body": "Người dùng có thể báo cáo đánh giá hoặc thông tin quán sai lệch; đội kiểm duyệt xem xét và quyết định."
      }
    }
  },
  "data": {
    "title": "Dữ liệu đến từ đâu",
    "body": "Thông tin quán do cộng đồng đóng góp và cập nhật liên tục. Giờ mở cửa, số điện thoại và tiện ích có thể thay đổi — nếu bạn thấy sai, gửi cập nhật ngay trên trang quán qua ứng dụng di động.",
    "sourcesTitle": "Hai nguồn chính",
    "source1Name": "Người dùng app",
    "source1Body": "điểm số, ảnh, nhận xét, và báo cáo thay đổi (giờ mở cửa, đã đóng cửa, thông tin sai) cho quán đã có sẵn.",
    "source2Name": "Đóng góp quán mới",
    "source2Body": "ai cũng có thể thêm một quán chưa có trên bản đồ — hệ thống kiểm duyệt nhanh trước khi hiển thị công khai.",
    "disclaimer": "Dữ liệu quán hiển thị có thể chưa đầy đủ với mọi quán tại TP. Hồ Chí Minh — hệ thống phát triển dần theo đóng góp của cộng đồng."
  },
  "levels": {
    "title": "Cấp độ thành viên được tính thế nào",
    "body": "Mỗi hoạt động thật trên tài khoản của bạn được cộng điểm — điểm càng cao, cấp độ càng tăng. Không có cách nào mua hay làm giả điểm: mọi con số đều tính trực tiếp từ đánh giá, đóng góp và lượt hữu ích thật của bạn, tính lại mỗi khi bạn mở trang hồ sơ.",
    "factReview": "điểm / đánh giá được duyệt",
    "factContribution": "điểm / quán đóng góp được duyệt",
    "factHelpful": "điểm / lượt hữu ích nhận được",
    "thresholdsTitle": "Mốc lên cấp",
    "levelLabel": "Cấp {level}",
    "levelThreshold": "Từ {points} điểm",
    "badgesTitle": "Huy hiệu thành tích",
    "badges": {
      "contributor_10": {
        "title": "Đóng góp 10 quán mới",
        "body": "Đạt được khi có từ 10 quán bạn đóng góp đã được duyệt và hiển thị công khai."
      },
      "coffee_hunter": {
        "title": "Thợ săn cà phê",
        "body": "Đạt được khi bạn đã viết từ 10 đánh giá được duyệt cho các quán thuộc danh mục Quán cà phê."
      },
      "helpful_100": {
        "title": "100 lượt hữu ích",
        "body": "Đạt được khi tổng số lượt \"Hữu ích\" người khác dành cho đánh giá của bạn đạt từ 100 trở lên."
      }
    },
    "disclaimer": "Huy hiệu và cấp độ chỉ mang tính ghi nhận đóng góp — không ảnh hưởng đến điểm số hay thứ hạng của quán ăn."
  }
};

export const DEFAULT_ABOUT_CONTENT_EN: AboutContent = {
  "pageTitle": "How scoring works",
  "footerHeading": "About",
  "navEyebrow": "Contents",
  "nav": {
    "cach-cham-diem": "How scoring works",
    "tieu-chi": "The 7 criteria",
    "kiem-duyet": "Review moderation",
    "du-lieu": "Data sources",
    "cap-do-thanh-vien": "Member levels"
  },
  "score": {
    "title": "How a restaurant's score is calculated",
    "body": "The score shown on a restaurant page isn't a simple average of every review. It uses a damped-average formula: the more reviews a restaurant has, the more its score reflects the real experience there; a brand-new restaurant with only one or two reviews gets pulled toward the sitewide average, so a couple of extreme early reviews (too harsh or too generous) can't swing the score on their own.",
    "factRestaurants": "Restaurants in the system",
    "factThreshold": "Reviews before the score settles",
    "factCriteria": "Criteria you can also rate",
    "calloutTitle": "Why not a simple average",
    "calloutBody": "A brand-new restaurant rated 5 stars a few times by friends shouldn't automatically top the rankings. This formula makes scores more trustworthy while a restaurant still has few reviews, and lets them settle into the real experience as more people rate it."
  },
  "axes": {
    "title": "The 7 rating criteria",
    "body": "Alongside the overall rating, reviewers can also rate 7 individual criteria — shown as a breakdown chart on the restaurant page so you can see where a place is strong or weak. These criteria are not factored into the overall score at the top of the page — that score comes only from the overall rating. Reviewers can skip any criterion they didn't experience.",
    "items": {
      "food_quality": {
        "label": "Food quality",
        "note": "Taste, freshness, consistency across visits."
      },
      "space": {
        "label": "Atmosphere",
        "note": "Noise level, seating, lighting, how open the space feels."
      },
      "price": {
        "label": "Price",
        "note": "How the price compares to what you get."
      },
      "service": {
        "label": "Service",
        "note": "Attitude, how fast orders come out, handling mistakes."
      },
      "hygiene": {
        "label": "Cleanliness",
        "note": "Tables, utensils, and any visible prep area."
      },
      "wifi": {
        "label": "Wifi",
        "note": "Only applies when the restaurant has wifi."
      },
      "parking": {
        "label": "Parking",
        "note": "Whether there's space, an attendant, or a fee."
      }
    }
  },
  "moderation": {
    "title": "How reviews get moderated",
    "body": "The goal is keeping reviews real, not keeping a restaurant's score flattering.",
    "steps": {
      "1": {
        "title": "Signed-in users only",
        "body": "Each account can only re-review the same restaurant after a minimum of 24 hours since its last review, to limit spam."
      },
      "2": {
        "title": "Automatic filtering",
        "body": "Every review gets a risk score (ad links, spam phrases, rapid-fire posting…) — high-risk reviews are held for a moderator to check before they go live."
      },
      "3": {
        "title": "Community reports",
        "body": "Anyone can report a review or incorrect restaurant information; the moderation team reviews it and decides."
      }
    }
  },
  "data": {
    "title": "Where the data comes from",
    "body": "Restaurant information is contributed and kept current by the community. Opening hours, phone numbers, and facilities can change — if you spot something wrong, submit an update right from the restaurant page in the mobile app.",
    "sourcesTitle": "Two main sources",
    "source1Name": "App users",
    "source1Body": "ratings, photos, comments, and status reports (hours changed, closed down, wrong info) on existing restaurants.",
    "source2Name": "New restaurant submissions",
    "source2Body": "anyone can add a restaurant that's not on the map yet — a quick moderation check runs before it goes live.",
    "disclaimer": "Restaurant data shown here may not yet cover every restaurant in Ho Chi Minh City — the system grows as the community contributes."
  },
  "levels": {
    "title": "How member levels are calculated",
    "body": "Every real activity on your account earns points — the more points, the higher your level. There's no way to buy or fake points: every number comes directly from your real reviews, contributions and helpful votes, recomputed each time you open your profile.",
    "factReview": "points / approved review",
    "factContribution": "points / approved restaurant contribution",
    "factHelpful": "points / helpful vote received",
    "thresholdsTitle": "Level thresholds",
    "levelLabel": "Level {level}",
    "levelThreshold": "From {points} points",
    "badgesTitle": "Achievement badges",
    "badges": {
      "contributor_10": {
        "title": "Added 10 new restaurants",
        "body": "Earned once 10 restaurants you contributed have been approved and published."
      },
      "coffee_hunter": {
        "title": "Coffee hunter",
        "body": "Earned once you've written 10 approved reviews for restaurants in the Coffee shop category."
      },
      "helpful_100": {
        "title": "100 helpful votes",
        "body": "Earned once the total \"Helpful\" votes others gave your reviews reaches 100 or more."
      }
    },
    "disclaimer": "Badges and levels only recognize contributions — they don't affect a restaurant's score or ranking."
  }
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsDto = {
  footer: DEFAULT_FOOTER_SETTINGS,
  scoring: DEFAULT_SCORING_SETTINGS,
  gamification: DEFAULT_GAMIFICATION_SETTINGS,
  about: { vi: DEFAULT_ABOUT_CONTENT_VI, en: DEFAULT_ABOUT_CONTENT_EN },
};
