export default function SharePage({ params }: { params: { shareId: string } }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Shared Report</h1>
      <p>Share ID: {params.shareId}</p>
      <p>This feature is coming soon...</p>
    </div>
  );
}
