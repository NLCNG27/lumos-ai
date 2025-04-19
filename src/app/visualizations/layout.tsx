import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Visualizations | Lumos AI",
  description: "Interactive data visualizations and analytics",
};

export default function VisualizationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {children}
    </div>
  );
} 