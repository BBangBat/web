import { z } from "zod";
import { textInputLength } from "@/shared/lib/text-input";

export const reviewSchema = z.object({
  rating: z.number().min(1, "별점을 선택해 주세요.").max(5),
  menus: z.array(z.string().trim().min(1)).min(1, "구매한 메뉴를 입력해 주세요."),
  content: z
    .string()
    .trim()
    .refine((value) => textInputLength(value) >= 10, "후기는 10자 이상 입력해 주세요.")
    .refine((value) => textInputLength(value) <= 500, "후기는 500자까지 입력할 수 있어요."),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
