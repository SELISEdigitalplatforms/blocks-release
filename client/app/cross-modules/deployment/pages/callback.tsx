import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader } from "lucide-react"; // or wherever your Loader component is imported from

const RedirectCallbackUrl = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading] = useState(true);

  useEffect(() => {
    const redirection = localStorage.getItem("destination");
    const queryString = new URLSearchParams(
      Object.fromEntries(searchParams.entries()),
    ).toString();

    // Immediate redirect (loader will show briefly during navigation)
    if (!redirection || redirection === "") {
      const configureUrl = `/app/deployment/configure${queryString ? `?${queryString}` : ""}`;
      navigate(configureUrl, { replace: true });
    } else {
      // Construct the configure URL with query parameters
      const redirectUrl = `${redirection}${queryString ? `?${queryString}` : ""}`;
      navigate(redirectUrl, { replace: true });
    }
  }, [navigate, searchParams]);

  // Show loader while redirecting
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default RedirectCallbackUrl;
