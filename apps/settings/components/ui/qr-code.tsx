"use client";

import type { ComponentProps, SVGAttributes } from "react";
import { QRCodeSVG } from "qrcode.react";

type QRCodeProps = ComponentProps<typeof QRCodeSVG> &
  SVGAttributes<SVGSVGElement> & {
    errorCorrectionLevel?: ComponentProps<typeof QRCodeSVG>["level"];
  };

export function QRCode({
  errorCorrectionLevel,
  level,
  ...props
}: QRCodeProps) {
  return (
    <QRCodeSVG level={level ?? errorCorrectionLevel ?? "M"} {...props} />
  );
}
