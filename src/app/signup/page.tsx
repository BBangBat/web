import { SignupCallback } from "@/features/auth/signup-callback";

export default async function SignupPage(props: PageProps<"/signup">) {
  const searchParams = await props.searchParams;
  const code = Array.isArray(searchParams.code)
    ? searchParams.code[0]
    : searchParams.code;

  return <SignupCallback code={code ?? null} />;
}
