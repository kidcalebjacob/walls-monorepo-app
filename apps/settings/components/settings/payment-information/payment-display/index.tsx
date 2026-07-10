import UsdBusinessDisplay from "./USD-business-display";
import UsdPersonalDisplay from "./USD-personal-display";
import EurBusinessDisplay from "./EUR-business-display";
import EurPersonalDisplay from "./EUR-personal-display";
import CadPersonalDisplay from "./CAD-personal-display";
import CadBusinessDisplay from "./CAD-business-display";
import AudPersonalDisplay from "./AUD-personal-display";
import AudBusinessDisplay from "./AUD-business-display";
import GbpPersonalDisplay from "./GBP-personal-display";
import GbpBusinessDisplay from "./GBP-business-display";
import { PaymentDetails } from "@/types/payment.types";

interface PaymentDisplayProps {
  paymentDetails: PaymentDetails;
  onDelete: () => void;
}

export default function PaymentDisplay({ paymentDetails, onDelete }: PaymentDisplayProps) {
  // Determine which display component to render based on payment type
  const paymentType = paymentDetails?.name;

  switch (paymentType) {
    case "USD-business":
      return <UsdBusinessDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "USD-personal":
      return <UsdPersonalDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "EUR-business":
      return <EurBusinessDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "EUR-personal":
      return <EurPersonalDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "CAD-personal":
      return <CadPersonalDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "CAD-business":
      return <CadBusinessDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "AUD-personal":
      return <AudPersonalDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "AUD-business":
      return <AudBusinessDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "GBP-personal":
      return <GbpPersonalDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    case "GBP-business":
      return <GbpBusinessDisplay paymentDetails={paymentDetails} onDelete={onDelete} />;
    default:
      return (
        <div className="p-6 bg-muted rounded-lg text-center">
          <p className="text-muted-foreground">No payment information found or unsupported payment type.</p>
        </div>
      );
  }
} 