import Link from "next/link";
import { SignupForm } from "@/features/auth/signup-form";

export default async function SignupPage(props: PageProps<"/signup">) {
  const searchParams = await props.searchParams;
  const tempToken = Array.isArray(searchParams.temp_token)
    ? searchParams.temp_token[0]
    : searchParams.temp_token;
  const existingAccount =
    (Array.isArray(searchParams.existing_account)
      ? searchParams.existing_account[0]
      : searchParams.existing_account) === "true";

  if (!tempToken) {
    return (
      <main className="center-page">
        <div className="callback-error">
          <strong>가입 정보를 찾지 못했어요.</strong>
          <Link href="/" className="button button-primary">홈으로 돌아가기</Link>
        </div>
      </main>
    );
  }

  return <SignupForm tempToken={tempToken} existingAccount={existingAccount} />;
}
