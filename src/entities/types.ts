export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Store = Coordinates & {
  id: number;
  name: string;
  address: string;
  phoneNumber: string | null;
  imageUrl: string;
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

export type Gender = "MALE" | "FEMALE";
export type AgeGroup =
  | "TEENS"
  | "TWENTIES"
  | "THIRTIES"
  | "FORTIES"
  | "FIFTIES"
  | "SIXTIES_PLUS";

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

export type PresignedUpload = {
  presignedUrl: string;
  objectKey: string;
};

export type SignupPayload = {
  tempToken: string;
  nickname: string;
  profileImageUrl?: string | null;
  gender: Gender;
  ageGroup: AgeGroup;
  termsAgreed: boolean;
  privacyAgreed: boolean;
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
};
