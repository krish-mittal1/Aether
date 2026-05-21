export function Button({ children, className = "", variant = "primary", ...props }) {
  const styles = variant === "ghost"
    ? "bg-transparent hover:bg-white/10 text-slate-200"
    : variant === "danger"
      ? "bg-red-600 hover:bg-red-500 text-white"
      : "bg-accent hover:bg-emerald-400 text-[#06120d]";
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
