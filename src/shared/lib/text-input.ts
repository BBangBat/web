export function limitTextInput(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}

export function textInputLength(value: string): number {
  return Array.from(value).length;
}

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_ERROR_MESSAGE = "닉네임은 한글, 영문, 숫자만 2~10자로 입력해 주세요.";
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 30;

const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9]{2,10}$/u;

export function isValidNickname(value: string): boolean {
  return NICKNAME_PATTERN.test(value);
}

export function isValidName(value: string): boolean {
  const length = Array.from(value).length;
  return length >= NAME_MIN_LENGTH && length <= NAME_MAX_LENGTH;
}
