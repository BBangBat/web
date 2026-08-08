import { describe, expect, it } from "vitest";
import { isValidNickname, limitTextInput } from "@/shared/lib/text-input";

describe("text input policy", () => {
  it("한글과 숫자를 각각 한 글자로 세어 최대 길이를 제한한다", () => {
    expect(limitTextInput("빵1234", 4)).toBe("빵123");
  });

  it("닉네임은 공백을 제외하고 2자 이상 20자 이하만 허용한다", () => {
    expect(isValidNickname(" 빵 ")).toBe(false);
    expect(isValidNickname("빵테스터20")).toBe(true);
    expect(isValidNickname("가".repeat(21))).toBe(false);
  });
});
