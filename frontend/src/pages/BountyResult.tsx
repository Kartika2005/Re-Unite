import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as api from "../api";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  IndianRupee,
} from "lucide-react";

type VerifyState = "loading" | "success" | "failed" | "pending" | "error";

export function BountyResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerifyState>("loading");
  const [amount, setAmount] = useState<number | null>(null);
  const [txnId, setTxnId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const orderId = searchParams.get("orderId") || "";

  useEffect(() => {
    if (!orderId) {
      setErrorMsg("Missing order ID");
      setState("error");
      return;
    }

    const storedRequestId = localStorage.getItem("bounty_requestId");

    if (!storedRequestId) {
      setErrorMsg("Could not determine case ID. Please return to your requests.");
      setState("error");
      return;
    }

    let attempts = 0;
    const maxAttempts = 5;

    const verify = async () => {
      try {
        const result = await api.verifyBountyPayment(storedRequestId, orderId);

        if (result.success && result.state === "COMPLETED") {
          setState("success");
          setAmount(result.amount ?? null);
          setTxnId(result.transactionId ?? null);
          localStorage.removeItem("bounty_requestId");
        } else if (result.state === "FAILED") {
          setState("failed");
          localStorage.removeItem("bounty_requestId");
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(verify, 3000);
          } else {
            setState("pending");
          }
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to verify payment");
        setState("error");
      }
    };

    verify();
  }, [orderId]);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="max-w-md mx-auto p-8">
      <Card>
        <CardContent className="pt-8 pb-8 text-center">{children}</CardContent>
      </Card>
    </div>
  );

  if (state === "loading") {
    return (
      <Wrapper>
        <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
        <h2 className="text-lg font-bold mb-1">Verifying Payment...</h2>
        <p className="text-sm text-muted-foreground">
          Please wait while we confirm your payment with PhonePe.
        </p>
      </Wrapper>
    );
  }

  if (state === "success") {
    return (
      <Wrapper>
        <CheckCircle className="h-14 w-14 mx-auto mb-4 text-green-500" />
        <h2 className="text-lg font-bold text-green-700 mb-2">Payment Successful!</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your bounty payment has been received. The police will release the
          reward to the tipper who helped find the missing person.
        </p>
        {amount && (
          <p className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1 mb-1">
            <IndianRupee className="h-5 w-5" />{amount.toLocaleString()}
          </p>
        )}
        {txnId && (
          <p className="text-xs text-muted-foreground mb-4">Transaction ID: {txnId}</p>
        )}
        <Button onClick={() => navigate("/citizen/requests")} className="mt-2">
          Back to My Requests
        </Button>
      </Wrapper>
    );
  }

  if (state === "failed") {
    return (
      <Wrapper>
        <XCircle className="h-14 w-14 mx-auto mb-4 text-destructive" />
        <h2 className="text-lg font-bold text-destructive mb-2">Payment Failed</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your payment could not be processed. You can try again from your requests page.
        </p>
        <Button onClick={() => navigate("/citizen/requests")}>
          Back to My Requests
        </Button>
      </Wrapper>
    );
  }

  if (state === "pending") {
    return (
      <Wrapper>
        <Clock className="h-14 w-14 mx-auto mb-4 text-amber-500" />
        <h2 className="text-lg font-bold text-amber-700 mb-2">Payment Pending</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your payment is still being processed. This page will refresh
          automatically, or you can check later from your requests page.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => navigate("/citizen/requests")}>
            Back to Requests
          </Button>
        </div>
      </Wrapper>
    );
  }

  // error state
  return (
    <Wrapper>
      <AlertTriangle className="h-14 w-14 mx-auto mb-4 text-destructive" />
      <h2 className="text-lg font-bold text-destructive mb-2">Error</h2>
      <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>
      <Button onClick={() => navigate("/citizen/requests")}>
        Back to My Requests
      </Button>
    </Wrapper>
  );
}
