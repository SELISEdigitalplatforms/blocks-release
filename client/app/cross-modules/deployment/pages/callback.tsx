import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import LoadingSpinner from "@/components/loader-spinner/loader-spinner";

const RedirectCallbackUrl = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading] = useState(true);

  useEffect(() => {
    const redirection = localStorage.getItem("destination");
    const queryString = new URLSearchParams(Object.fromEntries(searchParams.entries())).toString();

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
    return <LoadingSpinner />;
  }

  return null;
};

export default RedirectCallbackUrl;
