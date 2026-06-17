import localFont from "next/font/local";

export const apercu = localFont({
  src: [
    {
      path: "../public/fonts/apercu-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/apercu-bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-apercu",
  display: "swap",
});

export const kiro = localFont({
  src: [
    {
      path: "../public/fonts/kiro-bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-kiro",
  display: "swap",
});
