import { useMemo } from "react";

import type { PaymentDetails } from "@/types/payment.types";

export function useIsPaymentDetailsEmpty(paymentDetails: PaymentDetails): boolean {
  return useMemo(() => {
    if (!paymentDetails.name.trim()) {
      return true;
    }

    return Object.values(paymentDetails.details).every(
      (value) => !value || value.trim() === "",
    );
  }, [paymentDetails]);
}
