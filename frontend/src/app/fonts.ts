import localFont from "next/font/local";

/**
 * Put these files in: frontend/public/fonts/
 * - AeonikPro-Regular.woff2
 * - AeonikPro-Medium.woff2
 * - AeonikPro-Bold.woff2
 */
export const aeonik = localFont({
  src: [
    { path: "../../public/fonts/AeonikPro-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/AeonikPro-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/AeonikPro-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-aeonik",
  display: "swap",
});