import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <SignUp />
    </div>
  );
}
