import Link from "vinext/shims/link";
export default function AdminLayout({ children }: { children: React.ReactNode }) {
 return <><header className="workspace-nav"><Link className="brand" href="/">conskill<span>.</span></Link><nav aria-label="Admin navigation"><Link href="/admin">Roles</Link><Link href="/admin/add-role">Add Role</Link><Link href="/">Switch workspace</Link></nav></header>{children}</>;
}
