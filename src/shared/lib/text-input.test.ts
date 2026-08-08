import { describe, expect, it } from "vitest";
import { isValidName, isValidNickname, limitTextInput } from "@/shared/lib/text-input";

describe("text input policy", () => {
  it("한글과 숫자를 각각 한 글자로 세어 최대 길이를 제한한다", () => {
    expect(limitTextInput("빵1234", 4)).toBe("빵123");
  });

  it("닉네임은 완성형 한글, 영문, 숫자로 구성된 2~10자만 허용한다", () => {
    expect(isValidNickname("빵")).toBe(false);
    expect(isValidNickname("빵테스터20")).toBe(true);
    expect(isValidNickname("가".repeat(10))).toBe(true);
    expect(isValidNickname("가".repeat(11))).toBe(false);
    expect(isValidNickname("ㄱ빵")).toBe(false);
    expect(isValidNickname("빵 테스터")).toBe(false);
    expect(isValidNickname("빵테스터!")).toBe(false);
  });

  it("이름은 문자 종류와 관계없이 1~30자를 허용한다", () => {
    expect(isValidName("")).toBe(false);
    expect(isValidName("홍 길동")).toBe(true);
    expect(isValidName("가".repeat(30))).toBe(true);
    expect(isValidName("가".repeat(31))).toBe(false);
  });
});
