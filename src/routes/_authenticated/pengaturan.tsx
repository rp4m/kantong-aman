import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan – Kantong Aman" },
      { name: "description", content: "Pengaturan budget, master data, dan aplikasi." },
    ],
  }),
  component: () => <Outlet />,
});
