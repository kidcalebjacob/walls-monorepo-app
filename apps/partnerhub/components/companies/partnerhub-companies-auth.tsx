import { AuthProvider } from "@/app/auth/AuthProvider";
import { toUser } from "@/hooks/user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function PartnerHubCompaniesAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const supabase = await createClient();
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();

    if (error || !supabaseUser) {
      redirect("/login");
    }

    const user = toUser(supabaseUser);

    if (!user?.email) {
      return <AuthProvider>{children}</AuthProvider>;
    }

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      return (
        <AuthProvider>
          {children}
        </AuthProvider>
      );
    } catch (supabaseError) {
      console.error("Supabase error:", supabaseError);
      return <AuthProvider>{children}</AuthProvider>;
    }
  } catch (error) {
    console.error("Error retrieving user:", error);
    return <p>Failed to load companies page. Please try again later.</p>;
  }
}
