import type { MemberSocial, SocialProvider } from "@/entities/types";

export function resolveCurrentSocialProvider(
  socials: readonly MemberSocial[] | undefined,
  sessionProvider: SocialProvider | null,
): SocialProvider | null {
  if (sessionProvider && socials?.some((social) => social.provider === sessionProvider)) {
    return sessionProvider;
  }
  return socials?.find((social) => social.current)?.provider ?? null;
}

export function applyCurrentSocialProvider(
  socials: readonly MemberSocial[],
  currentProvider: SocialProvider | null,
): MemberSocial[] {
  return socials.map((social) => ({
    ...social,
    current: social.provider === currentProvider,
  }));
}

export function canUnlinkSocial(
  provider: SocialProvider,
  currentProvider: SocialProvider | null,
) {
  return provider !== currentProvider;
}
