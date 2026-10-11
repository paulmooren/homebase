import { CardBones, LoadingScreen } from "@/components/skeleton";

export default function Loading() {
  return (
    <LoadingScreen>
      <CardBones rows={6} />
    </LoadingScreen>
  );
}
