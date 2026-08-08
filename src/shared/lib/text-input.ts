export function limitTextInput(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}

export function isValidNickname(value: string): boolean {
  const length = Array.from(value.trim()).length;
  return length >= 2 && length <= 20;
}
