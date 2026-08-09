"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { isValidNickname } from "@/shared/lib/text-input";

export type NicknameAvailabilityStatus = "idle" | "checking" | "available" | "taken";

export function useNicknameAvailability({
  nickname,
  currentNickname,
  enabled = true,
}: {
  nickname: string;
  currentNickname?: string;
  enabled?: boolean;
}) {
  const [debouncedNickname, setDebouncedNickname] = useState("");
  const hasChanged = currentNickname === undefined || nickname !== currentNickname;
  const valid = isValidNickname(nickname);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedNickname(nickname), 350);
    return () => window.clearTimeout(timer);
  }, [nickname]);

  const query = useQuery({
    queryKey: ["nickname-availability", debouncedNickname],
    queryFn: () => bbangbatApi.checkNickname(debouncedNickname),
    enabled: enabled
      && hasChanged
      && debouncedNickname === nickname
      && valid,
    retry: false,
    staleTime: 5 * 60_000,
  });

  let status: NicknameAvailabilityStatus = "idle";
  if (enabled && hasChanged && valid) {
    if (debouncedNickname !== nickname || query.isFetching) {
      status = "checking";
    } else if (query.isSuccess) {
      status = query.data.available ? "available" : "taken";
    }
  }

  return {
    patternInvalid: nickname.length > 0 && !valid,
    status,
  } as const;
}
