export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type StoreBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type StoreMenu = {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
};

export type Store = Coordinates & {
  id: number;
  name: string;
  address: string;
  phoneNumber: string | null;
  imageUrl: string;
  menus?: StoreMenu[];
};

export type StoreSearchResult = Pick<Store, "id" | "name" | "address">;

export type CongestionLevel = "UNCROWDED" | "NORMAL" | "CROWDED";

export type Congestion = {
  storeId: number;
  current: CongestionLevel;
  uncrowdedVotes: number;
  normalVotes: number;
  crowdedVotes: number;
  totalVotes: number;
};

export type TalkMessage = {
  id: number;
  authorNickname: string;
  content: string;
  createdAt: string;
};

export type TalkSummary = {
  storeId: number;
  summary: string;
  updatedAt: string | null;
};

export type Review = {
  id: number;
  memberId: number;
  authorNickname: string;
  authorProfileImageUrl: string | null;
  rating: number;
  menus: string[];
  content: string;
  imageUrls: string[];
  createdAt: string | null;
};

export type MyReview = Omit<Review, "memberId"> & {
  storeId: number;
  storeName: string;
  storeImageUrl: string;
};

export type Gender = "MALE" | "FEMALE" | "UNKNOWN";
export type AgeGroup =
  | "TEENS"
  | "TWENTIES"
  | "THIRTIES"
  | "FORTIES"
  | "FIFTIES"
  | "SIXTIES_PLUS"
  | "UNKNOWN";

export type Member = {
  id: number;
  email: string;
  name: string;
  nickname: string;
  profileImageUrl: string | null;
  gender: Gender;
  ageGroup: AgeGroup;
  lastLoginAt: string | null;
  createdAt: string | null;
};

export type MemberStats = {
  reviewCount: number;
  favoriteCount: number;
  talkCount: number;
};

export type SocialProvider = "NAVER" | "KAKAO";

export type MemberSocial = {
  provider: SocialProvider;
  current: boolean;
};

export type OAuthExchangeResponse =
  | { type: "LOGIN"; accessToken: string; tempToken?: never; existingAccount?: never }
  | {
      type: "SIGNUP";
      accessToken?: never;
      tempToken: string;
      existingAccount: boolean;
      gender?: Gender | null;
      ageGroup?: AgeGroup | null;
    }
  | { type: "LINK"; accessToken?: never; tempToken: string; existingAccount?: never }
  | { type: "UNLINK"; accessToken?: never; tempToken?: never; existingAccount?: never; provider: SocialProvider };

export type PresignedUpload = {
  presignedUrl: string;
  objectKey: string;
};

export type SignupPayload = {
  tempToken: string;
  nickname: string;
  profileImageKey?: string | null;
  gender: Gender;
  ageGroup: AgeGroup;
  termsAgreed: boolean;
  privacyAgreed: boolean;
};

export type UpdateProfilePayload = {
  name?: string;
  nickname?: string;
  profileImageKey?: string;
};

export type CreateReviewPayload = {
  storeId: number;
  rating: number;
  menus: string[];
  content: string;
  imageKeys: string[];
};

export type ApiErrorBody = {
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
};
