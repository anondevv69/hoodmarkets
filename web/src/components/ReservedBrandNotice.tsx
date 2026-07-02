export function ReservedBrandNotice({ message }: { message: string }) {
  return (
    <div className="reserved-card lp-fade-in" role="alert">
      <p className="reserved-title">Name or ticker not allowed</p>
      <p className="reserved-sub">{message}</p>
    </div>
  );
}
