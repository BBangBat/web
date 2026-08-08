import type {
  Congestion,
  CongestionLevel,
  Coordinates,
  CreateReviewPayload,
  Member,
  MemberStats,
  MyReview,
  PresignedUpload,
  Review,
  SignupPayload,
  Store,
  StoreBounds,
  StoreSearchResult,
  TalkMessage,
  TalkSummary,
  UpdateProfilePayload,
} from "@/entities/types";
import { env } from "@/shared/config/env";
import { ApiError, apiRequest } from "./client";

function idsQuery(ids: number[]): string {
  return ids.map(String).join(",");
}

function isUnavailableEndpoint(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

function getStoresAt({ latitude, longitude }: Coordinates) {
  return apiRequest<Store[]>(
    `/api/stores?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
  );
}

async function getStoresIndividually(storeIds: number[]) {
  return Promise.all(storeIds.map((storeId) => apiRequest<Store>(`/api/stores/${storeId}`)));
}

export const bbangbatApi = {
  getStores({ latitude, longitude }: Coordinates) {
    return getStoresAt({ latitude, longitude });
  },

  getStore(storeId: number) {
    return apiRequest<Store>(`/api/stores/${storeId}`);
  },

  async getStoresBulk(storeIds: number[]) {
    const uniqueStoreIds = [...new Set(storeIds)];
    if (uniqueStoreIds.length === 0) return [];

    try {
      const chunks = Array.from(
        { length: Math.ceil(uniqueStoreIds.length / 100) },
        (_, index) => uniqueStoreIds.slice(index * 100, (index + 1) * 100),
      );
      const responses = await Promise.all(
        chunks.map((chunk) => apiRequest<Store[]>(
          `/api/stores/bulk?storeIds=${encodeURIComponent(idsQuery(chunk))}`,
        )),
      );
      const storesById = new Map(responses.flat().map((store) => [store.id, store]));
      return uniqueStoreIds.flatMap((storeId) => {
        const store = storesById.get(storeId);
        return store ? [store] : [];
      });
    } catch (error) {
      if (!isUnavailableEndpoint(error)) throw error;
      return getStoresIndividually(uniqueStoreIds);
    }
  },

  async getStoresByBounds(bounds: StoreBounds, fallbackCenter: Coordinates) {
    const search = new URLSearchParams({
      south: String(bounds.south),
      north: String(bounds.north),
      west: String(bounds.west),
      east: String(bounds.east),
    });

    try {
      return await apiRequest<Store[]>(`/api/stores/bounds?${search.toString()}`);
    } catch (error) {
      if (!isUnavailableEndpoint(error)) throw error;
      return getStoresAt(fallbackCenter);
    }
  },

  searchStores(keyword: string) {
    return apiRequest<StoreSearchResult[]>(
      `/api/search?keyword=${encodeURIComponent(keyword.trim())}`,
    );
  },

  getCongestion(storeId: number) {
    return apiRequest<Congestion>(`/api/congestion/${storeId}`);
  },

  getCongestions(storeIds: number[]) {
    if (storeIds.length === 0) return Promise.resolve([]);
    return apiRequest<Congestion[]>(
      `/api/congestion?storeIds=${encodeURIComponent(idsQuery(storeIds))}`,
    );
  },

  issueAnonymousToken() {
    return apiRequest<void>("/auth/anonymous", { method: "POST" });
  },

  voteCongestion(
    storeId: number,
    level: CongestionLevel,
    location: Coordinates,
    accessToken?: string | null,
  ) {
    return apiRequest<Congestion>("/api/congestion", {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        storeId,
        level,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    });
  },

  getTalks(storeId: number, afterId?: number) {
    const after = afterId ? `&afterId=${afterId}` : "";
    return apiRequest<TalkMessage[]>(`/api/talks?storeId=${storeId}${after}`);
  },

  getTalkSummaries(storeIds: number[]) {
    if (storeIds.length === 0) return Promise.resolve([]);
    return apiRequest<TalkSummary[]>(
      `/api/talks/summary?storeIds=${encodeURIComponent(idsQuery(storeIds))}`,
    );
  },

  sendTalk(storeId: number, content: string, memberId: string, accessToken: string) {
    return apiRequest<TalkMessage>(`/api/talks?authorId=${encodeURIComponent(memberId)}`, {
      method: "POST",
      accessToken,
      body: JSON.stringify({ storeId, content }),
    });
  },

  getReviews(storeId: number) {
    return apiRequest<Review[]>(`/api/reviews?storeId=${storeId}`);
  },

  getMyReviews(memberId: string, accessToken: string) {
    return apiRequest<MyReview[]>(`/api/reviews/me?memberId=${encodeURIComponent(memberId)}`, { accessToken });
  },

  async uploadReviewImages(files: File[], accessToken: string) {
    if (files.length === 0) return [];

    const uploads = await apiRequest<PresignedUpload[]>("/api/reviews/presigned-urls", {
      method: "POST",
      accessToken,
      body: JSON.stringify({ contentTypes: files.map((file) => file.type) }),
    });

    await Promise.all(
      uploads.map(async (upload, index) => {
        const file = files[index];
        if (!file) throw new Error("업로드할 이미지 정보를 찾지 못했어요.");

        const response = await fetch(upload.presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error("이미지 업로드에 실패했어요. 다시 시도해 주세요.");
        }
      }),
    );

    return uploads.map((upload) => upload.objectKey);
  },

  createReview(payload: CreateReviewPayload, memberId: string, accessToken: string) {
    return apiRequest<Review>(`/api/reviews?memberId=${encodeURIComponent(memberId)}`, {
      method: "POST",
      accessToken,
      body: JSON.stringify(payload),
    });
  },

  deleteReview(reviewId: number, memberId: string, accessToken: string) {
    return apiRequest<void>(`/api/reviews/${reviewId}?memberId=${encodeURIComponent(memberId)}`, {
      method: "DELETE",
      accessToken,
    });
  },

  getFavorites(memberId: string, accessToken: string) {
    return apiRequest<number[]>(`/api/members/favorites?memberId=${encodeURIComponent(memberId)}`, { accessToken });
  },

  addFavorite(storeId: number, memberId: string, accessToken: string) {
    return apiRequest<void>(`/api/members/favorites/${storeId}?memberId=${encodeURIComponent(memberId)}`, {
      method: "POST",
      accessToken,
    });
  },

  removeFavorite(storeId: number, memberId: string, accessToken: string) {
    return apiRequest<void>(`/api/members/favorites/${storeId}?memberId=${encodeURIComponent(memberId)}`, {
      method: "DELETE",
      accessToken,
    });
  },

  getMe(memberId: string, accessToken: string) {
    return apiRequest<Member>(`/api/members/me?memberId=${encodeURIComponent(memberId)}`, { accessToken });
  },

  updateProfile(payload: UpdateProfilePayload, accessToken: string) {
    return apiRequest<Member>("/api/members/me", {
      method: "PATCH",
      accessToken,
      body: JSON.stringify(payload),
    });
  },

  async uploadProfileImage(file: File, accessToken: string) {
    const upload = await apiRequest<PresignedUpload>(
      "/api/members/me/profile-image/presigned-url",
      {
        method: "POST",
        accessToken,
        body: JSON.stringify({ contentType: file.type }),
      },
    );

    let response: Response;
    try {
      response = await fetch(upload.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
    } catch {
      throw new Error("프로필 이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }

    if (!response.ok) {
      throw new Error("프로필 이미지 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }

    return upload.objectKey;
  },

  getMemberStats(memberId: string, accessToken: string) {
    return apiRequest<MemberStats>(`/api/members/me/stats?memberId=${encodeURIComponent(memberId)}`, { accessToken });
  },

  checkNickname(nickname: string) {
    return apiRequest<{ available: boolean }>(
      `/api/members/nickname/check?nickname=${encodeURIComponent(nickname)}`,
    );
  },

  signup(payload: SignupPayload) {
    return apiRequest<{ accessToken: string }>("/api/members/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  linkAccount(tempToken: string) {
    return apiRequest<{ accessToken: string }>("/api/members/link", {
      method: "POST",
      body: JSON.stringify({ tempToken }),
    });
  },

  refreshToken() {
    return apiRequest<{ accessToken: string }>("/auth/token/refresh", {
      method: "POST",
    });
  },

  logout(accessToken: string) {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
      accessToken,
    });
  },

  socialLoginUrl(provider: "kakao" | "naver", redirectOrigin: string) {
    const redirect = encodeURIComponent(redirectOrigin);
    return `${env.oauthBaseUrl}/oauth2/authorization/${provider}?redirect_uri=${redirect}`;
  },
};
