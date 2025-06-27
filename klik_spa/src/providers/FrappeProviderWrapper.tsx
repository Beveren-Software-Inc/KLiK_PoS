import React from "react";
import { FrappeProvider } from "frappe-react-sdk";

interface Props {
  children: React.ReactNode;
}

const FrappeProviderWrapper: React.FC<Props> = ({ children }) => {
  return (
   <FrappeProvider
  url="http://localhost:8000"
  tokenParams={() => ({
    useToken: true,
    token: "62cca08e7a3fa40:df7ebe23a09285f", // no need for "token " prefix here
    type: "token", // 👈 This is required!
  })}
>

      {children}
    </FrappeProvider>
  );
};

export default FrappeProviderWrapper;