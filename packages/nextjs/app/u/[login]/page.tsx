import { ThanksWall } from "~~/components/onethanks/ThanksWall";

export default async function AuthorPage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  return <ThanksWall key={login.toLowerCase()} login={login} />;
}
