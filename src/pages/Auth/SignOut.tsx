import { useEffect } from "react";
import { Link } from "react-router-dom";

import { Button } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

import AuthLayout from "components/Auth/AuthLayout";
import EmptyState from "components/EmptyState";
import { auth } from "../../firebase";

export default function SignOutPage() {
  useEffect(() => {
    auth.signOut();
  }, []);

  return (
    <AuthLayout>
      <EmptyState
        message="Signed Out"
        description={
          <Button component={Link} to="/auth" variant="outlined" sx={{ mt: 3 }}>
            Sign In Again
          </Button>
        }
        Icon={CheckIcon}
      />
    </AuthLayout>
  );
}
