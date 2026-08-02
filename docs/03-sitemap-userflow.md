# Sitemap & User Flows — MVP

## 1. Sitemap

```mermaid
graph TD
  Splash --> Onboarding --> PermLoc[Permission Location]
  PermLoc --> Auth
  PermLoc --> HomeMap

  subgraph Auth[Auth Stack]
    Login --> Register
    Login --> Forgot[Forgot Password]
  end

  Auth --> HomeMap

  subgraph MainTabs[Main Tab Navigation]
    HomeMap[Home Map] <--> HomeList[Home List]
    HomeMap --> Search
    HomeList --> Search
    Search --> SearchResult[Search Result]
    SearchResult --> Filter
    SearchResult --> Detail[Restaurant Detail]
    HomeMap --> Detail

    Favorites --> Detail
    Profile --> Favorites
    Profile --> EditProfile[Edit Profile]
    Profile --> MyContrib[My Contributions]
    Profile --> Notifications
    Profile --> Settings
  end

  Detail --> Gallery[Photo Gallery]
  Detail --> Menu
  Detail --> Reviews
  Reviews --> WriteReview[Write Review]
  Detail --> ReportContent[Report Content]

  HomeMap --> AddRestaurant[Add Restaurant]
  AddRestaurant --> SelectLocation[Select Location]
  AddRestaurant --> UploadMedia[Upload Media]
  AddRestaurant --> SubmissionStatus[Submission Status]
  MyContrib --> SubmissionStatus

  Settings --> Logout

  subgraph AdminWeb[Admin Portal - Web]
    AdminLogin[Admin Login] --> AdminDash[Admin Dashboard]
    AdminDash --> AdminRestaurants[Restaurant Management]
    AdminDash --> AdminModQueue[Moderation Queue]
    AdminDash --> AdminReviews[Review Management]
    AdminDash --> AdminUsers[User Management]
    AdminDash --> AdminReports[Report Management]
  end
```

Navigation shell: bottom tab bar with 4 tabs — **Bản đồ (Map)**, **Danh sách (List)** *(can be a toggle on the same tab, see Screen List doc)*, **Yêu thích (Favorites)**, **Cá nhân (Profile)** — plus a floating "+" action for Add Restaurant reachable from Map/List.

## 2. Core User Flows

### 2.1 First-time launch → first search

```mermaid
flowchart TD
  A[Splash] --> B[Onboarding 3 slides]
  B --> C{Location permission}
  C -->|Granted| D[Home Map centered on GPS]
  C -->|Denied| E[Manual city/district picker banner]
  E --> D
  D --> F[User taps Search]
  F --> G[Enters keyword or applies filter]
  G --> H[Search Result list]
  H --> I[Taps a card]
  I --> J[Restaurant Detail]
```

### 2.2 Guest → authenticated action (soft gate)

```mermaid
flowchart TD
  A[Guest browsing Detail] --> B{Taps Favorite/Write Review/Add Restaurant}
  B --> C[Auth required modal]
  C --> D[Login]
  C --> E[Register]
  D --> F[Return to original screen, action resumes]
  E --> F
```
Business rule: browsing (map, search, detail, reading reviews) never requires login; any write action does. This maximizes discoverability while gating trust-sensitive actions.

### 2.3 Write a review

```mermaid
flowchart TD
  A[Restaurant Detail] --> B[Tap Write Review]
  B --> C{Already reviewed in last 24h?}
  C -->|Yes| D[Blocked, message shown]
  C -->|No| E[Rate criteria + optional fields]
  E --> F[Add photos optional]
  F --> G[Submit]
  G --> H[AI pre-screen]
  H -->|Low risk| I[Published immediately]
  H -->|Medium/High risk| J[Status: pending review]
  J --> K[Moderator decision]
  K -->|Approved| I
  K -->|Rejected| L[User notified with reason, can edit+resubmit]
```

### 2.4 Add a new restaurant

```mermaid
flowchart TD
  A[Home Map / List] --> B[Tap + Add Restaurant]
  B --> C[Select Location: GPS or drag pin]
  C --> D[Enter name, category, cuisine, price, hours]
  D --> E[Upload at least 1 photo]
  E --> F{Duplicate detected nearby?}
  F -->|Yes| G[Show existing listing, confirm 'different place']
  F -->|No| H[Submit]
  G --> H
  H --> I[Status: pending]
  I --> J[AI screening]
  J -->|Auto-approved| K[Live on map]
  J -->|Needs review| L[Moderator queue]
  L -->|Approved| K
  L -->|Rejected/Edit requested| M[Contributor notified, can revise]
```

### 2.5 Moderator workflow (Admin Portal)

```mermaid
flowchart TD
  A[Admin Login] --> B[Dashboard: pending counts]
  B --> C[Open Moderation Queue]
  C --> D[Select item: review / restaurant / photo]
  D --> E[View content + AI risk score + reason]
  E --> F{Decision}
  F -->|Approve| G[Content published, contributor notified]
  F -->|Reject| H[Reason required, contributor notified]
  F -->|Request edit| I[Contributor notified, can resubmit]
  G --> J[AuditLog entry]
  H --> J
  I --> J
```

### 2.6 AI-assisted natural-language search (baseline, feeds V2 full AI phase but MVP includes a simple version per brief §9)

```mermaid
flowchart TD
  A[Search screen] --> B[User types free-text query]
  B --> C[Query parsed: location, budget, purpose, facilities, cuisine]
  C --> D[Structured filter applied to standard search pipeline]
  D --> E[Ranked results returned]
  E --> F[Each result shows a short why-recommended explanation]
```
Note: full conversational AI concierge experience is **V2 (Phase 3 — AI)**; MVP ships only the NL-to-filter parsing layer reusing the existing Search & Filter pipeline, since this is the highest-leverage, lowest-risk slice of the AI vision to demo.

## 3. Screen-to-Screen Navigation Matrix (MVP)

| From | To | Trigger |
|---|---|---|
| Splash | Onboarding / Home Map | First-launch flag check |
| Onboarding | Permission Location | "Bắt đầu" |
| Home Map | Search, Detail, Add Restaurant, Filter | Tap search bar / marker / FAB / filter icon |
| Home List | Detail, Filter | Tap card / filter icon |
| Search | Search Result | Submit query or tap suggestion |
| Search Result | Detail, Filter | Tap card / filter icon |
| Detail | Gallery, Menu, Reviews, Write Review, Report Content, external Maps app | Respective section tap |
| Reviews | Write Review | "Viết đánh giá" |
| Profile | Favorites, Edit Profile, My Contributions, Notifications, Settings | Menu item tap |
| Settings | Login (after logout) | "Đăng xuất" |
| Add Restaurant | Select Location, Upload Media, Submission Status | Step progression |
