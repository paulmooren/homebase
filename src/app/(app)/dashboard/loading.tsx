import { Bone, CardBones, LoadingScreen } from "@/components/skeleton";

export default function Loading() {
  return (
    <LoadingScreen>
      <div className="grid grid-cols-2 gap-4 rounded-[20px] border border-border-soft bg-surface p-6">
        {[0, 1].map((i) => (
          <div key={i}>
            <Bone className="mb-2.5 h-2.5 w-14" />
            <Bone className="h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <CardBones rows={3} />
        <CardBones rows={5} />
      </div>
    </LoadingScreen>
  );
}
