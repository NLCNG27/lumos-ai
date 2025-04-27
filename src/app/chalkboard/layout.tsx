import { Metadata } from "next";
import ClientLayout from "@/app/chalkboard/client-layout";

export const metadata: Metadata = {
  title: "Chalkboard | Lumos",
  description: "Interactive chalkboard for idea generation",
};

export default function ChalkboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ClientLayout>
            {children}
        </ClientLayout>
    );
}
