import { createFileRoute } from "@tanstack/react-router";
import { ShopApp } from "@/components/shop/app";

export const Route = createFileRoute("/")({
  component: ShopApp,
});
