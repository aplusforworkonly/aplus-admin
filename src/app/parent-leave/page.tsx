import ParentLeaveForm from '@/components/parent/ParentLeaveForm';

export default function ParentLeavePage() {
  return (
    <div className="min-h-screen flex items-start justify-center bg-muted/30 pt-16 px-4">
      <div className="bg-background rounded-xl border shadow-sm p-8 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-xl font-bold">學生請假申請</h1>
          <p className="text-sm text-muted-foreground mt-1">
            耶加教育　請假申請由行政確認後生效
          </p>
        </div>
        <ParentLeaveForm />
      </div>
    </div>
  );
}
