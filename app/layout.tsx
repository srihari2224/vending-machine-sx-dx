import "./globals.css";

export const metadata = {
  title: "PixelPrint Kiosk",
  description: "Secure printing kiosk",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
