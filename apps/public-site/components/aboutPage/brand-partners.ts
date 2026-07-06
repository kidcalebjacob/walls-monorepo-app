export type BrandPartner = {
  image: string;
  name: string;
};

export const ABOUT_BRAND_PARTNERS: readonly BrandPartner[] = [
  { image: "/brandPartners/Google.svg", name: "Google" },
  { image: "/brandPartners/Coca-Cola.svg", name: "Coca-Cola" },
  { image: "/brandPartners/Spotify.svg", name: "Spotify" },
  { image: "/brandPartners/Sony-Pictures.svg", name: "Sony Pictures" },
  { image: "/brandPartners/Xfinity.svg", name: "Xfinity" },
  { image: "/brandPartners/Adobe.svg", name: "Adobe" },
  { image: "/brandPartners/Atlantic-Records.svg", name: "Atlantic Records" },
  { image: "/brandPartners/BetterHelp.svg", name: "BetterHelp" },
  { image: "/brandPartners/Lionsgate.svg", name: "Lionsgate" },
  { image: "/brandPartners/Demi-Lovato.svg", name: "Demi Lovato" },
  { image: "/brandPartners/Twisted-Tea.svg", name: "Twisted Tea" },
  { image: "/brandPartners/J-Balvin.svg", name: "J Balvin" },
] as const;
