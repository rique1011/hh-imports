export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="motion-safe:animate-page-enter">{children}</div>
}
